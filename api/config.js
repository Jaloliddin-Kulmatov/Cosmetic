// Vercel serverless funksiyasi. /config.js so'rovi shu yerga yo'naltiriladi (vercel.json).
// Sozlamalar Vercel Environment Variables dan olinadi, shuning uchun kalitlar kodda saqlanmaydi.

function decodeRole(key) {
  try {
    var part = String(key).split(".")[1];
    if (!part) return "";
    var json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json).role || "";
  } catch (e) {
    return "";
  }
}

module.exports = function handler(req, res) {
  var env = process.env;
  var url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
  var key = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  var problem = "";

  // Brauzerga faqat ochiq (anon/publishable) kalit berilishi kerak. Maxfiy kalit bo'lsa, uni umuman yubormaymiz.
  if (/^sb_secret_/.test(key) || decodeRole(key) === "service_role") {
    problem = "SUPABASE_ANON_KEY maxfiy (service_role) kalit. Ochiq anon kalitni qo'ying.";
    key = "";
  }
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url)) {
    problem = problem || "SUPABASE_URL noto'g'ri ko'rinadi. Namuna: https://abcdefgh.supabase.co";
  }

  var cfg = {
    supabaseUrl: problem ? "" : url.replace(/\/$/, ""),
    supabaseAnonKey: problem ? "" : key,
    telegram: env.TELEGRAM_USERNAME || "",
    phone: env.SHOP_PHONE || "",
    instagram: env.INSTAGRAM_USERNAME || "LiberCosmetic",
    shopAddress: env.SHOP_ADDRESS || "",
    mapUrl: env.MAP_URL || ""
  };

  var body = "window.LIBER_CONFIG = " + JSON.stringify(cfg).replace(/</g, "\\u003c") + ";\n";
  if (problem) body += "console.error(" + JSON.stringify("Liber: " + problem) + ");\n";

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.statusCode = 200;
  res.end(body);
};
