// Barcha API so'rovlari shu bitta Vercel funksiyasiga keladi (/api/...).
// Rollar: customer (mijoz), staff (xodim), admin.
const { query, tx, ensureSchema, hint } = require("./_db.js");
const U = require("./_util.js");
const SEED = require("./_seed.json");

const CATS = ["parfyumeriya", "pardoz", "parvarish", "toplamlar"];
const KINDS = ["perfume", "mascara", "lipstick", "lipgloss", "foundation", "lashkit", "cleanser", "serum", "cream", "set"];
const STATUSES = ["new", "confirmed", "shipped", "done", "cancelled"];
const ROLES = ["customer", "staff", "admin"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const bad = (code, status) => { const e = new Error(code); e.status = status || 400; e.code = code; return e; };
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const toInt = (v) => { const n = typeof v === "number" ? v : parseInt(v, 10); return Number.isFinite(n) && Math.floor(n) === n ? n : null; };
const isStaff = (u) => !!u && (u.role === "staff" || u.role === "admin");
const iso = (d) => (d instanceof Date ? d.toISOString() : d);

const userOut = (r) => ({ id: r.id, email: r.email, name: r.full_name, phone: r.phone, role: r.role });
const productOut = (r) => ({ id: r.id, name: r.name, cat: r.category, ty: r.type_key, k: r.kind, c: r.color, pr: r.price, old: r.old_price, img: r.image_url, isNew: r.is_new, wk: r.is_week, stock: r.in_stock, active: r.active, desc: r.description || {}, sort: r.sort });
const orderOut = (r) => ({ id: Number(r.id), userId: r.user_id, status: r.status, name: r.customer_name, phone: r.phone, address: r.address, note: r.note, lat: r.lat, lng: r.lng, total: r.total, created: iso(r.created_at), items: r.items || [] });
const consultOut = (r) => ({ id: Number(r.id), userId: r.user_id, name: r.patient_name, phone: r.patient_phone, city: r.city, lang: r.lang, summary: r.summary, photos: r.photos || [], note: r.staff_note, created: iso(r.created_at) });

async function currentUser(req) {
  const tok = U.parseCookies(req)[U.COOKIE];
  if (!tok) return null;
  const r = await query(
    "select u.id, u.email, u.full_name, u.phone, u.role from public.sessions s join public.users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()",
    [U.sha256(tok)]
  );
  return r.rows[0] ? userOut(r.rows[0]) : null;
}

function need(c, level) {
  if (!c.user) throw bad("not_authenticated", 401);
  if (level === "staff" && !isStaff(c.user)) throw bad("forbidden", 403);
  if (level === "admin" && c.user.role !== "admin") throw bad("forbidden", 403);
}

async function startSession(c, userId) {
  const token = U.newToken();
  await query("insert into public.sessions (token_hash, user_id, expires_at) values ($1, $2, now() + ($3 || ' days')::interval)", [U.sha256(token), userId, String(U.SESSION_DAYS)]);
  c.res.setHeader("Set-Cookie", U.sessionCookie(c.req, token, U.SESSION_DAYS * 86400));
}

// ---------- auth ----------
async function register(c) {
  const b = await c.body();
  const email = str(b.email, 254).toLowerCase();
  const pw = typeof b.password === "string" ? b.password : "";
  const name = str(b.name, 120), phone = str(b.phone, 40);
  if (!EMAIL.test(email) || !name) throw bad("invalid");
  if (pw.length < 8 || pw.length > 200) throw bad("weak");
  const key = "reg|" + U.clientIp(c.req);
  const recent = await query("select count(*)::int as n from public.auth_attempts where key = $1 and at > now() - interval '1 hour'", [key]);
  if (recent.rows[0].n >= 10) throw bad("too_many", 429);
  await query("insert into public.auth_attempts (key) values ($1)", [key]);
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const hash = await U.hashPassword(pw);
  let row;
  try {
    // ADMIN_EMAIL bilan ro'yxatdan o'tgan birinchi hisob admin bo'ladi (faqat hali admin yo'q bo'lsa).
    const r = await query(
      "insert into public.users (email, password_hash, full_name, phone, role) values ($1, $2, $3, $4, case when $5::boolean and not exists (select 1 from public.users where role = 'admin') then 'admin' else 'customer' end) returning id, email, full_name, phone, role",
      [email, hash, name, phone, !!adminEmail && email === adminEmail]
    );
    row = r.rows[0];
  } catch (e) {
    if (e.code === "23505") throw bad("exists", 409);
    throw e;
  }
  await startSession(c, row.id);
  U.send(c.res, 201, { user: userOut(row) });
}

async function login(c) {
  const b = await c.body();
  const email = str(b.email, 254).toLowerCase();
  const pw = typeof b.password === "string" ? b.password : "";
  const key = "login|" + email + "|" + U.clientIp(c.req);
  const recent = await query("select count(*)::int as n from public.auth_attempts where key = $1 and at > now() - interval '15 minutes'", [key]);
  if (recent.rows[0].n >= 8) throw bad("too_many", 429);
  const r = await query("select id, email, password_hash, full_name, phone, role from public.users where lower(email) = $1", [email]);
  const row = r.rows[0];
  // Foydalanuvchi topilmasa ham parolni hisoblaymiz, shunda javob vaqti farq qilmaydi.
  const ok = await U.verifyPassword(pw, row ? row.password_hash : "s1$00$00");
  if (!row || !ok) {
    await query("insert into public.auth_attempts (key) values ($1)", [key]);
    throw bad("bad_credentials", 401);
  }
  await query("delete from public.auth_attempts where key = $1", [key]);
  await query("delete from public.auth_attempts where at < now() - interval '1 day'");
  await query("delete from public.sessions where expires_at < now()");
  await startSession(c, row.id);
  U.send(c.res, 200, { user: userOut(row) });
}

async function logout(c) {
  const tok = U.parseCookies(c.req)[U.COOKIE];
  if (tok) await query("delete from public.sessions where token_hash = $1", [U.sha256(tok)]);
  c.res.setHeader("Set-Cookie", U.sessionCookie(c.req, "", 0));
  U.send(c.res, 200, { ok: true });
}

async function me(c) { U.send(c.res, 200, { user: c.user }); }

async function updateProfile(c) {
  need(c);
  const b = await c.body();
  await query("update public.users set full_name = $1, phone = $2 where id = $3", [str(b.name, 120), str(b.phone, 40), c.user.id]);
  U.send(c.res, 200, { ok: true });
}

// ---------- products ----------
function cleanProduct(b) {
  const name = str(b.name, 120);
  if (!name) throw bad("name");
  if (CATS.indexOf(b.cat) < 0) throw bad("category");
  const pr = toInt(b.pr);
  if (pr == null || pr < 0 || pr > 1000000000) throw bad("price");
  const old = b.old == null || b.old === "" ? null : toInt(b.old);
  if (old != null && (old <= pr || old > 1000000000)) throw bad("old_price");
  let img = typeof b.img === "string" ? b.img.trim() : "";
  if (img && !/^(\/api\/files\/[0-9a-f-]{36}|https?:\/\/[^\s]{1,500})$/i.test(img)) img = "";
  const desc = {};
  ["uz", "ru", "en", "kaa"].forEach((l) => { const s = str(b.desc && b.desc[l], 2000); if (s) desc[l] = s; });
  return {
    name, category: b.cat,
    type_key: /^[a-z0-9_]{1,30}$/.test(b.ty || "") ? b.ty : "other",
    kind: KINDS.indexOf(b.k) > -1 ? b.k : "set",
    color: /^#[0-9a-f]{3,8}$/i.test(b.c || "") ? b.c : "#e3a9b2",
    price: pr, old_price: old, image_url: img || null, description: desc,
    is_new: !!b.isNew, is_week: !!b.wk, in_stock: b.stock !== false, active: b.active !== false, sort: toInt(b.sort) || 0
  };
}
const PCOLS = ["name", "category", "type_key", "kind", "color", "price", "old_price", "image_url", "description", "is_new", "is_week", "in_stock", "active", "sort"];
const pvals = (p) => PCOLS.map((k) => (k === "description" ? JSON.stringify(p[k]) : p[k]));

async function listProducts(c) {
  const where = isStaff(c.user) ? "" : "where active";
  const r = await query("select * from public.products " + where + " order by sort, created_at desc");
  U.send(c.res, 200, { products: r.rows.map(productOut) });
}
async function createProduct(c) {
  need(c, "staff");
  const p = cleanProduct(await c.body());
  const r = await query("insert into public.products (" + PCOLS.join(", ") + ") values (" + PCOLS.map((_, i) => "$" + (i + 1) + (PCOLS[i] === "description" ? "::jsonb" : "")).join(", ") + ") returning *", pvals(p));
  U.send(c.res, 201, { product: productOut(r.rows[0]) });
}
async function updateProduct(c) {
  need(c, "staff");
  const p = cleanProduct(await c.body());
  const sets = PCOLS.map((k, i) => k + " = $" + (i + 1) + (k === "description" ? "::jsonb" : "")).join(", ");
  const r = await query("update public.products set " + sets + " where id = $" + (PCOLS.length + 1) + " returning *", pvals(p).concat([c.m[1]]));
  if (!r.rows[0]) throw bad("not_found", 404);
  U.send(c.res, 200, { product: productOut(r.rows[0]) });
}
async function deleteProduct(c) {
  need(c, "staff");
  await query("delete from public.products where id = $1", [c.m[1]]);
  U.send(c.res, 200, { ok: true });
}
async function seedProducts(c) {
  need(c, "staff");
  const n = await tx(async (cl) => {
    const have = await cl.query("select count(*)::int as n from public.products");
    if (have.rows[0].n > 0) throw bad("not_empty", 409);
    for (const s of SEED) {
      const p = cleanProduct({ name: s.name, cat: s.category, ty: s.type_key, k: s.kind, c: s.color, pr: s.price, old: s.old_price, isNew: s.is_new, wk: s.is_week, sort: s.sort });
      await cl.query("insert into public.products (" + PCOLS.join(", ") + ") values (" + PCOLS.map((_, i) => "$" + (i + 1) + (PCOLS[i] === "description" ? "::jsonb" : "")).join(", ") + ")", pvals(p));
    }
    return SEED.length;
  });
  U.send(c.res, 201, { count: n });
}

// ---------- files ----------
async function uploadFile(c) {
  need(c);
  const b = await c.body(2200000);
  const kind = b.kind === "product" ? "product" : "patient";
  if (kind === "product") need(c, "staff");
  const buf = Buffer.from(String(b.data || ""), "base64");
  if (!buf.length || buf.length > 1500000) throw bad("bad_image");
  const mime = U.imageMime(buf);
  if (!mime) throw bad("bad_image");
  const recent = await query("select count(*)::int as n from public.files where owner_id = $1 and created_at > now() - interval '1 hour'", [c.user.id]);
  if (recent.rows[0].n >= 40) throw bad("too_many", 429);
  const r = await query("insert into public.files (kind, owner_id, mime, data) values ($1, $2, $3, $4) returning id", [kind, c.user.id, mime, buf]);
  U.send(c.res, 201, { id: r.rows[0].id, url: "/api/files/" + r.rows[0].id });
}
async function getFile(c) {
  const r = await query("select kind, owner_id, mime, data from public.files where id = $1", [c.m[1]]);
  const f = r.rows[0];
  if (!f) throw bad("not_found", 404);
  if (f.kind === "patient" && (!c.user || (c.user.id !== f.owner_id && !isStaff(c.user)))) throw bad("not_found", 404);
  c.res.statusCode = 200;
  c.res.setHeader("Content-Type", f.mime);
  c.res.setHeader("Cache-Control", f.kind === "product" ? "public, max-age=31536000, immutable" : "private, no-store");
  c.res.end(f.data);
}

// ---------- orders ----------
async function createOrder(c) {
  need(c);
  const b = await c.body();
  const name = str(b.name, 120), phone = str(b.phone, 40), address = str(b.address, 400), note = str(b.note, 400);
  if (!name || !phone) throw bad("missing_contact");
  const lat = typeof b.lat === "number" && b.lat >= -90 && b.lat <= 90 ? b.lat : null;
  const lng = typeof b.lng === "number" && b.lng >= -180 && b.lng <= 180 ? b.lng : null;
  if (!address && (lat == null || lng == null)) throw bad("missing_address");
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 60) throw bad("empty_cart");
  const want = {};
  b.items.forEach((it) => {
    if (it && typeof it.id === "string" && UUID.test(it.id)) {
      const q = Math.max(1, Math.min(99, toInt(it.qty) || 1));
      want[it.id] = Math.min(99, (want[it.id] || 0) + q);
    }
  });
  const ids = Object.keys(want);
  if (!ids.length) throw bad("no_valid_items");
  const id = await tx(async (cl) => {
    const pr = await cl.query("select id, name, price from public.products where id = any($1::uuid[]) and active and in_stock", [ids]);
    if (!pr.rows.length) throw bad("no_valid_items");
    let total = 0;
    pr.rows.forEach((p) => { total += p.price * want[p.id]; });
    const o = await cl.query(
      "insert into public.orders (user_id, customer_name, phone, address, note, lat, lng, total) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id",
      [c.user.id, name, phone, address, note, lat, lng, total]
    );
    for (const p of pr.rows) {
      await cl.query("insert into public.order_items (order_id, product_id, name, price, qty) values ($1, $2, $3, $4, $5)", [o.rows[0].id, p.id, p.name, p.price, want[p.id]]);
    }
    return Number(o.rows[0].id);
  });
  U.send(c.res, 201, { id });
}
const ORDER_SQL = "select o.*, coalesce(json_agg(json_build_object('name', i.name, 'price', i.price, 'qty', i.qty) order by i.id) filter (where i.id is not null), '[]'::json) as items from public.orders o left join public.order_items i on i.order_id = o.id ";
async function myOrders(c) {
  need(c);
  const r = await query(ORDER_SQL + "where o.user_id = $1 group by o.id order by o.created_at desc", [c.user.id]);
  U.send(c.res, 200, { orders: r.rows.map(orderOut) });
}
async function allOrders(c) {
  need(c, "staff");
  const r = await query(ORDER_SQL + "group by o.id order by o.created_at desc limit 500");
  U.send(c.res, 200, { orders: r.rows.map(orderOut) });
}
async function setOrderStatus(c) {
  need(c, "staff");
  const b = await c.body();
  if (STATUSES.indexOf(b.status) < 0) throw bad("invalid");
  await query("update public.orders set status = $1 where id = $2", [b.status, c.m[1]]);
  U.send(c.res, 200, { ok: true });
}

