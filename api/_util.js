// HTTP yordamchilari, parol va sessiya xavfsizligi.
const crypto = require("crypto");

const COOKIE = "liber_sid";
const SESSION_DAYS = 30;

function send(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (headers) Object.keys(headers).forEach((k) => res.setHeader(k, headers[k]));
  res.end(JSON.stringify(body));
}

async function readJson(req, limit) {
  const max = limit || 2000000;
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let raw;
  if (typeof req.body === "string") raw = req.body;
  else if (Buffer.isBuffer(req.body)) raw = req.body.toString("utf8");
  else {
    const chunks = [];
    let size = 0;
    for await (const ch of req) {
      size += ch.length;
      if (size > max) { const e = new Error("too_large"); e.status = 413; throw e; }
      chunks.push(ch);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  if (raw.length > max) { const e = new Error("too_large"); e.status = 413; throw e; }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { const e = new Error("bad_json"); e.status = 400; throw e; }
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function isHttps(req) {
  return String(req.headers["x-forwarded-proto"] || "").split(",")[0] === "https";
}

function sessionCookie(req, token, maxAge) {
  return COOKIE + "=" + encodeURIComponent(token) + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + maxAge + (isHttps(req) ? "; Secure" : "");
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

function scrypt(pw, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt);
  return "s1$" + salt.toString("hex") + "$" + key.toString("hex");
}
async function verifyPassword(pw, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "s1") return false;
  const key = await scrypt(pw, Buffer.from(parts[1], "hex"));
  const want = Buffer.from(parts[2], "hex");
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "").split(",")[0].trim();
}

// Rasm haqiqatan ham rasm ekanini birinchi baytlardan tekshiramiz (boshqa kontent saytimiz nomidan berilmasin).
function imageMime(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf.slice(1, 4).toString() === "PNG") return "image/png";
  if (buf.length > 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return "";
}

module.exports = { COOKIE, SESSION_DAYS, send, readJson, parseCookies, sessionCookie, sha256, newToken, hashPassword, verifyPassword, clientIp, imageMime };
