// /config.js so'rovi shu funksiyaga yo'naltiriladi (vercel.json). Faqat do'kon ma'lumotlari beriladi, maxfiy narsa yo'q.
module.exports = function handler(req, res) {
  const env = process.env;
  const cfg = {
    telegram: env.TELEGRAM_USERNAME || "",
    phone: env.SHOP_PHONE || "",
    instagram: env.INSTAGRAM_USERNAME || "LiberCosmetic",
    shopAddress: env.SHOP_ADDRESS || "",
    mapUrl: env.MAP_URL || ""
  };
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.statusCode = 200;
  res.end("window.LIBER_CONFIG = " + JSON.stringify(cfg).replace(/</g, "\\u003c") + ";\n");
};