// ---------- consultations (bemorlar bazasi) ----------
async function createConsultation(c) {
  need(c);
  const b = await c.body(600000);
  const summary = str(b.summary, 30000);
  if (!summary) throw bad("invalid");
  const staff = isStaff(c.user);
  const forSelf = staff ? b.forSelf === true : true;
  const photos = [];
  for (const p of Array.isArray(b.photos) ? b.photos.slice(0, 6) : []) {
    if (!p || typeof p.path !== "string" || !UUID.test(p.path)) continue;
    const f = await query("select owner_id from public.files where id = $1 and kind = 'patient'", [p.path]);
    if (f.rows[0] && (f.rows[0].owner_id === c.user.id || staff)) photos.push({ slot: str(p.slot, 20), path: p.path });
  }
  await query(
    "insert into public.consultations (user_id, created_by, patient_name, patient_phone, city, lang, answers, summary, photos) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb)",
    [forSelf ? c.user.id : null, c.user.id, str(b.name, 120), str(b.phone, 40), str(b.city, 80), ["uz", "ru", "en", "kaa"].indexOf(b.lang) > -1 ? b.lang : "uz", JSON.stringify(b.answers && typeof b.answers === "object" ? b.answers : {}), summary, JSON.stringify(photos)]
  );
  U.send(c.res, 201, { ok: true });
}
async function listConsultations(c) {
  need(c, "staff");
  const r = await query("select * from public.consultations order by created_at desc limit 500");
  U.send(c.res, 200, { consultations: r.rows.map(consultOut) });
}
async function setConsultationNote(c) {
  need(c, "staff");
  const b = await c.body();
  await query("update public.consultations set staff_note = $1, updated_at = now() where id = $2", [str(b.note, 5000), c.m[1]]);
  U.send(c.res, 200, { ok: true });
}

