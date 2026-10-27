// Postgres ulanishi. Bitta DATABASE_URL yetarli.
const { Pool } = require("pg");
const SCHEMA = require("./_schema.js");

let pool = null;
let ready = null;

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function getPool() {
  if (pool) return pool;
  const raw = connectionString();
  if (!raw) {
    const e = new Error("DATABASE_URL is not set");
    e.code = "NO_DB_URL";
    throw e;
  }
  let cs = raw;
  try {
    const u = new URL(raw);
    // pg kutubxonasi sslmode=require ni qattiq tekshiruvga aylantiradi. SSL ni quyida o'zimiz sozlaymiz.
    u.searchParams.delete("sslmode");
    cs = u.toString();
  } catch (e) { /* URL tahlil qilinmasa, asl qatorni ishlatamiz */ }
  pool = new Pool({
    connectionString: cs,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000
  });
  pool.on("error", (e) => console.error("pg pool error", e.message));
  return pool;
}

async function migrate() {
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    await c.query("select pg_advisory_xact_lock(727001)");
    await c.query(SCHEMA);
    await c.query("COMMIT");
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch (_) { /* e'tiborsiz */ }
    throw e;
  } finally {
    c.release();
  }
}

function ensureSchema() {
  if (!ready) ready = migrate().catch((e) => { ready = null; throw e; });
  return ready;
}

async function query(text, params) {
  await ensureSchema();
  return getPool().query(text, params);
}

async function tx(fn) {
  await ensureSchema();
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch (_) { /* e'tiborsiz */ }
    throw e;
  } finally {
    c.release();
  }
}

// Ulanish xatosini foydalanuvchiga tushunarli maslahatga aylantiradi.
function hint(e) {
  const msg = String((e && (e.message || e.code)) || "");
  const host = (connectionString().match(/@([^:/?#]+)/) || [])[1] || "";
  if (e && e.code === "NO_DB_URL") return "DATABASE_URL Vercel Environment Variables'da topilmadi.";
  if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(host) && /ENOTFOUND|ENETUNREACH|EHOSTUNREACH|ETIMEDOUT|ECONNREFUSED/.test(msg + (e.code || ""))) {
    return "To'g'ridan-to'g'ri ulanish (db.xxx.supabase.co) Vercel'da ishlamaydi. Supabase > Connect bo'limidan 'Transaction pooler' qatorini oling (port 6543).";
  }
  if (e && (e.code === "28P01" || /password authentication failed/i.test(msg))) return "Ma'lumotlar bazasi paroli noto'g'ri. DATABASE_URL dagi parolni tekshiring.";
  if (e && e.code === "28000") return "Ma'lumotlar bazasi foydalanuvchisi noto'g'ri. Pooler qatoridagi foydalanuvchi nomi postgres.<loyiha-id> ko'rinishida bo'lishi kerak.";
  return "Ma'lumotlar bazasiga ulanib bo'lmadi. DATABASE_URL ni tekshiring.";
}

module.exports = { query, tx, ensureSchema, hint, connectionString };
