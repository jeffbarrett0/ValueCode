// FMP (Financial Modeling Prep) "stable" API ile veri çekme.
(function (VC) {
  "use strict";
  const BASE = "https://financialmodelingprep.com/stable/";
  const TTL = 12 * 3600 * 1000; // 12 saat önbellek: ücretsiz günlük istek hakkını korur

  function cacheGet(k) {
    try {
      const r = JSON.parse(localStorage.getItem("vc_cache_" + k));
      if (r && Date.now() - r.t < TTL) return r.d;
    } catch (e) { /* önbellek yoksa sorun değil */ }
    return null;
  }
  function cacheSet(k, d) {
    try { localStorage.setItem("vc_cache_" + k, JSON.stringify({ t: Date.now(), d })); } catch (e) { /* dolu olabilir */ }
  }

  function fail(code, message) { const e = new Error(message); e.code = code; return e; }

  async function call(path, params, key) {
    const ck = path + "|" + JSON.stringify(params);
    const hit = cacheGet(ck);
    if (hit) return hit;
    const qs = new URLSearchParams(Object.assign({}, params, { apikey: key }));
    let res;
    try { res = await fetch(BASE + path + "?" + qs.toString()); }
    catch (e) { throw fail("network", "İnternete veya FMP'ye ulaşılamadı. Bağlantınızı kontrol edin."); }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) { /* düz metin hata olabilir */ }
    const apiMsg = data && !Array.isArray(data) && (data["Error Message"] || data.message);
    if (!res.ok || apiMsg) {
      const m = String(apiMsg || text || "");
      if (res.status === 429 || /limit reach/i.test(m)) throw fail(429, "FMP istek limiti doldu. Biraz bekleyin veya yarın tekrar deneyin.");
      if (res.status === 401 || /invalid api key/i.test(m)) throw fail(401, "API anahtarı geçersiz. js/config.js dosyasını kontrol edin.");
      if (res.status === 402 || res.status === 403 || /premium|subscription|not available/i.test(m)) throw fail(402, "Bu veri ücretsiz planda kısıtlı: " + path);
      throw fail(res.status, "FMP hatası (" + res.status + "): " + m.slice(0, 120));
    }
    cacheSet(ck, data);
    return data;
  }

  // Önce 10 yıl iste; ücretsiz plan kabul etmezse 5 yıla düş.
  async function statement(path, symbol, key, notes) {
    try {
      return { rows: await call(path, { symbol, period: "annual", limit: 10 }, key), limit: 10 };
    } catch (e) {
      if (e.code !== 402) throw e;
      const rows = await call(path, { symbol, period: "annual", limit: 5 }, key);
      if (notes.indexOf(NOTE5) < 0) notes.push(NOTE5);
      return { rows, limit: 5 };
    }
  }
  const NOTE5 = "Ücretsiz plan yalnızca son 5 yıllık tabloya izin veriyor; analiz eldeki yıllara göre yapıldı.";

  const byDateAsc = (a, b) => (a.date < b.date ? -1 : 1);

  VC.fetchAll = async function (symbol, key) {
    const notes = [];
    const prof = await call("profile", { symbol }, key);
    if (!Array.isArray(prof) || !prof.length) {
      throw fail("nodata", symbol + " için veri bulunamadı. Kod doğru mu? (Ücretsiz plan genelde yalnızca ABD hisselerini kapsar.)");
    }
    const inc = await statement("income-statement", symbol, key, notes);
    const bal = await statement("balance-sheet-statement", symbol, key, notes);
    let cf;
    try { cf = await statement("cash-flow-statement", symbol, key, notes); }
    catch (e) { if (e.code !== 404) throw e; cf = await statement("cashflow-statement", symbol, key, notes); }
    if (!inc.rows.length || !bal.rows.length || !cf.rows.length) {
      throw fail("nodata", symbol + " için finansal tablo bulunamadı.");
    }
    let prices = [];
    try {
      const from = (new Date().getFullYear() - 11) + "-01-01";
      const p = await call("historical-price-eod/light", { symbol, from }, key);
      prices = (Array.isArray(p) ? p : [])
        .map((r) => ({ date: r.date, price: r.price != null ? r.price : r.close }))
        .filter((r) => r.date && isFinite(r.price))
        .sort(byDateAsc);
    } catch (e) {
      notes.push("Geçmiş fiyat verisi alınamadı (" + e.message + "). F/K geçmişi ve 1 dolar testi etkilenebilir.");
    }
    if (!prices.length && notes.every((n) => n.indexOf("fiyat") < 0)) {
      notes.push("Geçmiş fiyat verisi boş geldi. F/K geçmişi ve 1 dolar testi hesaplanamayabilir.");
    }
    return {
      profile: prof[0],
      income: inc.rows.slice().sort(byDateAsc),
      balance: bal.rows.slice().sort(byDateAsc),
      cash: cf.rows.slice().sort(byDateAsc),
      prices,
      notes,
    };
  };
})((window.VC = window.VC || {}));
