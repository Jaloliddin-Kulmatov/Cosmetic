// Ma'lumotlar qatlami. Supabase sozlangan bo'lsa u ishlatiladi, aks holda demo rejim (ma'lumotlar faqat brauzerda).
// Ikkala rejim bir xil funksiyalarni beradi, shuning uchun interfeys kodi farqni sezmaydi.
(function (L) {
  "use strict";
  var C = window.LIBER_CONFIG || {};
  var SB = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
  var api = { mode: SB ? "supabase" : "demo" };
  var authCb = [];
  var fire = function () { authCb.forEach(function (f) { try { f(); } catch (e) {} }); };
  api.onAuth = function (cb) { authCb.push(cb); };
  var fail = function (code, msg) { var e = new Error(msg || code); e.code = code; return e; };

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
  var rid = function () { return Math.random().toString(36).slice(2, 10); };

  // ---------- Supabase ----------
  if (SB) {
    var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
    sb.auth.onAuthStateChange(function () { setTimeout(fire, 0); });
    var prodFrom = function (r) { return { id: r.id, name: r.name, cat: r.category, ty: r.type_key, k: r.kind, c: r.color, pr: r.price, old: r.old_price, img: r.image_url, isNew: r.is_new, wk: r.is_week, stock: r.in_stock, active: r.active, desc: r.description || {}, sort: r.sort }; };
    var prodTo = function (p) { return { name: p.name, category: p.cat, type_key: p.ty, kind: p.k, color: p.c, price: p.pr, old_price: p.old || null, image_url: p.img || null, description: p.desc || {}, is_new: !!p.isNew, is_week: !!p.wk, in_stock: p.stock !== false, active: p.active !== false, sort: p.sort || 0 }; };
    var ordFrom = function (r) { return { id: r.id, status: r.status, name: r.customer_name, phone: r.phone, address: r.address, note: r.note, lat: r.lat, lng: r.lng, total: r.total, created: r.created_at, items: (r.order_items || []).map(function (i) { return { name: i.name, price: i.price, qty: i.qty }; }) }; };
    var conFrom = function (r) { return { id: r.id, name: r.patient_name, phone: r.patient_phone, city: r.city, lang: r.lang, summary: r.summary, photos: r.photos || [], note: r.staff_note, created: r.created_at, userId: r.user_id }; };
    var chk = function (res) { if (res.error) throw fail("generic", res.error.message); return res.data; };

    api.init = function () { return Promise.resolve(); };
    api.me = function () {
      return sb.auth.getSession().then(function (r) {
        var s = r.data && r.data.session; if (!s) return null;
        return sb.from("profiles").select("*").eq("id", s.user.id).maybeSingle().then(function (p) {
          var d = p.data || {};
          return { id: s.user.id, email: s.user.email, name: d.full_name || "", phone: d.phone || "", role: d.role || "customer" };
        });
      });
    };
    api.signUp = function (o) {
      return sb.auth.signUp({ email: o.email, password: o.password, options: { data: { full_name: o.name, phone: o.phone } } }).then(function (r) {
        if (r.error) throw fail(/registered|exists/i.test(r.error.message) ? "exists" : /password/i.test(r.error.message) ? "weak" : "generic", r.error.message);
        if (r.data.user && r.data.user.identities && r.data.user.identities.length === 0) throw fail("exists");
        return { needsConfirm: !r.data.session };
      });
    };
    api.signIn = function (email, password) {
      return sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
        if (r.error) throw fail(/not confirmed/i.test(r.error.message) ? "unconfirmed" : /invalid/i.test(r.error.message) ? "bad_credentials" : "generic", r.error.message);
      });
    };
    api.signOut = function () { return sb.auth.signOut(); };
    api.updateProfile = function (u, o) { return sb.from("profiles").update({ full_name: o.name, phone: o.phone }).eq("id", u.id).then(chk); };

    api.listProducts = function () { return sb.from("products").select("*").order("sort").order("created_at", { ascending: false }).then(chk).then(function (rows) { return rows.map(prodFrom); }); };
    api.saveProduct = function (p) { var row = prodTo(p); return (p.id ? sb.from("products").update(row).eq("id", p.id) : sb.from("products").insert(row)).then(chk); };
    api.deleteProduct = function (id) { return sb.from("products").delete().eq("id", id).then(chk); };
    api.uploadProductImage = function (file) {
      return L.compress(file, 1200, 0.85).then(function (blob) {
        var path = Date.now() + "-" + rid() + ".jpg";
        return sb.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg" }).then(function (r) {
          if (r.error) throw fail("generic", r.error.message);
          return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
        });
      });
    };

    api.placeOrder = function (o) {
      return sb.rpc("place_order", { p_name: o.name, p_phone: o.phone, p_address: o.address, p_note: o.note || "", p_lat: o.lat == null ? null : o.lat, p_lng: o.lng == null ? null : o.lng, p_items: o.items }).then(chk);
    };
    api.myOrders = function (u) { return sb.from("orders").select("*, order_items(*)").eq("user_id", u.id).order("created_at", { ascending: false }).then(chk).then(function (r) { return r.map(ordFrom); }); };
    api.allOrders = function () { return sb.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).then(chk).then(function (r) { return r.map(ordFrom); }); };
    api.setOrderStatus = function (id, status) { return sb.from("orders").update({ status: status }).eq("id", id).then(chk); };

    api.uploadPatientPhoto = function (u, file, slot) {
      return L.compress(file, 1600, 0.82).then(function (blob) {
        var path = (u ? u.id : "staff") + "/" + Date.now() + "-" + slot + "-" + rid() + ".jpg";
        return sb.storage.from("patient-photos").upload(path, blob, { contentType: "image/jpeg" }).then(function (r) {
          if (r.error) throw fail("generic", r.error.message);
          return path;
        });
      });
    };
    api.photoUrl = function (path) { return sb.storage.from("patient-photos").createSignedUrl(path, 3600).then(function (r) { return r.data ? r.data.signedUrl : ""; }); };
    api.saveConsultation = function (u, o) {
      var row = { user_id: o.forSelf ? u.id : null, created_by: u.id, patient_name: o.name, patient_phone: o.phone, city: o.city, lang: o.lang, answers: o.answers, summary: o.summary, photos: o.photos || [] };
      return sb.from("consultations").insert(row).then(chk);
    };
    api.listConsultations = function () { return sb.from("consultations").select("*").order("created_at", { ascending: false }).then(chk).then(function (r) { return r.map(conFrom); }); };
    api.saveConsultationNote = function (id, note) { return sb.from("consultations").update({ staff_note: note, updated_at: new Date().toISOString() }).eq("id", id).then(chk); };

    api.listProfiles = function () { return sb.from("profiles").select("*").order("created_at", { ascending: false }).then(chk).then(function (r) { return r.map(function (p) { return { id: p.id, email: p.email, name: p.full_name, phone: p.phone, role: p.role, created: p.created_at }; }); }); };
    api.setRole = function (id, role) { return sb.rpc("set_user_role", { target: id, new_role: role }).then(chk); };
  }

  // ---------- Demo (localStorage) ----------
  else {
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
    var products = function () {
      var p = get("products", null);
      if (!p) { p = (L.DEFAULT_PRODUCTS || []).map(function (d, i) { return { id: "d" + (i + 1), name: d.name, cat: d.category, ty: d.type_key, k: d.kind, c: d.color, pr: d.price, old: d.old_price, img: null, isNew: d.is_new, wk: d.is_week, stock: true, active: true, desc: {}, sort: d.sort }; }); set("products", p); }
      return p;
    };
    var sessionUser = function () { var id = get("session", null); return id ? users().filter(function (u) { return u.id === id; })[0] || null : null; };
    var pub = function (u) { return u ? { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role } : null; };

    api.init = function () { users(); products(); return Promise.resolve(); };
    api.me = function () { return Promise.resolve(pub(sessionUser())); };
    api.demoLogin = function (role) { set("session", role === "admin" ? "demo-admin" : "demo-staff"); fire(); return Promise.resolve(); };
    api.signUp = function (o) {
      var us = users();
      if (us.some(function (u) { return u.email.toLowerCase() === o.email.toLowerCase(); })) return Promise.reject(fail("exists"));
      if (o.password.length < 6) return Promise.reject(fail("weak"));
      return hash(o.password).then(function (h) {
        var u = { id: "u" + rid(), email: o.email, name: o.name, phone: o.phone, role: "customer", hash: h };
        us.push(u); set("users", us); set("session", u.id); fire();
        return { needsConfirm: false };
      });
    };
    api.signIn = function (email, password) {
      return hash(password).then(function (h) {
        var u = users().filter(function (x) { return x.email.toLowerCase() === email.toLowerCase() && x.hash && x.hash === h; })[0];
        if (!u) throw fail("bad_credentials");
        set("session", u.id); fire();
      });
    };
    api.signOut = function () { set("session", null); fire(); return Promise.resolve(); };
    api.updateProfile = function (u, o) { var us = users(); us.forEach(function (x) { if (x.id === u.id) { x.name = o.name; x.phone = o.phone; } }); set("users", us); return Promise.resolve(); };

    api.listProducts = function () { return Promise.resolve(products().slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); })); };
    api.saveProduct = function (p) {
      var ps = products();
      if (p.id) ps = ps.map(function (x) { return x.id === p.id ? Object.assign({}, p) : x; });
      else { ps.unshift(Object.assign({}, p, { id: "d" + rid() })); }
      set("products", ps); return Promise.resolve();
    };
    api.deleteProduct = function (id) { set("products", products().filter(function (x) { return x.id !== id; })); return Promise.resolve(); };
    api.uploadProductImage = function (file) { return L.compress(file, 700, 0.75).then(blobToDataUrl); };

    api.placeOrder = function (o) {
      var u = sessionUser(); if (!u) return Promise.reject(fail("not_authenticated"));
      var ps = products(), items = [], total = 0;
      o.items.forEach(function (it) { var p = ps.filter(function (x) { return x.id === it.id && x.active && x.stock; })[0]; if (p) { var q = Math.max(1, Math.min(99, it.qty)); items.push({ name: p.name, price: p.pr, qty: q }); total += p.pr * q; } });
      if (!items.length) return Promise.reject(fail("no_valid_items"));
      var os = get("orders", []); var id = os.length ? os[0].id + 1 : 1001;
      os.unshift({ id: id, userId: u.id, status: "new", name: o.name, phone: o.phone, address: o.address, note: o.note || "", lat: o.lat == null ? null : o.lat, lng: o.lng == null ? null : o.lng, total: total, created: new Date().toISOString(), items: items });
      set("orders", os); return Promise.resolve(id);
    };
    api.myOrders = function (u) { return Promise.resolve(get("orders", []).filter(function (o) { return o.userId === u.id; })); };
    api.allOrders = function () { return Promise.resolve(get("orders", [])); };
    api.setOrderStatus = function (id, status) { set("orders", get("orders", []).map(function (o) { return o.id === id ? Object.assign({}, o, { status: status }) : o; })); return Promise.resolve(); };

    api.uploadPatientPhoto = function (u, file) { return L.compress(file, 640, 0.7).then(blobToDataUrl); };
    api.photoUrl = function (path) { return Promise.resolve(path); };
    api.saveConsultation = function (u, o) {
      var cs = get("consults", []); var id = cs.length ? cs[0].id + 1 : 1;
      cs.unshift({ id: id, userId: o.forSelf ? u.id : null, name: o.name, phone: o.phone, city: o.city, lang: o.lang, summary: o.summary, photos: o.photos || [], note: "", created: new Date().toISOString() });
      set("consults", cs); return Promise.resolve();
    };
    api.listConsultations = function () { return Promise.resolve(get("consults", [])); };
    api.saveConsultationNote = function (id, note) { set("consults", get("consults", []).map(function (c) { return c.id === id ? Object.assign({}, c, { note: note }) : c; })); return Promise.resolve(); };

    api.listProfiles = function () { return Promise.resolve(users().map(function (u) { return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, created: "" }; })); };
    api.setRole = function (id, role) { var us = users(); us.forEach(function (u) { if (u.id === id) u.role = role; }); set("users", us); return Promise.resolve(); };
  }

  L.api = api;
})(window.LIBER = window.LIBER || {});
