-- Liber Cosmetic: Supabase sxemasi.
-- Supabase Dashboard > SQL Editor ichida bir marta ishga tushiring. Qayta ishga tushirsa ham xato bermaydi.
--
-- Rollar:
--   customer  mijoz: ro'yxatdan o'tadi, buyurtma beradi, anketa to'ldiradi
--   staff     xodim: mahsulot kiritadi, buyurtmalar va bemorlar bazasi bilan ishlaydi
--   admin     administrator: xodim huquqlari + rollarni boshqaradi

create extension if not exists pgcrypto;

-- ============ profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('staff', 'admin'));
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Foydalanuvchi faqat ism va telefonni o'zgartira oladi. Rolni o'zgartirib bo'lmaydi.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Rolni faqat admin o'zgartiradi (o'zining rolini emas).
create or replace function public.set_user_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if target = auth.uid() then raise exception 'cannot_change_own_role'; end if;
  if new_role not in ('customer', 'staff', 'admin') then raise exception 'bad_role'; end if;
  update public.profiles set role = new_role where id = target;
end $$;
revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ============ products ============
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('parfyumeriya', 'pardoz', 'parvarish', 'toplamlar')),
  type_key text not null default 'other',
  kind text not null default 'set',
  color text not null default '#e3a9b2',
  price integer not null check (price >= 0),
  old_price integer check (old_price is null or old_price > price),
  image_url text,
  description jsonb not null default '{}'::jsonb,
  is_new boolean not null default false,
  is_week boolean not null default false,
  in_stock boolean not null default true,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;

drop policy if exists "products read" on public.products;
create policy "products read" on public.products for select using (active or public.is_staff());
drop policy if exists "products insert" on public.products;
create policy "products insert" on public.products for insert with check (public.is_staff());
drop policy if exists "products update" on public.products;
create policy "products update" on public.products for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "products delete" on public.products;
create policy "products delete" on public.products for delete using (public.is_staff());

-- ============ orders ============
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'confirmed', 'shipped', 'done', 'cancelled')),
  customer_name text not null,
  phone text not null,
  address text not null default '',
  note text not null default '',
  lat double precision,
  lng double precision,
  total integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  price integer not null,
  qty integer not null check (qty > 0)
);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders read" on public.orders;
create policy "orders read" on public.orders for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "orders update" on public.orders;
create policy "orders update" on public.orders for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "orders delete" on public.orders;
create policy "orders delete" on public.orders for delete using (public.is_admin());

drop policy if exists "order items read" on public.order_items;
create policy "order items read" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));

-- Mijoz buyurtmani to'g'ridan-to'g'ri yoza olmaydi. Narxlar serverda mahsulotlar jadvalidan olinadi.
create or replace function public.place_order(
  p_name text, p_phone text, p_address text, p_note text, p_lat double precision, p_lng double precision, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_order bigint;
  v_total integer := 0;
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then raise exception 'missing_contact'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_cart'; end if;

  insert into public.orders (user_id, customer_name, phone, address, note, lat, lng, total)
  values (v_uid, trim(p_name), trim(p_phone), coalesce(p_address, ''), coalesce(p_note, ''), p_lat, p_lng, 0)
  returning id into v_order;

  for r in
    select p.id, p.name, p.price, greatest(1, least(99, (i ->> 'qty')::int)) as qty
    from jsonb_array_elements(p_items) i
    join public.products p on p.id = (i ->> 'id')::uuid and p.active and p.in_stock
  loop
    insert into public.order_items (order_id, product_id, name, price, qty) values (v_order, r.id, r.name, r.price, r.qty);
    v_total := v_total + r.price * r.qty;
  end loop;

  if v_total = 0 then raise exception 'no_valid_items'; end if;
  update public.orders set total = v_total where id = v_order;
  return v_order;
end $$;
revoke all on function public.place_order(text, text, text, text, double precision, double precision, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, double precision, double precision, jsonb) to authenticated;

-- ============ consultations (bemorlar bazasi) ============
create table if not exists public.consultations (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  patient_name text not null default '',
  patient_phone text not null default '',
  city text not null default '',
  lang text not null default 'uz',
  answers jsonb not null default '{}'::jsonb,
  summary text not null,
  photos jsonb not null default '[]'::jsonb,
  staff_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.consultations enable row level security;

drop policy if exists "consultations read" on public.consultations;
create policy "consultations read" on public.consultations for select
  using (user_id = auth.uid() or created_by = auth.uid() or public.is_staff());
drop policy if exists "consultations insert" on public.consultations;
create policy "consultations insert" on public.consultations for insert
  with check ((user_id = auth.uid() and created_by = auth.uid()) or public.is_staff());
drop policy if exists "consultations update" on public.consultations;
create policy "consultations update" on public.consultations for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "consultations delete" on public.consultations;
create policy "consultations delete" on public.consultations for delete using (public.is_admin());

-- ============ storage ============
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('patient-photos', 'patient-photos', false) on conflict (id) do nothing;

drop policy if exists "product images read" on storage.objects;
create policy "product images read" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "product images write" on storage.objects;
create policy "product images write" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());
drop policy if exists "product images update" on storage.objects;
create policy "product images update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
drop policy if exists "product images delete" on storage.objects;
create policy "product images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_staff());

-- Bemor suratlari yopiq: papka nomi foydalanuvchi id si. Faqat egasi va xodimlar ko'radi.
drop policy if exists "patient photos read" on storage.objects;
create policy "patient photos read" on storage.objects for select to authenticated
  using (bucket_id = 'patient-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists "patient photos insert" on storage.objects;
create policy "patient photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists "patient photos delete" on storage.objects;
create policy "patient photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'patient-photos' and public.is_staff());

-- ============ birinchi adminni tayinlash ============
-- Avval saytda shu email bilan ro'yxatdan o'ting, so'ng quyidagini (email ni almashtirib) ishga tushiring:
--   update public.profiles set role = 'admin' where email = 'sizning@email.com';