// ---------- users ----------
async function listUsers(c) {
  need(c, "staff");
  const r = await query("select id, email, full_name, phone, role, created_at from public.users order by created_at desc limit 1000");
  U.send(c.res, 200, { users: r.rows.map((x) => ({ id: x.id, email: x.email, name: x.full_name, phone: x.phone, role: x.role, created: iso(x.created_at) })) });
}
async function setRole(c) {
  need(c, "admin");
  const b = await c.body();
  if (ROLES.indexOf(b.role) < 0) throw bad("invalid");
  if (c.m[1] === c.user.id) throw bad("cannot_change_own_role", 403);
  await query("update public.users set role = $1 where id = $2", [b.role, c.m[1]]);
  await query("delete from public.sessions where user_id = $1", [c.m[1]]);
  U.send(c.res, 200, { ok: true });
}

async function health(c) {
  try {
    await ensureSchema();
    U.send(c.res, 200, { backend: true, ok: true });
  } catch (e) {
    console.error("health check failed:", e && e.message);
    U.send(c.res, 503, { backend: true, ok: false, error: hint(e) });
  }
}

// ---------- marshrutlar ----------
const routes = [];
const add = (method, path, fn) => routes.push([method, new RegExp("^" + path + "$", "i"), fn]);
add("GET", "/health", health);
add("POST", "/auth/register", register);
add("POST", "/auth/login", login);
add("POST", "/auth/logout", logout);
add("GET", "/auth/me", me);
add("PATCH", "/auth/profile", updateProfile);
add("GET", "/products", listProducts);
add("POST", "/products", createProduct);
add("POST", "/products/seed", seedProducts);
add("PUT", "/products/([0-9a-f-]{36})", updateProduct);
add("DELETE", "/products/([0-9a-f-]{36})", deleteProduct);
add("POST", "/files", uploadFile);
add("GET", "/files/([0-9a-f-]{36})", getFile);
add("POST", "/orders", createOrder);
add("GET", "/orders/mine", myOrders);
add("GET", "/orders", allOrders);
add("PATCH", "/orders/(\\d{1,18})", setOrderStatus);
add("POST", "/consultations", createConsultation);
add("GET", "/consultations", listConsultations);
add("PATCH", "/consultations/(\\d{1,18})", setConsultationNote);
add("GET", "/users", listUsers);
add("POST", "/users/([0-9a-f-]{36})/role", setRole);

