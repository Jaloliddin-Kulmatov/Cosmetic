// Brauzer tomonidagi ma'lumotlar qatlami.
// Server rejimi: /api/* (Vercel funksiyalari, DATABASE_URL orqali Postgres).
// Demo rejimi: backend topilmasa, ma'lumotlar faqat brauzerning localStorage'ida saqlanadi.
// Interfeys ikkala rejimda bir xil funksiyalarni ishlatadi.
(function (L) {
  "use strict";
  var fail = function (code, msg) { var e = new Error(msg || code); e.code = code; return e; };
  var rid = function () { return Math.random().toString(36).slice(2, 10); };
  var authCb = [];
  var fire = function () { authCb.forEach(function (f) { try { f(); } catch (e) {} }); };

  // ---------- rasm siqish (telefon suratlari katta bo'ladi) ----------
  L.compress = function (file, max, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(fail("compress")); }, "image/jpeg", quality || 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(fail("compress")); };
      img.src = url;
    });
  };
  var blobToDataUrl = function (b) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(b); }); };
  var blobToB64 = function (b) { return blobToDataUrl(b).then(function (u) { return u.slice(u.indexOf(",") + 1); }); };

  // ================= SERVER =================
  var server = {};
  function call(method, path, body) {
    var opts = { method: method, headers: {}, credentials: "same-origin" };
    if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw fail(j.error || "generic");
        return j;
      });
    });
  }
  server.me = function () { return call("GET", "/api/auth/me").then(function (j) { return j.user || null; }); };
  server.signUp = function (o) { return call("POST", "/api/auth/register", { email: o.email, password: o.password, name: o.name, phone: o.phone }).then(function () { return { needsConfirm: false }; }); };
  server.signIn = function (email, password) { return call("POST", "/api/auth/login", { email: email, password: password }).then(function () {}); };
  server.signOut = function () { return call("POST", "/api/auth/logout", {}).then(function () {}); };
  server.updateProfile = function (u, o) { return call("PATCH", "/api/auth/profile", { name: o.name, phone: o.phone }).then(function () {}); };

  server.listProducts = function () { return call("GET", "/api/products").then(function (j) { return j.products; }); };
  server.saveProduct = function (p) { return (p.id ? call("PUT", "/api/products/" + p.id, p) : call("POST", "/api/products", p)).then(function () {}); };
  server.deleteProduct = function (id) { return call("DELETE", "/api/products/" + id).then(function () {}); };
  server.seedProducts = function () { return call("POST", "/api/products/seed", {}).then(function (j) { return j.count; }); };
  server.uploadProductImage = function (file) {
    return L.compress(file, 1000, 0.8).then(blobToB64).then(function (b64) { return call("POST", "/api/files", { kind: "product", data: b64 }); }).then(function (j) { return j.url; });
  };

  server.placeOrder = function (o) { return call("POST", "/api/orders", { name: o.name, phone: o.phone, address: o.address, note: o.note || "", lat: o.lat, lng: o.lng, items: o.items }).then(function (j) { return j.id; }); };
  server.myOrders = function () { return call("GET", "/api/orders/mine").then(function (j) { return j.orders; }); };
  server.allOrders = function () { return call("GET", "/api/orders").then(function (j) { return j.orders; }); };
  server.setOrderStatus = function (id, status) { return call("PATCH", "/api/orders/" + id, { status: status }).then(function () {}); };

  server.uploadPatientPhoto = function (u, file) {
    return L.compress(file, 1400, 0.78).then(blobToB64).then(function (b64) { return call("POST", "/api/files", { kind: "patient", data: b64 }); }).then(function (j) { return j.id; });
  };
  server.photoUrl = function (id) { return Promise.resolve("/api/files/" + id); };
  server.saveConsultation = function (u, o) { return call("POST", "/api/consultations", o).then(function () {}); };
  server.listConsultations = function () { return call("GET", "/api/consultations").then(function (j) { return j.consultations; }); };
  server.saveConsultationNote = function (id, note) { return call("PATCH", "/api/consultations/" + id, { note: note }).then(function () {}); };

  server.listProfiles = function () { return call("GET", "/api/users").then(function (j) { return j.users; }); };
  server.setRole = function (id, role) { return call("POST", "/api/users/" + id + "/role", { role: role }).then(function () {}); };

  // ================= DEMO (localStorage) =================
  var demo = {};
  var K = function (k) { return "liber-demo-" + k; };
  var get = function (k, d) { try { var s = localStorage.getItem(K(k)); return s ? JSON.parse(s) : d; } catch (e) { return d; } };
  var set = function (k, v) { try { localStorage.setItem(K(k), JSON.stringify(v)); } catch (e) { throw fail("storage", "Brauzer xotirasi to'ldi"); } };
  var hash = function (s) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); });
    }
    return Promise.resolve(btoa(unescape(encodeURIComponent(s))));
  };
  var users = function () {
    var u = get("users", null);
    if (!u) {
      u = [{ id: "demo-admin", email: "admin@demo.local", name: "Demo Admin", phone: "", role: "admin", hash: "" }, { id: "demo-staff", email: "staff@demo.local", name: "Demo Xodim", phone: "", role: "staff", hash: "" }];
      set("users", u);
    }
    return u;
  };
  var sampleProducts = function () {
    return (L.DEFAULT_PRODUCTS || []).map(function (d, i) { return { id: "d" + (i + 1), name: d.name, cat: d.category, ty: d.type_key, k: d.kind, c: d.color, pr: d.price, old: d.old_price, img: null, isNew: d.is_new, wk: d.is_week, stock: true, active: true, desc: {}, sort: d.sort }; });
  };
  var products = function () { var p = get("products", null); if (!p) { p = sampleProducts(); set("products", p); } return p; };
  var sessionUser = function () { var id = get("session", null); return id ? users().filter(function (u) { return u.id === id; })[0] || null : null; };
  var pub = function (u) { return u ? { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role } : null; };

  demo.init = function () { users(); products(); return Promise.resolve(); };
  demo.me = function () { return Promise.resolve(pub(sessionUser())); };
  demo.demoLogin = function (role) { set("session", role === "admin" ? "demo-admin" : "demo-staff"); fire(); return Promise.resolve(); };
  demo.signUp = function (o) {
    var us = users();
    if (us.some(function (u) { return u.email.toLowerCase() === o.email.toLowerCase(); })) return Promise.reject(fail("exists"));
    if (o.password.length < 8) return Promise.reject(fail("weak"));
    return hash(o.password).then(function (h) {
      var u = { id: "u" + rid(), email: o.email, name: o.name, phone: o.phone, role: "customer", hash: h };
      us.push(u); set("users", us); set("session", u.id); fire();
      return { needsConfirm: false };
    });
  };
  demo.signIn = function (email, password) {
    return hash(password).then(function (h) {
      var u = users().filter(function (x) { return x.email.toLowerCase() === email.toLowerCase() && x.hash && x.hash === h; })[0];
      if (!u) throw fail("bad_credentials");
      set("session", u.id); fire();
    });
  };
  demo.signOut = function () { set("session", null); fire(); return Promise.resolve(); };
  demo.updateProfile = function (u, o) { var us = users(); us.forEach(function (x) { if (x.id === u.id) { x.name = o.name; x.phone = o.phone; } }); set("users", us); return Promise.resolve(); };

  demo.listProducts = function () { return Promise.resolve(products().slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); })); };
  demo.saveProduct = function (p) {
    var ps = products();
    if (p.id) ps = ps.map(function (x) { return x.id === p.id ? Object.assign({}, p) : x; });
    else ps.unshift(Object.assign({}, p, { id: "d" + rid() }));
    set("products", ps); return Promise.resolve();
  };
  demo.deleteProduct = function (id) { set("products", products().filter(function (x) { return x.id !== id; })); return Promise.resolve(); };
  demo.seedProducts = function () { var ps = products(); if (ps.length) return Promise.reject(fail("not_empty")); set("products", sampleProducts()); return Promise.resolve(18); };
  demo.uploadProductImage = function (file) { return L.compress(file, 700, 0.75).then(blobToDataUrl); };

  demo.placeOrder = function (o) {
    var u = sessionUser(); if (!u) return Promise.reject(fail("not_authenticated"));
    var ps = products(), items = [], total = 0;
    o.items.forEach(function (it) { var p = ps.filter(function (x) { return x.id === it.id && x.active && x.stock; })[0]; if (p) { var q = Math.max(1, Math.min(99, it.qty)); items.push({ name: p.name, price: p.pr, qty: q }); total += p.pr * q; } });
    if (!items.length) return Promise.reject(fail("no_valid_items"));
    var os = get("orders", []); var id = os.length ? os[0].id + 1 : 1001;
    os.unshift({ id: id, userId: u.id, status: "new", name: o.name, phone: o.phone, address: o.address, note: o.note || "", lat: o.lat == null ? null : o.lat, lng: o.lng == null ? null : o.lng, total: total, created: new Date().toISOString(), items: items });
    set("orders", os); return Promise.resolve(id);
  };
  demo.myOrders = function (u) { return Promise.resolve(get("orders", []).filter(function (o) { return o.userId === u.id; })); };
  demo.allOrders = function () { return Promise.resolve(get("orders", [])); };
  demo.setOrderStatus = function (id, status) { set("orders", get("orders", []).map(function (o) { return o.id === id ? Object.assign({}, o, { status: status }) : o; })); return Promise.resolve(); };

  demo.uploadPatientPhoto = function (u, file) { return L.compress(file, 640, 0.7).then(blobToDataUrl); };
  demo.photoUrl = function (path) { return Promise.resolve(path); };
  demo.saveConsultation = function (u, o) {
    var cs = get("consults", []); var id = cs.length ? cs[0].id + 1 : 1;
    cs.unshift({ id: id, userId: o.forSelf ? u.id : null, name: o.name, phone: o.phone, city: o.city, lang: o.lang, summary: o.summary, photos: o.photos || [], note: "", created: new Date().toISOString() });
    set("consults", cs); return Promise.resolve();
  };
  demo.listConsultations = function () { return Promise.resolve(get("consults", [])); };
  demo.saveConsultationNote = function (id, note) { set("consults", get("consults", []).map(function (c) { return c.id === id ? Object.assign({}, c, { note: note }) : c; })); return Promise.resolve(); };
  demo.listProfiles = function () { return Promise.resolve(users().map(function (u) { return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, created: "" }; })); };
  demo.setRole = function (id, role) { var us = users(); us.forEach(function (u) { if (u.id === id) u.role = role; }); set("users", us); return Promise.resolve(); };

  // ================= tanlash =================
  var impl = demo;
  var api = { mode: "demo", note: "" };
  api.onAuth = function (cb) { authCb.push(cb); };
  ["me", "signUp", "signIn", "signOut", "updateProfile", "listProducts", "saveProduct", "deleteProduct", "seedProducts", "uploadProductImage",
    "placeOrder", "myOrders", "allOrders", "setOrderStatus", "uploadPatientPhoto", "photoUrl", "saveConsultation", "listConsultations",
    "saveConsultationNote", "listProfiles", "setRole", "demoLogin"].forEach(function (n) {
    api[n] = function () { var f = impl[n]; return f ? f.apply(null, arguments) : Promise.reject(fail("unsupported")); };
  });

  // Backend bormi? /api/health javobiga qarab rejim tanlanadi:
  //   backend yo'q (404, tarmoq xatosi)  -> demo
  //   backend bor va ishlayapti          -> server
  //   backend bor, lekin baza ulanmagan  -> xato banneri (demo ma'lumotlar bilan)
  api.init = function () {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    return fetch("/api/health", { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        clearTimeout(timer);
        if (j && j.backend) {
          if (j.ok) { impl = server; api.mode = "server"; }
          else { api.mode = "error"; api.note = j.error || ""; }
        }
      })
      .catch(function () { clearTimeout(timer); })
      .then(function () { return impl.init ? impl.init() : undefined; });
  };

  L.api = api;
})(window.LIBER = window.LIBER || {});
