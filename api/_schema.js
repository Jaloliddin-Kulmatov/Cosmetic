// Ma'lumotlar bazasi sxemasi. Har bir sovuq startda ishga tushadi, shuning uchun har bir buyruq takrorlanganda xavfsiz bo'lishi shart.
// Jadvallarga faqat server (postgres roli) murojaat qiladi. RLS yoqilgan va qoidalar yo'q, shuning uchun
// Supabase'ning ochiq API'si (anon/authenticated) jadvallarni o'qiy olmaydi.
module.exports = `
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  created_at timestamptz not null default now()
);
create unique index if not exists users_email_key on public.users (lower(email));

create table if not exists public.sessions (
  token_hash text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on public.sessions (user_id);
create index if not exists sessions_expires_idx on public.sessions (expires_at);

create table if not exists public.auth_attempts (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists auth_attempts_key_idx on public.auth_attempts (key, at);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('product', 'patient')),
  owner_id uuid references public.users (id) on delete set null,
  mime text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

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

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
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
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  price integer not null,
  qty integer not null check (qty > 0)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.consultations (
  id bigint generated always as identity primary key,
  user_id uuid references public.users (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
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

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.files enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.consultations enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
  end if;
end $$;
`;
