# Liber Cosmetic

Online cosmetics shop and cosmetology consultation. Plain HTML, CSS and JavaScript on the front end, Vercel serverless functions on the back end, and Postgres (Supabase) for data. **One secret is all it needs: `DATABASE_URL`.**

## What it does

| Who | What they can do |
| --- | --- |
| Customer | Register and sign in, browse and order (with an address or shared location), track order status, fill in the questionnaire and upload photos |
| Staff | Add, edit and delete products (with photos), update order status, search the patient records, add notes, enter a walk-in patient's questionnaire, see the customer list |
| Admin | Everything staff can do, plus add staff and change roles |

The site is available in Uzbek, Russian, English and Karakalpak. The staff panel is in Uzbek. Have a native speaker review the Karakalpak text in `i18n.js`.

## Deploy to Vercel

1. **Get the database connection string.** In Supabase open your project, click **Connect**, and choose the **Transaction pooler** string (port `6543`). It looks like:
   `postgresql://postgres.<project-id>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres`
   - Do **not** use the "Direct connection" string (`db.<id>.supabase.co:5432`). It is IPv6-only and Vercel cannot reach it.
   - Replace `[YOUR-PASSWORD]` with your database password. If the password contains special characters, URL-encode them (`@` becomes `%40`, `#` becomes `%23`).
2. **Push the project to GitHub**, then in Vercel choose **Add New > Project** and import it. Framework Preset: **Other**. Leave the build settings alone.
3. In **Settings > Environment Variables** add:
   - `DATABASE_URL` = the string from step 1 (required)
   - `ADMIN_EMAIL` = your email (see "First admin" below)
   - optional: `TELEGRAM_USERNAME`, `SHOP_PHONE`, `INSTAGRAM_USERNAME`, `SHOP_ADDRESS`, `MAP_URL`
4. **Deploy** (or **Redeploy** after adding variables).
5. Open the site. The tables are created automatically on the first request, so there is no SQL to run.

If the site shows a red banner at the top, the banner text says what is wrong with the connection (wrong password, direct host instead of pooler, missing variable).

### First admin

Set `ADMIN_EMAIL`, then **register on the live site with that exact email right after the first deploy**. That account becomes admin. This works only while no admin exists yet, so it cannot be repeated by someone else later. Until you register, anyone who knows the address could take it, so do it straight away.

If you need to fix roles later, run this in the Supabase SQL Editor:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

### Add products

Sign in as admin, open **Panel > Mahsulotlar**, and click **+ Yangi mahsulot**. On an empty catalog there is also a **Namunaviy katalogni yuklash** button that loads 18 sample products.

## Run locally

The front end works on its own in **demo mode** (data stays in the browser, with Admin/Staff sign-in buttons at the top):

```bash
python3 -m http.server 8080
```

For the real back end locally, install the Vercel CLI, put `DATABASE_URL` in a `.env` file (see `.env.example`) and run `vercel dev`.

## How it is built

- `index.html`, `styles.css`: page and design
- `app.js`: interface (shop, cart, sign-in, questionnaire, staff panel)
- `api.js`: data layer. It checks `/api/health` and uses the server when it answers, otherwise demo mode
- `i18n.js`: all translations; `art.js`, `defaults.js`: drawings and sample catalog for products without photos
- `api/[...path].js`: the whole REST API in one function; `api/_db.js`, `api/_schema.js`, `api/_util.js`: database, schema and security helpers; `api/config.js`: serves shop settings as `/config.js`
- `vercel.json`: security headers (CSP and others) and the `/config.js` rewrite

## Security notes

- Passwords are stored as salted scrypt hashes. Sessions are random tokens stored hashed in the database, sent in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, and revoked on logout or role change.
- Login and registration are rate limited. Cross-site write requests are rejected.
- Prices are always read from the database when an order is placed, never from the browser.
- Uploaded images are checked by their file signature. Patient photos are only served to their owner and staff.
- All tables have row-level security enabled with no policies, so Supabase's public API cannot read them. Only the server connects.
- This is hand-written authentication with no email verification and no password reset. Staff can change roles, but there is no "forgot password" flow yet.
- Patient questionnaires are health information. Check what your local data-protection rules require before going live.
- Photos are stored inside the database (about 1.5 MB maximum each). The Supabase free plan has a 500 MB limit, so watch the size.
- The test suite used to check the API ran against a local Postgres. It is not part of this repository.
