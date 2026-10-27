// Interfeys: do'kon, kirish/ro'yxatdan o'tish, buyurtma, konsultatsiya anketasi va xodimlar paneli.
(function (L) {
  "use strict";
  var C = window.LIBER_CONFIG || {};
  var D = L.D, TY = L.TY, SEC = L.SEC, CUR = L.CUR, api = L.api, art = L.art, scene = L.scene;
  var LANGS = L.LANGS, LNAMES = L.LNAMES, LTITLES = L.LTITLES;
  var LI = 0;

  // ---------- yordamchilar ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var t = function (k) { return D[k][LI]; };
  var tu = function (k) { return D[k][0]; };
  var Lg = function (tp) { return tp[LI]; };
  var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
  var today = function () { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var fmtDate = function (v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? m[3] + "." + m[2] + "." + m[1] : (v || ""); };
  var fmtDT = function (iso) { var d = new Date(iso); return isNaN(d) ? "" : pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  var num = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); };
  var fmt = function (n) { return num(n) + " " + CUR[LI]; };
  var fmtUz = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm"; };
  var safeColor = function (c) { return /^#[0-9a-f]{3,8}$/i.test(c || "") ? c : "#e3a9b2"; };
  var safeUrl = function (u) { return /^(https?:\/\/|data:image\/)/i.test(u || "") ? u : ""; };
  var mapUrl = function (lat, lng) { return "https://www.google.com/maps?q=" + encodeURIComponent(lat + "," + lng); };
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function jget(k, d) { try { var s = sget(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }
  var isStaff = function (u) { return !!u && (u.role === "staff" || u.role === "admin"); };
  var isAdmin = function (u) { return !!u && u.role === "admin"; };

  function tgHref(text) {
    var q = encodeURIComponent(text), u = (C.telegram || "").replace(/^@/, "");
    return u ? "https://t.me/" + encodeURIComponent(u) + "?text=" + q : "https://t.me/share/url?url=%20&text=" + q;
  }
  var toastT = 0;
  function toast(msg) { var el = $("#toast"); el.textContent = msg; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove("on"); }, 2000); }
  function copyFrom(node, text, st) {
    var ok = function () { st.className = "status"; st.textContent = t("copied"); };
    var fb = function () {
      var r = document.createRange(); r.selectNodeContents(node);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      var done = false; try { done = document.execCommand("copy"); } catch (e) {}
      st.className = "status"; st.textContent = done ? t("copied") : t("selected");
    };
    try { navigator.clipboard.writeText(text).then(ok, fb); } catch (e) { fb(); }
  }
  function setStatus(sel, msg, isErr) { var s = $(sel); if (s) { s.className = "status" + (isErr ? " err" : ""); s.textContent = msg; } }
  function errText(e) {
    var c = e && e.code;
    if (c === "bad_credentials") return t("auth.bad");
    if (c === "exists") return t("auth.exists");
    if (c === "weak") return t("auth.weak");
    if (c === "unconfirmed") return t("auth.confirm");
    return t("err.generic");
  }

  // ---------- holat ----------
  var ROUTES = ["home", "parfyumeriya", "pardoz", "parvarish", "toplamlar", "aksiyalar", "konsultatsiya", "savat", "qidiruv", "mahsulot", "kirish", "hisob", "panel"];
  var TOKEN = { home: "bosh" };
  var S = {
    route: "home", params: {}, products: [], pLoaded: false, user: null,
    cart: jget("liber-cart-v1", {}), A: jget("liber-anketa-v2", {}), O: { name: "", phone: "", address: "", note: "", lat: null, lng: null },
    query: "", heroI: 0, authMode: "login", next: "home", orderDone: null,
    consult: { done: false, staffMode: false }, photoFiles: {}, myOrders: null,
    panel: { tab: "products", draft: null, orders: null, patients: null, profiles: null, q: "", statusFilter: "", confirmDel: null }
  };
  var view = $("#view");
  var PBY = function () { var m = {}; S.products.forEach(function (p) { m[p.id] = p; }); return m; };
  var shop = function () { return S.products.filter(function (p) { return p.active; }); };

  // ---------- mahsulot kartasi ----------
  function pimg(p) { var u = safeUrl(p.img); return u ? '<img src="' + esc(u) + '" alt="' + esc(p.name) + '" loading="lazy">' : art(p.k, safeColor(p.c)); }
  function tyName(p) { return TY[p.ty] ? Lg(TY[p.ty]) : Lg(TY.other); }
  function priceHtml(p) { return (p.old ? "<s>" + fmt(p.old) + "</s>" : "") + fmt(p.pr); }
  function card(p) {
    var tag = !p.stock ? '<span class="badge out">' + esc(t("pd.out")) + "</span>" : p.old ? '<span class="badge sale">' + esc(t("tag.sale")) + "</span>" : p.isNew ? '<span class="badge">' + esc(t("tag.new")) + "</span>" : "";
    return '<article class="card" data-go="mahsulot" data-id="' + esc(p.id) + '" style="--c:' + safeColor(p.c) + '"><div class="tile">' + tag + pimg(p) + '</div><div class="cbody"><p class="ty">' + esc(tyName(p)) + '</p><h3><a href="#mahsulot" data-go="mahsulot" data-id="' + esc(p.id) + '">' + esc(p.name) + '</a></h3><div class="price">' + priceHtml(p) + '</div><button class="btn sm" type="button" data-act="add" data-id="' + esc(p.id) + '"' + (p.stock ? "" : " disabled") + ">" + esc(t("add")) + "</button></div></article>";
  }
  function carousel(id, title, list) {
    return '<div><div class="sechead"><h2>' + esc(title) + '</h2><div class="arrows"><button type="button" data-act="scroll" data-dir="-1" data-target="' + id + '" aria-label="←">‹</button><button type="button" data-act="scroll" data-dir="1" data-target="' + id + '" aria-label="→">›</button></div></div><div class="row" id="' + id + '">' + list.map(card).join("") + "</div></div>";
  }
  function skeletons(n) { var h = ""; for (var i = 0; i < n; i++) h += '<div class="skel"></div>'; return '<div class="grid">' + h + "</div>"; }
  function promo() {
    return '<section class="promo"><div class="wrap promo-in"><div><h2>' + esc(t("promo.t")) + "</h2><p>" + esc(t("promo.p")) + '</p></div><a class="btn" href="#konsultatsiya" data-go="konsultatsiya">' + esc(t("promo.b")) + "</a></div></section>";
  }

  // ---------- ko'rinishlar: do'kon ----------
  function viewHome() {
    var h1 = esc(t("h1.t")).replace("Liber", "<em>Liber</em>");
    var s1 = '<div class="slide" data-i="0"' + (S.heroI ? " hidden" : "") + '><div class="wrap slide-in"><div><p class="eyebrow-g">' + esc(t("eyebrow.new")) + "</p><h1>" + h1 + "</h1><p>" + esc(t("h1.p")) + '</p><a class="btn" href="#parfyumeriya" data-go="parfyumeriya">' + esc(t("h1.b")) + '</a></div><div class="arch">' + scene(0) + "</div></div></div>";
    var s2 = '<div class="slide" data-i="1"' + (S.heroI ? "" : " hidden") + '><div class="wrap slide-in"><div><p class="eyebrow-g">' + esc(t("eyebrow.care")) + "</p><h1>" + esc(t("h2.t")) + "</h1><p>" + esc(t("h2.p")) + '</p><a class="btn" href="#konsultatsiya" data-go="konsultatsiya">' + esc(t("h2.b")) + '</a></div><div class="arch">' + scene(1) + "</div></div></div>";
    var dots = '<div class="dots">' + [0, 1].map(function (i) { return '<button type="button" data-act="hero" data-i="' + i + '" aria-label="' + (i + 1) + '" aria-current="' + (S.heroI === i) + '"></button>'; }).join("") + "</div>";
    var perks = '<div class="perks"><div class="wrap">' + ["perk1", "perk2", "perk3"].map(function (k) { return '<div class="perk"><div><b>' + esc(t(k + ".t")) + "</b><span>" + esc(t(k + ".p")) + "</span></div></div>"; }).join("") + "</div></div>";
    var cats = [["parfyumeriya", "perfume", "#e3a9b2"], ["pardoz", "lipstick", "#a85a60"], ["parvarish", "serum", "#e8c98e"], ["toplamlar", "set", "#cda0a8"]];
    var catHtml = '<div class="wrap block"><div class="sechead"><h2>' + esc(t("cat.t")) + '</h2></div><div class="cats">' + cats.map(function (c) { return '<a class="cat" href="#' + c[0] + '" data-go="' + c[0] + '" style="--c:' + c[2] + '"><div class="arch-s">' + art(c[1], c[2]) + "</div><span>" + esc(t("nav." + c[0])) + "</span></a>"; }).join("") + "</div></div>";
    var list = shop(), body;
    if (!S.pLoaded) body = skeletons(4);
    else body = '<div class="twin">' + carousel("rowNew", t("sec.new"), list.filter(function (p) { return p.isNew; })) + carousel("rowWeek", t("sec.week"), list.filter(function (p) { return p.wk; })) + "</div>";
    return '<section class="hero">' + s1 + s2 + dots + "</section>" + perks + catHtml + '<div class="wrap block">' + body + "</div>" + promo();
  }
  function viewCat(r) {
    var list = shop().filter(function (p) { return r === "aksiyalar" ? !!p.old : p.cat === r; });
    var body = !S.pLoaded ? skeletons(8) : list.length ? '<div class="grid">' + list.map(card).join("") + "</div>" : '<p class="empty">' + esc(t("cat.none")) + "</p>";
    return '<div class="wrap page"><h1>' + esc(t("nav." + r)) + "</h1>" + body + "</div>" + (r === "parvarish" ? promo() : "");
  }
  function viewSearch() {
    var q = S.query.trim().toLowerCase();
    var list = q ? shop().filter(function (p) { return (p.name + " " + (TY[p.ty] || TY.other).join(" ")).toLowerCase().indexOf(q) > -1; }) : [];
    return '<div class="wrap page"><h1>' + esc(t("res.t")) + (q ? ": " + esc(S.query.trim()) : "") + "</h1>" + (list.length ? '<div class="grid">' + list.map(card).join("") + "</div>" : '<p class="empty">' + esc(t("res.none")) + "</p>") + "</div>";
  }
  function viewProduct() {
    var p = PBY()[S.params.id];
    if (!S.pLoaded) return '<div class="wrap page">' + skeletons(1) + "</div>";
    if (!p) return '<div class="wrap page"><p class="empty">' + esc(t("res.none")) + '</p><a class="btn" href="#bosh" data-go="home">' + esc(t("cart.cont")) + "</a></div>";
    var d = p.desc || {}, txt = d[LANGS[LI]] || d.uz || d.ru || d.en || d.kaa || "";
    var more = shop().filter(function (x) { return x.cat === p.cat && x.id !== p.id; }).slice(0, 4);
    return '<div class="wrap page"><button class="back" type="button" data-act="back">← ' + esc(t("pd.back")) + '</button><div class="pd"><div class="tile" style="--c:' + safeColor(p.c) + '">' + pimg(p) + '</div><div><p class="ty">' + esc(tyName(p)) + "</p><h1>" + esc(p.name) + '</h1><div class="price">' + priceHtml(p) + '</div><div class="stock' + (p.stock ? "" : " out") + '">' + esc(t(p.stock ? "pd.in" : "pd.out")) + '</div><p class="desc">' + (txt ? esc(txt) : esc(t("pd.none"))) + '</p><button class="btn" type="button" data-act="add" data-id="' + esc(p.id) + '"' + (p.stock ? "" : " disabled") + ">" + esc(t("add")) + "</button></div></div>" +
      (more.length ? '<div class="block"><div class="sechead"><h2>' + esc(t("pd.more")) + '</h2></div><div class="grid">' + more.map(card).join("") + "</div></div>" : "") + "</div>";
  }

  // ---------- savat va buyurtma ----------
  function cartItems() { var m = PBY(); return Object.keys(S.cart).filter(function (id) { return m[id] && m[id].active && S.cart[id] > 0; }); }
  function cartCount() { return cartItems().reduce(function (s, id) { return s + S.cart[id]; }, 0); }
  function cartTotal() { var m = PBY(); return cartItems().reduce(function (s, id) { return s + m[id].pr * S.cart[id]; }, 0); }
  function saveCart() { sset("liber-cart-v1", JSON.stringify(S.cart)); }
  function viewCart() {
    if (S.orderDone) return '<div class="wrap page"><div class="success"><div class="check">✓</div><h1>' + esc(t("co.ok.t")) + "</h1><p>" + esc(t("co.ok.p")) + " <strong>#" + esc(S.orderDone) + "</strong></p><p>" + esc(t("co.ok.s")) + '</p><div class="actions" style="justify-content:center"><a class="btn" href="#hisob" data-go="hisob">' + esc(t("acc")) + '</a><a class="btn ghost" href="#bosh" data-go="home">' + esc(t("cart.cont")) + "</a></div></div></div>";
    var ids = cartItems(), m = PBY();
    if (!ids.length) return '<div class="wrap page"><h1>' + esc(t("cart")) + '</h1><p class="empty">' + esc(S.pLoaded ? t("cart.empty") : t("loading")) + '</p><a class="btn" href="#bosh" data-go="home">' + esc(t("cart.cont")) + "</a></div>";
    var lines = ids.map(function (id) {
      var p = m[id];
      return '<div class="line"><div class="tile" style="--c:' + safeColor(p.c) + '">' + pimg(p) + '</div><div><h3>' + esc(p.name) + '</h3><p class="ty">' + esc(tyName(p)) + '</p><div class="qty"><button type="button" data-act="qty" data-id="' + esc(id) + '" data-d="-1" aria-label="−">−</button><span>' + S.cart[id] + '</span><button type="button" data-act="qty" data-id="' + esc(id) + '" data-d="1" aria-label="+">+</button></div></div><div class="sum">' + fmt(p.pr * S.cart[id]) + '<button class="linkbtn" type="button" data-act="rm" data-id="' + esc(id) + '">' + esc(t("cart.rm")) + "</button></div></div>";
    }).join("");
    var o = S.O;
    if (S.user) { if (!o.name) o.name = S.user.name || ""; if (!o.phone) o.phone = S.user.phone || ""; }
    var panel;
    if (!S.user) {
      panel = '<p class="note" style="font-size:15px;color:var(--fg)">' + esc(t("co.need")) + '</p><div class="actions"><button class="btn" type="button" data-act="authgo" data-mode="login">' + esc(t("login")) + '</button><button class="btn ghost" type="button" data-act="authgo" data-mode="register">' + esc(t("register")) + "</button></div>";
    } else {
      panel = '<div class="field"><label for="o_name">' + esc(t("ord.name")) + '</label><input type="text" id="o_name" data-o="name" autocomplete="name" value="' + esc(o.name) + '"></div>' +
        '<div class="field"><label for="o_phone">' + esc(t("phone")) + '</label><input type="tel" id="o_phone" data-o="phone" autocomplete="tel" value="' + esc(o.phone) + '"></div>' +
        '<div class="field"><label for="o_address">' + esc(t("co.addr")) + '</label><textarea id="o_address" data-o="address" rows="2" autocomplete="street-address">' + esc(o.address) + "</textarea></div>" +
        '<div class="loc"><button class="btn ghost sm" type="button" data-act="geo">' + esc(t("loc.btn")) + '</button><span class="status" id="locStatus">' + (o.lat != null ? '<a class="maplink" href="' + esc(mapUrl(o.lat, o.lng)) + '" target="_blank" rel="noopener">' + esc(t("loc.ok")) + "</a>" : "") + "</span>" + (o.lat != null ? '<button class="linkbtn" type="button" data-act="geoclear">' + esc(t("loc.remove")) + "</button>" : "") + "</div>" +
        '<div class="field"><label for="o_note">' + esc(t("co.note")) + '</label><input type="text" id="o_note" data-o="note" value="' + esc(o.note) + '"></div>' +
        '<button class="btn full" type="button" data-act="placeorder">' + esc(t("co.place")) + '</button><div class="status" id="ordStatus" role="status"></div>';
    }
    return '<div class="wrap page"><h1>' + esc(t("cart")) + '</h1><div class="cart"><div class="lines">' + lines + '</div><div class="order"><h2>' + esc(t("co.t")) + '</h2><div class="total"><span>' + esc(t("cart.total")) + "</span><span>" + fmt(cartTotal()) + "</span></div>" + panel + "</div></div></div>";
  }
  function placeOrder() {
    var o = S.O;
    if (!o.name.trim() || !o.phone.trim() || (!o.address.trim() && o.lat == null)) { setStatus("#ordStatus", t("co.fill"), true); return; }
    var btn = $('[data-act="placeorder"]'); if (btn) btn.disabled = true;
    api.placeOrder({ name: o.name, phone: o.phone, address: o.address, note: o.note, lat: o.lat, lng: o.lng, items: cartItems().map(function (id) { return { id: id, qty: S.cart[id] }; }) })
      .then(function (id) { S.cart = {}; saveCart(); S.orderDone = id; S.O.address = ""; S.O.note = ""; S.O.lat = S.O.lng = null; S.myOrders = null; render(false); })
      .catch(function (e) { if (btn) btn.disabled = false; setStatus("#ordStatus", errText(e), true); });
  }
  function geo() {
    if (!navigator.geolocation) { setStatus("#locStatus", t("loc.fail"), true); return; }
    navigator.geolocation.getCurrentPosition(function (pos) { S.O.lat = +pos.coords.latitude.toFixed(6); S.O.lng = +pos.coords.longitude.toFixed(6); render(true); }, function () { setStatus("#locStatus", t("loc.fail"), true); }, { enableHighAccuracy: true, timeout: 12000 });
  }

  // ---------- kirish / ro'yxatdan o'tish / hisob ----------
  function viewAuth() {
    var reg = S.authMode === "register";
    return '<div class="wrap page"><div class="authbox"><h1>' + esc(t(reg ? "auth.reg.t" : "auth.login.t")) + '</h1><p class="sub">' + esc(t("auth.sub")) + '</p><div class="seg" role="group"><button type="button" data-act="authmode" data-mode="login" aria-pressed="' + !reg + '">' + esc(t("login")) + '</button><button type="button" data-act="authmode" data-mode="register" aria-pressed="' + reg + '">' + esc(t("register")) + '</button></div><form id="authForm" class="stack" novalidate>' +
      (reg ? '<div class="field"><label for="a_name">' + esc(t("name")) + '</label><input type="text" id="a_name" autocomplete="name"></div><div class="field"><label for="a_phone">' + esc(t("phone")) + '</label><input type="tel" id="a_phone" autocomplete="tel" placeholder="+998 ..."></div>' : "") +
      '<div class="field"><label for="a_email">' + esc(t("email")) + '</label><input type="email" id="a_email" autocomplete="email" inputmode="email"></div>' +
      '<div class="field"><label for="a_pw">' + esc(t("password")) + '</label>' + (reg ? '<span class="hint">' + esc(t("pw.hint")) + "</span>" : "") + '<input type="password" id="a_pw" autocomplete="' + (reg ? "new-password" : "current-password") + '"></div>' +
      '<button class="btn full" type="submit">' + esc(t(reg ? "register" : "login")) + '</button><div class="status err" id="authStatus" role="alert"></div></form></div></div>';
  }
  function submitAuth(form) {
    var reg = S.authMode === "register", email = $("#a_email").value.trim(), pw = $("#a_pw").value;
    var name = reg ? $("#a_name").value.trim() : "", phone = reg ? $("#a_phone").value.trim() : "";
    if (!email || !pw || (reg && !name)) { setStatus("#authStatus", t("auth.need"), true); return; }
    var btn = $('button[type="submit"]', form); btn.disabled = true;
    var p = reg ? api.signUp({ email: email, password: pw, name: name, phone: phone }) : api.signIn(email, pw).then(function () { return { needsConfirm: false }; });
    p.then(function (r) {
      if (r.needsConfirm) { btn.disabled = false; setStatus("#authStatus", t("auth.confirm"), false); $("#authStatus").className = "status"; return; }
      return refreshUser().then(function () { go(S.next || "home"); });
    }).catch(function (e) { btn.disabled = false; setStatus("#authStatus", errText(e), true); });
  }
  function refreshUser() { return api.me().then(function (u) { S.user = u; return u; }); }
  function viewAccount() {
    var u = S.user;
    var orders = S.myOrders === null ? '<p class="empty">' + esc(t("loading")) + "</p>" : !S.myOrders.length ? '<p class="empty">' + esc(t("ac.none")) + "</p>" : S.myOrders.map(function (o) { return orderCard(o, false); }).join("");
    return '<div class="wrap page"><div class="ac-head"><h1>' + esc(t("ac.hello")) + ", " + esc(u.name || u.email || "") + (u.role !== "customer" ? '<span class="role">' + esc(u.role) + "</span>" : "") + '</h1><div class="actions">' + (isStaff(u) ? '<a class="btn" href="#panel" data-go="panel">' + esc(t("ac.panel")) + "</a>" : "") + '<button class="btn ghost" type="button" data-act="logout">' + esc(t("logout")) + '</button></div></div><div class="cols"><div class="panel"><h2>' + esc(t("acc")) + '</h2><form id="profForm" class="stack"><div class="field"><label for="p_name">' + esc(t("name")) + '</label><input type="text" id="p_name" value="' + esc(u.name) + '"></div><div class="field"><label for="p_phone">' + esc(t("phone")) + '</label><input type="tel" id="p_phone" value="' + esc(u.phone) + '"></div><div class="field"><label>' + esc(t("email")) + '</label><input type="text" value="' + esc(u.email) + '" disabled></div><button class="btn" type="submit">' + esc(t("ac.save")) + '</button><div class="status" id="profStatus"></div></form></div><div><div class="sechead"><h2>' + esc(t("ac.orders")) + "</h2></div>" + orders + "</div></div></div>";
  }
  function orderCard(o, staff) {
    var stLbl = function (s) { return staff ? tu("st." + s) : t("st." + s); };
    var items = o.items.map(function (i) { return "<li><span>" + esc(i.name) + " × " + i.qty + "</span><span>" + fmt(i.price * i.qty) + "</span></li>"; }).join("");
    var head = '<div class="ord-h"><div><strong>#' + esc(o.id) + '</strong> <span class="meta" style="color:var(--muted);font-size:13px">' + esc(fmtDT(o.created)) + '</span></div>' +
      (staff ? '<select data-act="ostatus" data-id="' + esc(o.id) + '" aria-label="Holat" style="width:auto">' + ["new", "confirmed", "shipped", "done", "cancelled"].map(function (s) { return '<option value="' + s + '"' + (o.status === s ? " selected" : "") + ">" + esc(stLbl(s)) + "</option>"; }).join("") + "</select>" : '<span class="pill ' + esc(o.status) + '">' + esc(stLbl(o.status)) + "</span>") + "</div>";
    var who = staff ? '<p style="margin:0 0 8px;font-size:14px"><strong>' + esc(o.name) + "</strong> · " + esc(o.phone) + (o.address ? "<br>" + esc(o.address) : "") + (o.lat != null ? '<br><a class="maplink" href="' + esc(mapUrl(o.lat, o.lng)) + '" target="_blank" rel="noopener">Xaritada ochish</a>' : "") + (o.note ? "<br><em>" + esc(o.note) + "</em>" : "") + "</p>" : "";
    return '<div class="ord">' + head + who + "<ul>" + items + '</ul><div class="tot">' + fmt(o.total) + "</div></div>";
  }

  // ---------- konsultatsiya anketasi ----------
  var FM = {}; SEC.forEach(function (s) { (s.fields || []).forEach(function (f) { FM[f.id] = f; }); });
  var SLOTS = [["front", "ph.front", "yuzdan"], ["right", "ph.right", "o'ng tomondan"], ["left", "ph.left", "chap tomondan"], ["close", "ph.close", "muammo joyi"]];
  function consultView() { return S.consult.done ? consultDone() : consultForm(); }
  function consultForm() {
    var A = S.A; if (!A.sana) A.sana = today();
    var h = '<div class="bar"><div class="in"><div class="track" aria-hidden="true"><i id="fill"></i></div><span id="count" aria-live="polite"></span></div></div><div class="in"><div class="fhero"><p class="eyebrow">' + esc(S.consult.staffMode ? "Xodim: yangi bemor anketasi" : t("c.eyebrow")) + "</p><h1>" + esc(t("c.title")) + "</h1><p>" + esc(t("c.i1")) + "</p><p>" + esc(t("c.i2")) + '</p><div class="meta">' + esc(t("c.meta")) + '</div></div><form id="anketa" novalidate autocomplete="on">';
    SEC.forEach(function (s, si) {
      h += '<section class="sec"><div class="sec-head"><span class="n">' + (si + 1) + "</span><h2>" + esc(Lg(s.t)) + "</h2></div>";
      if (s.note) h += '<p class="sec-note' + (s.strong ? " strong" : "") + '">' + esc(Lg(s.note)) + "</p>";
      if (s.info) {
        h += '<div class="info">' + s.info.map(function (x) { return "<p>" + Lg(x) + "</p>"; }).join("") + "</div>";
        if (S.user) {
          h += '<div class="photos">' + SLOTS.map(function (sl) {
            var f = S.photoFiles[sl[0]];
            return '<div class="photo"><div class="thumb" id="th_' + sl[0] + '">' + (f ? '<img alt="" src="' + esc(f.url) + '">' : "▢") + "</div><span>" + esc(t(sl[1])) + '</span><label class="btn ghost sm">' + esc(t("ph.pick")) + '<input type="file" accept="image/*" data-slot="' + sl[0] + '"></label></div>';
          }).join("") + "</div>";
        } else h += '<p class="note" style="margin-top:12px">' + esc(t("ph.need")) + ' <a href="#kirish" data-go="kirish" class="maplink">' + esc(t("login")) + "</a></p>";
        h += "</section>"; return;
      }
      h += '<div class="fields">' + s.fields.map(fieldHtml).join("") + "</div></section>";
    });
    return h + '<div class="submit"><div class="formerr" id="formerr" role="alert"></div><div class="actions"><button class="btn" type="submit">' + esc(t("c.submit")) + "</button></div><small>" + esc(t("c.after")) + "</small></div></form></div>";
  }
  function fieldHtml(f) {
    var id = f.id, A = S.A, v = A[id];
    var lab = esc(Lg(f.l)) + (f.req && f.ty !== "consent" ? '<span class="req">' + esc(t("c.req")) + "</span>" : "");
    var hint = f.h ? '<span class="hint">' + esc(Lg(f.h)) + "</span>" : "";
    var w = '<div class="field' + (f.full ? " full" : "") + '" data-fid="' + id + '">';
    if (f.ty === "text" || f.ty === "number" || f.ty === "date") {
      w += '<label for="f_' + id + '">' + lab + "</label>" + hint + '<input id="f_' + id + '" data-f="' + id + '" data-ft="' + f.ty + '" type="' + f.ty + '" value="' + esc(v || "") + '"' + (f.ty === "number" ? ' inputmode="decimal" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '"' : "") + (f.ph ? ' placeholder="' + esc(Lg(f.ph)) + '"' : "") + (f.auto ? ' autocomplete="' + f.auto + '"' : "") + ">";
    } else if (f.ty === "textarea") {
      var no = !!A[id + "_no"];
      w += '<label for="f_' + id + '">' + lab + "</label>" + hint;
      if (f.no) w += '<div class="chips noopt"><label class="chip"><input type="checkbox" data-f="' + id + '" data-no="1"' + (no ? " checked" : "") + "><span>" + esc(t("no")) + "</span></label></div>";
      w += '<textarea id="f_' + id + '" data-f="' + id + '" data-ft="textarea" rows="3"' + (no ? " disabled" : "") + ">" + esc(no ? "" : v || "") + "</textarea>";
    } else if (f.ty === "radio" || f.ty === "check") {
      var kind = f.ty === "radio" ? "radio" : "checkbox", sel = f.ty === "radio" ? [v] : (v || []);
      w += '<fieldset style="border:0;padding:0;margin:0;min-width:0"><legend style="padding:0;font-size:15px;font-weight:500;margin-bottom:6px">' + lab + "</legend>" + hint + '<div class="chips">';
      f.o.forEach(function (o, i) { w += '<label class="chip"><input type="' + kind + '" name="' + id + '" data-f="' + id + '" data-ft="' + f.ty + '" value="' + i + '"' + (f.other === i ? ' data-other="1"' : "") + (sel.indexOf(i) > -1 ? " checked" : "") + "><span>" + esc(Lg(o)) + "</span></label>"; });
      w += "</div>";
      if (f.other != null) w += '<div class="other"' + ((v || []).indexOf(f.other) > -1 ? "" : " hidden") + '><input type="text" data-f="' + id + '" data-ft="other" id="f_' + id + '_other" value="' + esc(A[id + "_other"] || "") + '" aria-label="' + esc(Lg(f.o[f.other])) + '"></div>';
      w += "</fieldset>";
    } else if (f.ty === "consent") {
      w += '<label class="consent"><input type="checkbox" data-f="' + id + '" data-ft="consent"' + (v ? " checked" : "") + "><span>" + (f.req ? "" : '<em class="opt">' + esc(t("c.opt")) + "</em>") + esc(Lg(f.l)) + "</span></label>";
    }
    return w + '<div class="errmsg"></div></div>';
  }
  function answered(f) {
    var v = S.A[f.id];
    if (f.id === "sana") return false;
    if (f.ty === "check") return !!(v && v.length);
    if (f.ty === "radio") return v != null;
    if (f.ty === "consent") return !!v;
    return !!(String(v || "").trim() || S.A[f.id + "_no"]);
  }
  function progress() {
    var tot = 0, done = 0;
    SEC.forEach(function (s) { if (!s.fields) return; tot++; if (s.fields.some(answered)) done++; });
    var c = $("#count"), fl = $("#fill");
    if (c) c.textContent = done + " / " + tot + " " + t("c.sections");
    if (fl) fl.style.width = (tot ? Math.round(done / tot * 100) : 0) + "%";
  }
  function ansUz(f) {
    var A = S.A, v = A[f.id];
    if (f.ty === "consent") return v ? f.sum : "";
    if (f.ty === "radio") return v != null ? f.o[v][0] : "";
    if (f.ty === "check") return (v || []).map(function (i) { var s = f.o[i][0]; return f.other === i && (A[f.id + "_other"] || "").trim() ? s + ": " + A[f.id + "_other"].trim() : s; }).join("; ");
    if (A[f.id + "_no"]) return "Yo'q";
    v = String(v || "").trim();
    return f.id === "sana" ? fmtDate(v) : v;
  }
  function summaryUz() {
    var out = ["KOSMETOLOGIK KONSULTATSIYA. MIJOZ ANKETASI", "Liber Cosmetic", "Mijoz tili: " + LTITLES[LI]];
    SEC.forEach(function (s, si) {
      if (!s.fields) return;
      var rows = [];
      s.fields.forEach(function (f) { var a = ansUz(f); if (a) rows.push(f.ty === "consent" ? a : f.l[0] + ": " + a); });
      if (rows.length) { out.push(""); out.push((si + 1) + ". " + s.t[0].toUpperCase()); rows.forEach(function (r) { out.push(r); }); }
    });
    var shots = SLOTS.filter(function (sl) { return S.photoFiles[sl[0]]; }).map(function (sl) { return sl[2]; });
    if (shots.length) { out.push(""); out.push("FOTOSURATLAR (saytga yuklandi): " + shots.join(", ")); }
    return out.join("\n");
  }
  function consultDone() {
    var text = S.consult.summary || summaryUz();
    return '<div class="in done"><h1>' + esc(t("d.title")) + "</h1><p>" + esc(t("d.lead")) + '</p><div class="status" id="saveStatus" role="status"></div><ol class="steps"><li><div>' + t("d.s1") + "</div></li><li><div>" + t("d.s2") + '</div></li></ol><div class="actions"><a class="btn" id="tgBtn" href="' + esc(tgHref(text)) + '" target="_blank" rel="noopener">' + esc(t("d.tg")) + '</a><button class="btn ghost" type="button" data-act="copysum">' + esc(t("copy")) + '</button><button class="btn ghost" type="button" data-act="edit">' + esc(t("d.edit")) + "</button>" + (S.consult.staffMode ? '<button class="btn ghost" type="button" data-act="newpatient">Yangi bemor</button>' : "") + '</div><div class="status" id="status" role="status"></div><pre class="summary" id="summary" tabindex="0">' + esc(text) + '</pre><p class="thanks">' + esc(t("d.thanks")) + "</p></div>";
  }
  function validate() {
    var first = null, n = 0;
    $$(".field", view).forEach(function (w) { w.classList.remove("bad"); });
    SEC.forEach(function (s) { (s.fields || []).forEach(function (f) {
      if (!f.req) return;
      var ok = f.ty === "consent" ? !!S.A[f.id] : !!String(S.A[f.id] || "").trim();
      if (!ok) { var w = $('.field[data-fid="' + f.id + '"]', view); w.classList.add("bad"); $(".errmsg", w).textContent = t(f.ty === "consent" ? "c.errc" : "c.err"); if (!first) first = w; n++; }
    }); });
    var fe = $("#formerr");
    if (n) {
      fe.textContent = t("c.errn").replace("{n}", n); fe.classList.add("on");
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      var fc = $("input,textarea", first); if (fc) { try { fc.focus({ preventScroll: true }); } catch (e) {} }
      return false;
    }
    fe.classList.remove("on"); return true;
  }
  function submitConsult() {
    if (!validate()) return;
    sset("liber-anketa-v2", JSON.stringify(S.A));
    S.consult.summary = summaryUz(); S.consult.done = true; render(false);
    if (!S.user) return;
    var u = S.user, slots = SLOTS.filter(function (sl) { return S.photoFiles[sl[0]]; });
    setStatus("#saveStatus", t("loading"), false);
    Promise.all(slots.map(function (sl) { return api.uploadPatientPhoto(u, S.photoFiles[sl[0]].file, sl[0]).then(function (path) { return { slot: sl[0], path: path }; }); }))
      .then(function (photos) { return api.saveConsultation(u, { forSelf: !S.consult.staffMode, name: S.A.ism || "", phone: S.A.aloqa || "", city: S.A.shahar || "", lang: LANGS[LI], answers: S.A, summary: S.consult.summary, photos: photos }); })
      .then(function () { setStatus("#saveStatus", t("d.saved"), false); })
      .catch(function () { setStatus("#saveStatus", t("d.savefail"), true); });
  }
  function clearConsult() { S.A = {}; S.photoFiles = {}; sset("liber-anketa-v2", "{}"); S.consult.done = false; S.consult.summary = ""; }

  // ---------- xodimlar paneli (o'zbekcha) ----------
  var KINDS = [["perfume", "Atir flakoni"], ["mascara", "Tush"], ["lipstick", "Pomada"], ["lipgloss", "Lab yaltiratgichi"], ["foundation", "Tonal krem"], ["lashkit", "Kiprik to'plami"], ["cleanser", "Tuba / gel"], ["serum", "Serum"], ["cream", "Krem idishi"], ["set", "To'plam qutisi"]];
  var CATS = [["parfyumeriya", "Parfyumeriya"], ["pardoz", "Pardoz"], ["parvarish", "Teri parvarishi"], ["toplamlar", "To'plamlar"]];
  var newDraft = function () { return { name: "", cat: "parfyumeriya", ty: "perfume", k: "perfume", c: "#e3a9b2", pr: "", old: "", img: "", desc: { uz: "", ru: "", en: "", kaa: "" }, isNew: true, wk: false, stock: true, active: true, sort: 0 }; };
  var optHtml = function (list, cur) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join(""); };

  function viewPanel() {
    var u = S.user, P = S.panel;
    var tabs = [["products", "Mahsulotlar"], ["orders", "Buyurtmalar"], ["patients", "Bemorlar bazasi"], ["customers", "Mijozlar"]];
    if (isAdmin(u)) tabs.push(["staff", "Xodimlar"]);
    if (!tabs.some(function (x) { return x[0] === P.tab; })) P.tab = "products";
    var h = '<div class="wrap page"><div class="ac-head"><h1>' + esc(tu("ac.panel")) + '</h1><span class="role">' + esc(u.role) + '</span></div><div class="tabs" role="group">' + tabs.map(function (x) { return '<button type="button" data-act="ptab" data-tab="' + x[0] + '" aria-pressed="' + (P.tab === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>";
    if (P.tab === "products") h += panelProducts();
    else if (P.tab === "orders") h += panelOrders();
    else if (P.tab === "patients") h += panelPatients();
    else if (P.tab === "customers") h += panelCustomers();
    else h += panelStaff();
    return h + "</div>";
  }
  function panelProducts() {
    var P = S.panel, d = P.draft, q = P.q.trim().toLowerCase();
    var list = S.products.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) > -1; });
    var h = '<div class="toolbar"><input type="text" id="pq" placeholder="Mahsulot qidirish..." value="' + esc(P.q) + '" aria-label="Qidirish"><div class="actions">' + (S.pLoaded && !S.products.length ? '<button class="btn ghost" type="button" data-act="pseed">Namunaviy katalogni yuklash</button>' : "") + '<button class="btn" type="button" data-act="pnew">+ Yangi mahsulot</button></div></div>';
    if (d) h += editorHtml(d);
    h += '<div class="tblwrap"><table class="tbl"><thead><tr><th></th><th>Nomi</th><th>Toifa</th><th class="num">Narx</th><th>Holat</th><th></th></tr></thead><tbody>' + (list.length ? list.map(function (p) {
      var flags = (p.active ? "" : '<span class="pill off">Yashirin</span> ') + (p.stock ? "" : '<span class="pill off">Qolmagan</span> ') + (p.isNew ? '<span class="pill new">Yangi</span> ' : "") + (p.wk ? '<span class="pill">Hafta</span> ' : "") + (p.old ? '<span class="pill">Aksiya</span>' : "");
      var del = P.confirmDel === p.id ? '<span style="align-self:center;font-size:13px">Aniq o\'chiraymi?</span><button class="btn danger sm" type="button" data-act="pdelyes" data-id="' + esc(p.id) + '">Ha</button><button class="btn ghost sm" type="button" data-act="pdelno">Yo\'q</button>' : '<button class="btn ghost sm" type="button" data-act="pedit" data-id="' + esc(p.id) + '">Tahrirlash</button><button class="btn danger sm" type="button" data-act="pdel" data-id="' + esc(p.id) + '">O\'chirish</button>';
      return '<tr><td><div class="thumb" style="--c:' + safeColor(p.c) + '">' + pimg(p) + "</div></td><td><strong>" + esc(p.name) + '</strong></td><td>' + esc((CATS.filter(function (c) { return c[0] === p.cat; })[0] || [0, p.cat])[1]) + '</td><td class="num">' + fmtUz(p.pr) + (p.old ? '<br><s style="color:var(--muted)">' + fmtUz(p.old) + "</s>" : "") + "</td><td>" + flags + '</td><td><div class="acts">' + del + "</div></td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty">Mahsulot topilmadi.</td></tr>') + "</tbody></table></div>";
    return h;
  }
  function editorHtml(d) {
    var chk = function (key, label) { return '<label><input type="checkbox" data-d="' + key + '"' + (d[key] ? " checked" : "") + ">" + label + "</label>"; };
    var tyList = Object.keys(TY).map(function (k) { return [k, TY[k][0]]; });
    return '<div class="editor" id="editor"><h2>' + (d.id ? "Mahsulotni tahrirlash" : "Yangi mahsulot") + '</h2><div class="egrid">' +
      '<div class="field full"><label for="d_name">Nomi</label><input type="text" id="d_name" data-d="name" value="' + esc(d.name) + '"></div>' +
      '<div class="field"><label for="d_cat">Toifa</label><select id="d_cat" data-d="cat">' + optHtml(CATS, d.cat) + "</select></div>" +
      '<div class="field"><label for="d_ty">Turi</label><select id="d_ty" data-d="ty">' + optHtml(tyList, d.ty) + "</select></div>" +
      '<div class="field"><label for="d_pr">Narx (so\'m)</label><input type="number" id="d_pr" data-d="pr" inputmode="numeric" min="0" step="1000" value="' + esc(d.pr) + '"></div>' +
      '<div class="field"><label for="d_old">Eski narx (aksiya uchun)</label><input type="number" id="d_old" data-d="old" inputmode="numeric" min="0" step="1000" value="' + esc(d.old || "") + '"></div>' +
      '<div class="field full"><label>Rasm</label><div class="imgbox"><div class="tile" id="dPrev" style="--c:' + safeColor(d.c) + '">' + pimg({ img: d.img, k: d.k, c: d.c, name: d.name }) + '</div><div class="actions"><label class="btn ghost sm" style="cursor:pointer">Rasm yuklash<input type="file" accept="image/*" data-upload="1" style="position:absolute;opacity:0;width:1px;height:1px"></label>' + (d.img ? '<button class="btn danger sm" type="button" data-act="rmimg">Rasmni olib tashlash</button>' : "") + '</div><span class="note" id="upStatus">Rasm bo\'lmasa, pastdagi chizma ko\'rsatiladi.</span></div></div>' +
      '<div class="field"><label for="d_k">Chizma turi (rasm yo\'q bo\'lsa)</label><select id="d_k" data-d="k">' + optHtml(KINDS, d.k) + "</select></div>" +
      '<div class="field"><label for="d_c">Chizma rangi</label><input type="color" id="d_c" data-d="c" value="' + esc(safeColor(d.c)) + '"></div>' +
      ["uz", "ru", "en", "kaa"].map(function (l) { return '<div class="field full"><label for="d_desc_' + l + '">Tavsif (' + l.toUpperCase() + ', ixtiyoriy)</label><textarea id="d_desc_' + l + '" data-d="desc.' + l + '" rows="2">' + esc((d.desc || {})[l] || "") + "</textarea></div>"; }).join("") +
      '<div class="field full"><div class="checks">' + chk("isNew", "Yangi") + chk("wk", "Hafta taklifi") + chk("stock", "Sotuvda bor") + chk("active", "Saytda ko'rinsin") + '</div></div></div><div class="actions" style="margin-top:20px"><button class="btn" type="button" data-act="psave">Saqlash</button><button class="btn ghost" type="button" data-act="pcancel">Bekor qilish</button><div class="status" id="eStatus" role="status"></div></div></div>';
  }
  function panelOrders() {
    var P = S.panel;
    if (!P.orders) return '<p class="empty">' + esc(t("loading")) + "</p>";
    var sts = [["", "Hammasi"], ["new", "Yangi"], ["confirmed", "Tasdiqlangan"], ["shipped", "Yo'lda"], ["done", "Yetkazilgan"], ["cancelled", "Bekor"]];
    var list = P.orders.filter(function (o) { return !P.statusFilter || o.status === P.statusFilter; });
    return '<div class="toolbar"><div class="chips">' + sts.map(function (s) { return '<label class="chip"><input type="radio" name="sf" data-act="sfilter" value="' + s[0] + '"' + (P.statusFilter === s[0] ? " checked" : "") + "><span>" + s[1] + "</span></label>"; }).join("") + "</div></div>" + (list.length ? list.map(function (o) { return orderCard(o, true); }).join("") : '<p class="empty">Buyurtmalar yo\'q.</p>');
  }
  function panelPatients() {
    var P = S.panel;
    if (!P.patients) return '<p class="empty">' + esc(t("loading")) + "</p>";
    var q = P.q.trim().toLowerCase();
    var list = P.patients.filter(function (c) { return !q || (c.name + " " + c.phone + " " + c.city).toLowerCase().indexOf(q) > -1; });
    return '<div class="toolbar"><input type="text" id="pq" placeholder="Ism, telefon yoki shahar bo\'yicha qidirish..." value="' + esc(P.q) + '" aria-label="Qidirish"><button class="btn" type="button" data-act="newpatientgo">+ Yangi bemor anketasi</button></div>' +
      (list.length ? list.map(function (c) {
        return '<details class="rec" data-cid="' + esc(c.id) + '"><summary><span><b>' + esc(c.name || "Ismsiz") + '</b> <span class="meta">' + esc(c.phone) + (c.city ? " · " + esc(c.city) : "") + '</span></span><span class="meta">' + esc(fmtDT(c.created)) + (c.photos.length ? " · " + c.photos.length + " ta surat" : "") + '</span></summary><div class="body">' +
          (c.photos.length ? '<div class="shots">' + c.photos.map(function (ph) { return '<a href="#" data-path="' + esc(ph.path) + '" data-act="openphoto" aria-label="' + esc(ph.slot) + '"><img alt="' + esc(ph.slot) + '"></a>'; }).join("") + "</div>" : "") +
          '<pre class="summary" style="margin:0;max-height:none">' + esc(c.summary) + '</pre><div class="field"><label for="n_' + esc(c.id) + '">Kosmetolog izohi / parvarish rejasi</label><textarea id="n_' + esc(c.id) + '" data-note="' + esc(c.id) + '" rows="3">' + esc(c.note || "") + '</textarea></div><div class="actions"><button class="btn sm" type="button" data-act="savenote" data-id="' + esc(c.id) + '">Izohni saqlash</button><span class="status" id="ns_' + esc(c.id) + '"></span></div></div></details>';
      }).join("") : '<p class="empty">Anketalar yo\'q.</p>');
  }
  function panelCustomers() {
    var P = S.panel;
    if (!P.profiles || !P.orders) return '<p class="empty">' + esc(t("loading")) + "</p>";
    var q = P.q.trim().toLowerCase();
    var stats = {}; P.orders.forEach(function (o) { if (o.status === "cancelled") return; var s = stats[o.userId] || (stats[o.userId] = { n: 0, sum: 0 }); s.n++; s.sum += o.total; });
    var list = P.profiles.filter(function (p) { return p.role === "customer" && (!q || (p.name + " " + p.email + " " + p.phone).toLowerCase().indexOf(q) > -1); });
    return '<div class="toolbar"><input type="text" id="pq" placeholder="Ism, email yoki telefon..." value="' + esc(P.q) + '" aria-label="Qidirish"></div><div class="tblwrap"><table class="tbl"><thead><tr><th>Ism</th><th>Email</th><th>Telefon</th><th class="num">Buyurtmalar</th><th class="num">Jami</th></tr></thead><tbody>' + (list.length ? list.map(function (p) { var s = stats[p.id] || { n: 0, sum: 0 }; return "<tr><td><strong>" + esc(p.name || "—") + "</strong></td><td>" + esc(p.email) + "</td><td>" + esc(p.phone) + '</td><td class="num">' + s.n + '</td><td class="num">' + fmtUz(s.sum) + "</td></tr>"; }).join("") : '<tr><td colspan="5" class="empty">Mijozlar yo\'q.</td></tr>') + "</tbody></table></div>";
  }
  function panelStaff() {
    var P = S.panel;
    if (!P.profiles) return '<p class="empty">' + esc(t("loading")) + "</p>";
    var list = P.profiles.filter(function (p) { return p.role !== "customer"; });
    return '<div class="panel" style="margin-bottom:22px"><h2>Xodim qo\'shish</h2><p class="note" style="margin-bottom:12px">Xodim avval saytda ro\'yxatdan o\'tgan bo\'lishi kerak. Uning emailini yozing.</p><div class="actions"><input type="text" id="stEmail" placeholder="email@misol.uz" style="max-width:320px" aria-label="Email"><button class="btn" type="button" data-act="addstaff">Xodim qilish</button></div><div class="status" id="stStatus" role="status"></div></div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>Ism</th><th>Email</th><th>Telefon</th><th>Rol</th></tr></thead><tbody>' + list.map(function (p) {
        var self = S.user && p.id === S.user.id;
        return "<tr><td><strong>" + esc(p.name || "—") + "</strong></td><td>" + esc(p.email) + "</td><td>" + esc(p.phone) + "</td><td>" + (self ? '<span class="role" style="margin:0">' + esc(p.role) + " (siz)</span>" : '<select data-act="setrole" data-id="' + esc(p.id) + '" aria-label="Rol" style="width:auto"><option value="customer">Mijoz</option><option value="staff"' + (p.role === "staff" ? " selected" : "") + '>Xodim</option><option value="admin"' + (p.role === "admin" ? " selected" : "") + ">Admin</option></select>") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function loadPanel(force) {
    var P = S.panel, tab = P.tab;
    var need = function (key, fn) { if (force || P[key] === null) fn().then(function (r) { P[key] = r; if (S.route === "panel") render(true); }).catch(function () { P[key] = []; if (S.route === "panel") render(true); }); };
    if (tab === "orders" || tab === "customers") need("orders", function () { return api.allOrders(); });
    if (tab === "patients") need("patients", function () { return api.listConsultations(); });
    if (tab === "customers" || tab === "staff") need("profiles", function () { return api.listProfiles(); });
  }

  // ---------- chizish ----------
  function render(keepScroll) {
    var h;
    switch (S.route) {
      case "home": h = viewHome(); break;
      case "savat": h = viewCart(); break;
      case "qidiruv": h = viewSearch(); break;
      case "mahsulot": h = viewProduct(); break;
      case "kirish": h = viewAuth(); break;
      case "hisob": h = S.user ? viewAccount() : viewAuth(); break;
      case "panel": h = isStaff(S.user) ? viewPanel() : viewAuth(); break;
      case "konsultatsiya": h = consultView(); break;
      default: h = viewCat(S.route);
    }
    var keep = keepScroll ? window.scrollY : 0;
    view.innerHTML = h;
    chrome();
    if (S.route === "konsultatsiya" && !S.consult.done) progress();
    if (keepScroll) window.scrollTo(0, keep); else window.scrollTo(0, 0);
  }
  function chrome() {
    document.documentElement.lang = LANGS[LI];
    $$("[data-t]").forEach(function (e) { e.textContent = t(e.dataset.t); });
    $$("[data-tp]").forEach(function (e) { e.placeholder = t(e.dataset.tp); });
    $$("[data-ta]").forEach(function (e) { e.setAttribute("aria-label", t(e.dataset.ta)); });
    $("#langbar").innerHTML = LNAMES.map(function (n, i) { return '<button type="button" data-act="lang" data-l="' + i + '" aria-pressed="' + (i === LI) + '" title="' + esc(LTITLES[i]) + '">' + n + "</button>"; }).join("");
    var nav = ["home", "parfyumeriya", "pardoz", "parvarish", "toplamlar", "aksiyalar", "konsultatsiya"];
    if (isStaff(S.user)) nav.push("panel");
    $("#navlinks").innerHTML = nav.map(function (r) { return '<a href="#' + (TOKEN[r] || r) + '" data-go="' + r + '"' + (r === S.route ? ' aria-current="page"' : "") + (r === "konsultatsiya" || r === "panel" ? ' class="special"' : "") + ">" + esc(r === "panel" ? "Panel" : t("nav." + r)) + "</a>"; }).join("");
    $("#cartN").textContent = cartCount();
    $("#acctDot").hidden = !S.user;
    var dm = $("#demoBar");
    if (api.mode === "demo" || api.mode === "error") {
      dm.hidden = false;
      dm.className = "demo" + (api.mode === "error" ? " bad" : "");
      dm.innerHTML = '<div class="wrap"><span>' + esc(api.mode === "error" ? (api.note || tu("err.generic")) : t("demo")) + '</span>' + (api.mode === "demo" && !(S.user && isStaff(S.user)) ? '<button type="button" data-act="demologin" data-role="admin">Admin</button><button type="button" data-act="demologin" data-role="staff">Xodim</button>' : "") + "</div>";
    } else dm.hidden = true;
    var f = '<div><img src="assets/logo.jpg" alt="Liber Cosmetic" width="360" height="175"><small>© Liber Cosmetic</small></div>';
    f += "<div><h4>" + esc(t("f.shop")) + "</h4>" + ["parfyumeriya", "pardoz", "parvarish", "toplamlar", "konsultatsiya"].map(function (r) { return '<a href="#' + r + '" data-go="' + r + '">' + esc(t("nav." + r)) + "</a>"; }).join("") + "</div>";
    var contact = "";
    if (C.phone) contact += '<a href="tel:' + esc(C.phone.replace(/[^+\d]/g, "")) + '">' + esc(C.phone) + "</a>";
    if (C.telegram) contact += '<a href="https://t.me/' + esc(C.telegram.replace(/^@/, "")) + '" target="_blank" rel="noopener">Telegram @' + esc(C.telegram.replace(/^@/, "")) + "</a>";
    f += "<div>" + (contact ? "<h4>" + esc(t("f.contact")) + "</h4>" + contact : "") + "<h4" + (contact ? ' style="margin-top:16px"' : "") + ">" + esc(t("f.social")) + '</h4><a href="https://instagram.com/' + esc(C.instagram || "") + '" target="_blank" rel="noopener">Instagram @' + esc(C.instagram || "") + "</a></div>";
    f += "<div>" + (C.shopAddress || C.mapUrl ? "<h4>" + esc(t("f.addr")) + "</h4>" + (C.shopAddress ? "<p>" + esc(C.shopAddress) + "</p>" : "") + (C.mapUrl ? '<a href="' + esc(C.mapUrl) + '" target="_blank" rel="noopener">' + esc(t("f.map")) + " →</a>" : "") : "") + "</div>";
    $("#foot").innerHTML = f;
  }
  function go(r, params) {
    if (r === "acct") r = S.user ? "hisob" : "kirish";
    if (ROUTES.indexOf(r) < 0) r = "home";
    if (r === "konsultatsiya" && S.route !== "konsultatsiya" && !(params && params.keep)) { S.consult.done = false; if (!(params && params.staff)) S.consult.staffMode = false; }
    S.route = r; S.params = params || {};
    if (r === "kirish" || (r === "hisob" && !S.user)) { S.authMode = (params && params.mode) || "login"; if (!(params && params.mode)) S.next = "home"; }
    $("#nav").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false");
    try { history.replaceState(null, "", "#" + (TOKEN[r] || r)); } catch (e) {}
    render(false);
    if (r === "hisob" && S.user) { S.myOrders = null; api.myOrders(S.user).then(function (o) { S.myOrders = o; if (S.route === "hisob") render(true); }).catch(function () { S.myOrders = []; if (S.route === "hisob") render(true); }); }
    if (r === "panel" && isStaff(S.user)) loadPanel(true);
  }
  function loadProducts() {
    return api.listProducts().then(function (l) { S.products = l; S.pLoaded = true; }).catch(function () { S.products = []; S.pLoaded = true; })
      .then(function () { if (S.route !== "konsultatsiya" && !(S.route === "panel" && S.panel.draft) && !(S.route === "kirish")) render(true); else chrome(); });
  }
  function setLang(i) { LI = i; sset("liber-lang", LANGS[i]); render(true); }

  // ---------- hodisalar ----------
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act],[data-go]");
    if (!el) return;
    if (el.dataset.act === undefined && el.dataset.go) {
      e.preventDefault();
      go(el.dataset.go, { id: el.dataset.id, mode: el.dataset.mode });
      return;
    }
    var a = el.dataset.act, id = el.dataset.id, P = S.panel;
    var pmap = PBY();
    switch (a) {
      case "lang": setLang(+el.dataset.l); break;
      case "menu": var n = $("#nav"); el.setAttribute("aria-expanded", n.classList.toggle("open")); break;
      case "back": var cur = pmap[S.params.id]; go(cur ? cur.cat : "home"); break;
      case "add":
        if (!pmap[id] || !pmap[id].stock) break;
        S.cart[id] = (S.cart[id] || 0) + 1; saveCart(); $("#cartN").textContent = cartCount(); toast(t("added")); break;
      case "qty": S.cart[id] = Math.max(0, (S.cart[id] || 0) + (+el.dataset.d)); if (!S.cart[id]) delete S.cart[id]; saveCart(); render(true); break;
      case "rm": delete S.cart[id]; saveCart(); render(true); break;
      case "hero": S.heroI = +el.dataset.i; $$(".slide").forEach(function (s) { s.hidden = +s.dataset.i !== S.heroI; }); $$(".dots button").forEach(function (b) { b.setAttribute("aria-current", +b.dataset.i === S.heroI); }); break;
      case "scroll": var row = document.getElementById(el.dataset.target); if (row) row.scrollBy({ left: +el.dataset.dir * row.clientWidth * 0.8, behavior: "smooth" }); break;
      case "authgo": S.authMode = el.dataset.mode; S.next = "savat"; go("kirish", { mode: el.dataset.mode }); break;
      case "authmode": S.authMode = el.dataset.mode; render(true); break;
      case "logout": api.signOut().then(function () { S.user = null; S.myOrders = null; go("home"); }); break;
      case "demologin": api.demoLogin(el.dataset.role).then(function () { return refreshUser(); }).then(function () { S.panel.orders = S.panel.patients = S.panel.profiles = null; go("panel"); }); break;
      case "geo": geo(); break;
      case "geoclear": S.O.lat = S.O.lng = null; render(true); break;
      case "placeorder": placeOrder(); break;
      case "edit": S.consult.done = false; render(false); break;
      case "copysum": copyFrom($("#summary"), $("#summary").textContent, $("#status")); break;
      case "newpatient": clearConsult(); render(false); break;
      case "newpatientgo": clearConsult(); S.consult.staffMode = true; go("konsultatsiya", { staff: 1 }); break;
      // panel
      case "ptab": P.tab = el.dataset.tab; P.q = ""; P.confirmDel = null; render(true); loadPanel(false); break;
      case "pnew": P.draft = newDraft(); render(true); var ed = $("#editor"); if (ed) ed.scrollIntoView({ behavior: "smooth", block: "start" }); break;
      case "pedit": var pp = pmap[id]; P.draft = JSON.parse(JSON.stringify(pp)); P.draft.desc = Object.assign({ uz: "", ru: "", en: "", kaa: "" }, pp.desc || {}); P.draft.old = pp.old || ""; render(true); var ed2 = $("#editor"); if (ed2) ed2.scrollIntoView({ behavior: "smooth", block: "start" }); break;
      case "pcancel": P.draft = null; render(true); break;
      case "pdel": P.confirmDel = id; render(true); break;
      case "pdelno": P.confirmDel = null; render(true); break;
      case "pdelyes": api.deleteProduct(id).then(function () { P.confirmDel = null; toast("O'chirildi"); return loadProducts(); }).catch(function () { toast(tu("err.generic")); }); break;
      case "rmimg": P.draft.img = ""; render(true); break;
      case "pseed": api.seedProducts().then(function () { toast("Namunaviy mahsulotlar qo'shildi"); return loadProducts(); }).catch(function () { toast(tu("err.generic")); }); break;
      case "psave": saveDraft(); break;
      case "savenote": var ta = $('[data-note="' + id + '"]'); api.saveConsultationNote(isNaN(+id) ? id : +id, ta.value).then(function () { setStatus("#ns_" + id, "Saqlandi", false); }).catch(function () { setStatus("#ns_" + id, tu("err.generic"), true); }); break;
      case "openphoto": e.preventDefault(); var im = $("img", el); if (im && im.src) window.open(im.src, "_blank"); break;
      case "addstaff": addStaff(); break;
    }
  });
  function saveDraft() {
    var d = S.panel.draft, st = "#eStatus";
    var pr = parseInt(d.pr, 10), old = d.old === "" || d.old == null ? null : parseInt(d.old, 10);
    if (!d.name.trim()) { setStatus(st, "Mahsulot nomini kiriting.", true); return; }
    if (isNaN(pr) || pr < 0) { setStatus(st, "Narxni to'g'ri kiriting.", true); return; }
    if (old != null && (isNaN(old) || old <= pr)) { setStatus(st, "Eski narx joriy narxdan katta bo'lishi kerak.", true); return; }
    var out = Object.assign({}, d, { name: d.name.trim(), pr: pr, old: old, sort: parseInt(d.sort, 10) || 0 });
    api.saveProduct(out).then(function () { S.panel.draft = null; toast("Saqlandi"); return loadProducts(); }).catch(function () { setStatus(st, tu("err.generic"), true); });
  }
  function addStaff() {
    var email = ($("#stEmail").value || "").trim().toLowerCase();
    var p = (S.panel.profiles || []).filter(function (x) { return (x.email || "").toLowerCase() === email; })[0];
    if (!p) { setStatus("#stStatus", "Bu email bilan ro'yxatdan o'tgan foydalanuvchi topilmadi. Avval u saytda ro'yxatdan o'tsin.", true); return; }
    api.setRole(p.id, "staff").then(function () { S.panel.profiles = null; loadPanel(true); toast("Xodim qo'shildi"); }).catch(function () { setStatus("#stStatus", tu("err.generic"), true); });
  }

  document.addEventListener("submit", function (e) {
    var f = e.target;
    e.preventDefault();
    if (f.classList.contains("sform")) { S.query = $("input", f).value; $$(".sform input").forEach(function (i) { i.value = S.query; }); go("qidiruv"); }
    else if (f.id === "anketa") submitConsult();
    else if (f.id === "authForm") submitAuth(f);
    else if (f.id === "profForm") {
      api.updateProfile(S.user, { name: $("#p_name").value.trim(), phone: $("#p_phone").value.trim() }).then(refreshUser).then(function () { setStatus("#profStatus", t("ac.saved"), false); chrome(); }).catch(function () { setStatus("#profStatus", t("err.generic"), true); });
    }
  });

  function onField(e) {
    var el = e.target, A = S.A;
    if (el.dataset.o) { S.O[el.dataset.o] = el.value; return; }
    if (el.id === "pq") { S.panel.q = el.value; if (e.type === "input") { clearTimeout(onField.t); onField.t = setTimeout(function () { var pos = el.selectionStart; render(true); var n = $("#pq"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } }, 200); } return; }
    if (el.dataset.act === "sfilter") { S.panel.statusFilter = el.value; render(true); return; }
    if (el.dataset.act === "ostatus" && e.type === "change") { api.setOrderStatus(isNaN(+el.dataset.id) ? el.dataset.id : +el.dataset.id, el.value).then(function () { toast("Holat yangilandi"); }).catch(function () { toast(tu("err.generic")); }); return; }
    if (el.dataset.act === "setrole" && e.type === "change") { api.setRole(el.dataset.id, el.value).then(function () { toast("Rol o'zgartirildi"); S.panel.profiles = null; loadPanel(true); }).catch(function () { toast(tu("err.generic")); }); return; }
    if (el.dataset.slot) { var file = el.files && el.files[0]; if (!file) return; var old = S.photoFiles[el.dataset.slot]; if (old) URL.revokeObjectURL(old.url); var url = URL.createObjectURL(file); S.photoFiles[el.dataset.slot] = { file: file, url: url }; $("#th_" + el.dataset.slot).innerHTML = '<img alt="" src="' + esc(url) + '">'; return; }
    if (el.dataset.upload) {
      var uf = el.files && el.files[0]; if (!uf) return; setStatus("#upStatus", t("loading"), false);
      api.uploadProductImage(uf).then(function (u) { S.panel.draft.img = u; render(true); }).catch(function () { setStatus("#upStatus", "Rasmni yuklab bo'lmadi.", true); }); return;
    }
    if (el.dataset.d) {
      var d = S.panel.draft, key = el.dataset.d, v = el.type === "checkbox" ? el.checked : el.value;
      if (key.indexOf("desc.") === 0) d.desc[key.slice(5)] = v; else d[key] = v;
      if (key === "c" || key === "k") { var pv = $("#dPrev"); if (pv) { pv.style.setProperty("--c", safeColor(d.c)); pv.innerHTML = pimg({ img: d.img, k: d.k, c: d.c, name: d.name }); } }
      return;
    }
    var id = el.dataset.f; if (!id) return;
    var ft = el.dataset.ft, w = el.closest(".field");
    if (el.dataset.no) { A[id + "_no"] = el.checked; var ta = $("#f_" + id); if (el.checked) { A[id] = ""; ta.value = ""; } ta.disabled = el.checked; }
    else if (ft === "radio") A[id] = +el.value;
    else if (ft === "check") { A[id] = $$('input[name="' + id + '"]:checked', w).map(function (c) { return +c.value; }); if (el.dataset.other) $(".other", w).hidden = !el.checked; }
    else if (ft === "other") A[id + "_other"] = el.value;
    else if (ft === "consent") A[id] = el.checked;
    else A[id] = el.value;
    if (w) w.classList.remove("bad");
    sset("liber-anketa-v2", JSON.stringify(A)); progress();
  }
  document.addEventListener("input", onField);
  document.addEventListener("change", onField);

  // bemor suratlarini ochilganda yuklash (imzolangan havola)
  document.addEventListener("toggle", function (e) {
    var d = e.target; if (!d.classList || !d.classList.contains("rec") || !d.open || d.dataset.loaded) return;
    d.dataset.loaded = "1";
    $$("a[data-path]", d).forEach(function (a) { api.photoUrl(a.dataset.path).then(function (u) { if (u) $("img", a).src = u; }); });
  }, true);

  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").replace("#", ""), r = h === "bosh" || !h ? "home" : h;
    if (r !== S.route && ROUTES.indexOf(r) > -1 && r !== "mahsulot") go(r);
  });

  // ---------- boshlash ----------
  var li = LANGS.indexOf(sget("liber-lang"));
  if (li < 0) { var nl = (navigator.language || "uz").toLowerCase(); li = /^ru/.test(nl) ? 1 : /^en/.test(nl) ? 2 : 0; }
  LI = li;
  var h0 = (location.hash || "").replace("#", "");
  if (ROUTES.indexOf(h0) > -1 && h0 !== "mahsulot" && h0 !== "hisob" && h0 !== "panel") S.route = h0;
  render(true);
  var lastUid = null;
  api.onAuth(function () { refreshUser().then(function (u) { var id = u ? u.id : null; if (id === lastUid) return; lastUid = id; if (S.route === "panel" && !isStaff(u)) go("home"); else if (S.route !== "konsultatsiya") render(true); else chrome(); }); });
  api.init().then(refreshUser).then(function (u) { lastUid = u ? u.id : null; if (u && (h0 === "hisob" || h0 === "panel")) S.route = h0; return loadProducts(); }).then(function () { if (S.route === "panel" && isStaff(S.user)) loadPanel(true); if (S.route === "hisob" && S.user) go("hisob"); });
})(window.LIBER = window.LIBER || {});
