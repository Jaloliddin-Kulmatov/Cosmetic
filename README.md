# Liber Cosmetic

Onlayn kosmetika do'koni va kosmetologik konsultatsiya. Build kerak emas: oddiy HTML, CSS va JavaScript. Ma'lumotlar Supabase'da saqlanadi.

## Imkoniyatlar

| Kim | Nima qila oladi |
| --- | --- |
| Mijoz | Ro'yxatdan o'tadi, mahsulot tanlaydi, buyurtma beradi (manzil yoki joylashuv bilan), buyurtma holatini kuzatadi, anketa to'ldiradi va suratlarini yuklaydi |
| Xodim | Mahsulot kiritadi/tahrirlaydi/o'chiradi, rasm yuklaydi, buyurtmalar holatini o'zgartiradi, bemorlar bazasini ko'radi, izoh yozadi, yangi bemor anketasini kiritadi, mijozlar ro'yxatini ko'radi |
| Admin | Xodimning hammasi + xodim qo'shadi va rollarni o'zgartiradi |

Sayt 4 tilda: o'zbek, rus, ingliz, qoraqalpoq. Admin panel o'zbekcha.

## Ishga tushirish

1. **Supabase loyihasi** yarating (supabase.com).
2. **SQL Editor** da `supabase/schema.sql` faylini ishga tushiring. Jadvallar, xavfsizlik qoidalari (RLS) va rasm saqlash joylari yaratiladi.
3. Ixtiyoriy: `supabase/seed.sql` namunaviy mahsulotlarni qo'shadi. Haqiqiy katalogni panel orqali kiritish yaxshiroq.
4. **Project Settings > API Keys** dan `Project URL` va ochiq kalitni (`anon` yoki `sb_publishable_...`) oling. Vercel'da ularni Environment Variables'ga, lokal ishlatganda `config.js` ga yozing. `service_role` va `sb_secret_` kalitlarni hech qachon qo'ymang.
5. Saytda o'z emailingiz bilan ro'yxatdan o'ting, so'ng SQL Editor da o'zingizni admin qiling:
   ```sql
   update public.profiles set role = 'admin' where email = 'sizning@email.com';
   ```
6. Sahifani qayta yuklang. Menyuda **Panel** paydo bo'ladi.
7. `config.js` da `telegram`, `phone`, `shopAddress`, `mapUrl` ni to'ldiring.

**Email tasdiqlash:** Supabase sukut bo'yicha ro'yxatdan o'tganda email tasdiqlashni talab qiladi. Sinash vaqtida Authentication > Providers > Email bo'limida o'chirib qo'yishingiz mumkin. Ishga tushirgach qayta yoqing.

**Authentication > URL Configuration** da sayt manzilingizni `Site URL` ga yozing, aks holda tasdiqlash xatidagi havola ishlamaydi.

## Vercel'ga joylashtirish

Build kerak emas. Vercel fayllarni o'zi beradi, `api/config.js` funksiyasi esa Supabase sozlamalarini Environment Variables'dan olib `/config.js` sifatida yuboradi. Shuning uchun kalitlar kodga yozilmaydi.

1. Supabase'da `supabase/schema.sql` ni SQL Editor orqali ishga tushiring (yuqoridagi 2-qadam).
2. Papkani GitHub'ga yuklang va vercel.com > Add New > Project orqali import qiling. Framework Preset: **Other**. Build Command va Output Directory'ga tegmang.
   Terminaldan: `npx vercel` (birinchi marta), keyin `npx vercel --prod`.
3. Vercel > Project > Settings > Environment Variables ga qo'shing (namuna `.env.example` da):
   - `SUPABASE_URL` = `https://<loyiha-id>.supabase.co`
   - `SUPABASE_ANON_KEY` = anon yoki `sb_publishable_...` kalit
   - ixtiyoriy: `TELEGRAM_USERNAME`, `SHOP_PHONE`, `INSTAGRAM_USERNAME`, `SHOP_ADDRESS`, `MAP_URL`

   Supabase'ning Vercel integratsiyasini yoqsangiz, `NEXT_PUBLIC_SUPABASE_URL` va `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` nomlari ham taniladi.
4. O'zgaruvchilarni qo'shgach **Redeploy** qiling.
5. Supabase > Authentication > URL Configuration: `Site URL` ga Vercel manzilingizni (`https://sizning-sayt.vercel.app`) yozing va `Redirect URLs` ga ham qo'shing. Aks holda email tasdiqlash havolasi ishlamaydi.
6. Saytda ro'yxatdan o'ting va o'zingizni admin qiling (yuqoridagi 5-qadam).

Agar `SUPABASE_ANON_KEY` ga maxfiy kalit (`service_role` yoki `sb_secret_`) qo'yilsa, funksiya uni brauzerga yubormaydi va konsolda xato yozadi.

`vercel.json` xavfsizlik sarlavhalarini (CSP, X-Frame-Options va boshqalar) qo'shadi. Supabase uchun o'z domeningizni (custom domain) ulasangiz, `Content-Security-Policy` dagi `*.supabase.co` ni shu domenga moslang.

## Lokal ishlatish

```bash
python3 -m http.server 8080
```

Lokal ishlaganda `config.js` ishlatiladi (u yerga URL va anon kalitni yozing, lekin git'ga yuklamang). `config.js` bo'sh bo'lsa sayt **demo rejimda** ishlaydi: ma'lumotlar faqat brauzerda saqlanadi, tepada Admin/Xodim sifatida kirish tugmalari chiqadi.

## Xavfsizlik

- Narxlar serverda hisoblanadi (`place_order` funksiyasi). Mijoz narxni o'zgartira olmaydi.
- Rolni faqat admin o'zgartiradi (`set_user_role`). Foydalanuvchi o'z profilida faqat ism va telefonni tahrirlaydi.
- Bemor suratlari yopiq bucket'da (`patient-photos`). Faqat egasi va xodimlar ko'radi, havolalar 1 soatga amal qiladi.
- Bemor anketalari va buyurtmalar faqat egasi va xodimlarga ko'rinadi.
- Bemor ma'lumotlari sog'liq haqidagi shaxsiy ma'lumot. Ishga tushirishdan oldin amaldagi qonunchilikka (shaxsiy ma'lumotlar to'g'risidagi qonun) mosligini tekshiring.

## Fayllar

- `index.html`, `styles.css`: sahifa va dizayn
- `app.js`: interfeys (do'kon, savat, kirish, anketa, panel)
- `api.js`: ma'lumotlar qatlami (Supabase yoki demo)
- `i18n.js`: barcha tarjimalar. Qoraqalpoqcha matnlarni ona tilida so'zlashuvchi tekshirib chiqsin
- `art.js`, `defaults.js`: rasmsiz mahsulot chizmalari va namunaviy katalog
- `supabase/schema.sql`, `supabase/seed.sql`: ma'lumotlar bazasi (`supabase/migrations/` dagi nusxa Supabase CLI uchun)
- `api/config.js`, `vercel.json`, `.vercelignore`: Vercel sozlamalari
- `tools/build_preview.py`: saytni bitta faylga yig'adi (demo ko'rinish uchun)