module.exports = async function handler(req, res) {
  try {
    const path = new URL(req.url, "http://x").pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
    const method = req.method === "HEAD" ? "GET" : req.method;
    // CSRF: boshqa saytdan kelgan o'zgartiruvchi so'rovlarni rad etamiz.
    if (method !== "GET" && req.headers.origin) {
      let host = "";
      try { host = new URL(req.headers.origin).host; } catch (_) { /* noto'g'ri Origin */ }
      if (host !== req.headers.host) return U.send(res, 403, { error: "forbidden" });
    }
    let match = null, handlerFn = null, pathKnown = false;
    for (const r of routes) {
      const m = r[1].exec(path);
      if (!m) continue;
      pathKnown = true;
      if (r[0] === method) { match = m; handlerFn = r[2]; break; }
    }
    if (!handlerFn) return U.send(res, pathKnown ? 405 : 404, { error: pathKnown ? "method_not_allowed" : "not_found" });
    const c = { req, res, m: match, user: null, _body: null };
    c.body = async (limit) => { if (c._body == null) c._body = await U.readJson(req, limit); return c._body; };
    if (path !== "/health") c.user = await currentUser(req);
    await handlerFn(c);
  } catch (e) {
    if (e && e.status) return U.send(res, e.status, { error: e.code || e.message });
    console.error("api error:", e && (e.stack || e.message));
    if (e && e.code === "NO_DB_URL") return U.send(res, 503, { backend: true, ok: false, error: hint(e) });
    U.send(res, 500, { error: "server" });
  }
};
