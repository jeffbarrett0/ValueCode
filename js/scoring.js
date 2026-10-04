// 7 Buffett kriteri: her biri 0-1 arası oran (f), rakamlar (facts) ve Türkçe gerekçe döndürür.
(function (VC) {
  "use strict";
  const M = VC.m;

  VC.CRITERIA = [
    { key: "moat", name: "Moat (Hendek)", weight: 20 },
    { key: "stability", name: "Kazanç istikrarı", weight: 15 },
    { key: "owner", name: "Sahip kazancı", weight: 15 },
    { key: "debt", name: "Borç", weight: 15 },
    { key: "price", name: "Fiyat", weight: 15 },
    { key: "mgmt", name: "Yönetim", weight: 10 },
    { key: "dollar", name: "1 dolar testi", weight: 10 },
  ];
  VC.DEFAULT_DCF = { discount: 10, growthCap: 10, terminal: 2.5 }; // yüzde

  // ---- biçimlendirme ----
  const pct = (x, d) => (x == null ? "yok" : (x * 100).toFixed(d == null ? 1 : d).replace(".", ",") + "%");
  const rat = (x) => (x == null ? "yok" : x.toFixed(2).replace(".", ",") + "x");
  const usd = (x) => {
    if (x == null) return "yok";
    const a = Math.abs(x), s = x < 0 ? "-" : "";
    if (a >= 1e12) return s + "$" + (a / 1e12).toFixed(2).replace(".", ",") + " tr";
    if (a >= 1e9) return s + "$" + (a / 1e9).toFixed(1).replace(".", ",") + " mr";
    if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(0) + " mn";
    return s + "$" + a.toFixed(0);
  };
  const px = (x) => (x == null ? "yok" : "$" + x.toFixed(2).replace(".", ","));
  VC.fmt = { pct, rat, usd, px };

  const grade = (f) => (f >= 0.75 ? "güçlü" : f >= 0.5 ? "orta" : f >= 0.25 ? "zayıf" : "çok zayıf");
  const noData = (why) => ({ f: null, partial: false, facts: [], reason: "Veri yok: " + why });
  const done = (c, facts, text, chart) => ({
    f: c.f, partial: c.partial, facts,
    reason: text + " Sonuç: " + grade(c.f) + (c.partial ? " (kısmi veri: bazı ölçütler hesaplanamadı)." : "."),
    chart,
  });
  const col = (Y, k) => Y.map((y) => y[k]);
  const clean = (a) => a.filter(M.notNull);

  // ---- 1. Moat ----
  function moat(ctx) {
    const Y = ctx.years;
    const roics = clean(col(Y, "roic")), gms = clean(col(Y, "grossMargin"));
    const roicOk = roics.length >= 3, gmOk = gms.length >= 3;
    if (!roicOk && !gmOk) return noData("ROIC ve brüt marj için en az 3 yıllık veri gerekli.");
    const roicAvg = roicOk ? M.avg(roics) : null;
    const above = roicOk ? roics.filter((r) => r > 0.15).length : null;
    const gmAvg = gmOk ? M.avg(gms) : null, gmSd = gmOk ? M.std(gms) : null;
    const c = M.combine([
      { w: 0.4, f: M.lerp(roicAvg, 0.05, 0.2) },
      { w: 0.25, f: roicOk ? above / roics.length : null },
      { w: 0.2, f: M.lerp(gmAvg, 0.2, 0.5) },
      { w: 0.15, f: M.lerp(gmSd, 0.1, 0.03) },
    ]);
    return done(c, [
      ["Ortalama ROIC", pct(roicAvg)],
      ["ROIC %15 üstü yıl", roicOk ? above + "/" + roics.length : "yok"],
      ["Ortalama brüt marj", pct(gmAvg)],
      ["Brüt marj dalgalanması", gmOk ? "±" + (gmSd * 100).toFixed(1).replace(".", ",") + " puan" : "yok"],
    ], "Yüksek ve istikrarlı ROIC ile brüt marj, rakiplerin kolay aşamadığı bir hendek işaretidir.",
    { type: "line", fmt: pct, series: [
      { name: "ROIC", data: Y.map((y) => ({ label: y.year, value: y.roic })) },
      { name: "Brüt marj", data: Y.map((y) => ({ label: y.year, value: y.grossMargin })) },
    ] });
  }

  // ---- 2. Kazanç istikrarı ----
  function stability(ctx) {
    const Y = ctx.years;
    if (Y.length < 3) return noData("en az 3 yıllık gelir ve kâr verisi gerekli.");
    const n = Y.length - 1;
    const rev = clean(col(Y, "revenue")), ni = clean(col(Y, "netIncome"));
    if (rev.length < 3 && ni.length < 3) return noData("gelir ve net kâr verisi eksik.");
    const revC = rev.length >= 3 ? M.cagr(Y[0].revenue, Y[n].revenue, n) : null;
    const niC = ni.length >= 3 && Y[0].netIncome != null && Y[n].netIncome != null ? M.cagr(Y[0].netIncome, Y[n].netIncome, n) : null;
    const losses = ni.length >= 3 ? ni.filter((x) => x < 0).length : null;
    let up = 0, tot = 0;
    for (let i = 1; i < Y.length; i++) if (Y[i].revenue != null && Y[i - 1].revenue != null) { tot++; if (Y[i].revenue > Y[i - 1].revenue) up++; }
    const c = M.combine([
      { w: 0.25, f: M.lerp(revC, 0, 0.1) },
      { w: 0.25, f: M.lerp(niC, 0, 0.12) },
      { w: 0.25, f: losses == null ? null : M.lerp(losses, 3, 0) },
      { w: 0.25, f: tot ? up / tot : null },
    ]);
    return done(c, [
      ["Gelir büyümesi (yıllık)", revC == null ? "hesaplanamadı" : pct(revC)],
      ["Net kâr büyümesi (yıllık)", niC == null ? "hesaplanamadı (başlangıç/bitiş kârı ≤ 0)" : pct(niC)],
      ["Zarar yılı", losses == null ? "yok" : losses + "/" + ni.length],
      ["Geliri artan yıl", tot ? up + "/" + tot : "yok"],
    ], "Düzenli büyüyen gelir ve kâr ile az zarar yılı, tahmin edilebilir bir işletmeyi gösterir.",
    { type: "bar", fmt: VC.fmt.usd, series: [{ name: "Gelir" }, { name: "Net kâr" }],
      groups: Y.map((y) => ({ label: y.year, values: [y.revenue, y.netIncome] })) });
  }

  // ---- 3. Sahip kazancı ----
  function owner(ctx) {
    const Y = ctx.years;
    const oe = clean(col(Y, "ownerEarnings"));
    if (oe.length < 3) return noData("amortisman, capex veya net kâr verisi eksik (en az 3 yıl gerekli).");
    const posShare = oe.filter((x) => x > 0).length / oe.length;
    const both = Y.filter((y) => y.fcf != null && y.netIncome != null);
    const sumNI = both.reduce((s, y) => s + y.netIncome, 0), sumF = both.reduce((s, y) => s + y.fcf, 0);
    const fcfNi = both.length >= 3 && sumNI > 0 ? sumF / sumNI : null;
    const oeYears = Y.filter((y) => y.ownerEarnings != null);
    const oeG = M.cagr(oeYears[0].ownerEarnings, oeYears[oeYears.length - 1].ownerEarnings, oeYears.length - 1);
    const c = M.combine([
      { w: 0.35, f: posShare },
      { w: 0.35, f: M.lerp(fcfNi, 0.5, 1) },
      { w: 0.3, f: M.lerp(oeG, 0, 0.1) },
    ]);
    const last = Y[Y.length - 1];
    return done(c, [
      ["Son yıl sahip kazancı", usd(last.ownerEarnings)],
      ["Sahip kazancı pozitif yıl", oe.filter((x) => x > 0).length + "/" + oe.length],
      ["Toplam FCF / toplam net kâr", fcfNi == null ? "hesaplanamadı" : rat(fcfNi)],
      ["Sahip kazancı büyümesi (yıllık)", oeG == null ? "hesaplanamadı" : pct(oeG)],
    ], "Sahip kazancı = net kâr + amortisman − capex. Kâr ile nakit akışı uyumluysa kâr \"gerçek\" demektir.",
    { type: "bar", fmt: VC.fmt.usd, series: [{ name: "Net kâr" }, { name: "FCF" }, { name: "Sahip kazancı" }],
      groups: Y.map((y) => ({ label: y.year, values: [y.netIncome, y.fcf, y.ownerEarnings] })) });
  }

  // ---- 4. Borç ----
  function debt(ctx) {
    const Y = ctx.years, L = Y[Y.length - 1];
    if (L.debt == null) return noData("toplam borç verisi yok.");
    const de = L.equity != null && L.equity > 0 ? L.debt / L.equity : null;
    const net = L.cash != null ? L.debt - L.cash : null;
    let nf = null;
    if (net != null && L.fcf != null) nf = net <= 0 ? 0 : L.fcf <= 0 ? Infinity : net / L.fcf;
    let cov = null, covTxt = "yok";
    if (L.operatingIncome != null) {
      if (L.interest != null && L.interest > 0) { cov = L.operatingIncome / L.interest; covTxt = rat(cov); }
      else if (L.debt === 0) { cov = 99; covTxt = "borç yok"; }
      else covTxt = "faiz gideri verisi yok";
    }
    const c = M.combine([
      { w: 0.35, f: de == null && L.equity != null && L.equity <= 0 ? 0 : M.lerp(de, 2, 0.3) },
      { w: 0.35, f: nf == null ? null : nf === Infinity ? 0 : M.lerp(nf, 6, 1) },
      { w: 0.3, f: M.lerp(cov, 2, 10) },
    ]);
    if (!c) return noData("borç/özsermaye, net borç/FCF ve faiz karşılama oranının hiçbiri hesaplanamadı.");
    return done(c, [
      ["Borç / özsermaye", de != null ? rat(de) : L.equity != null && L.equity <= 0 ? "özsermaye negatif" : "yok"],
      ["Net borç / FCF", nf == null ? "yok" : nf === Infinity ? "FCF ≤ 0" : net <= 0 ? "net nakit pozitif" : rat(nf)],
      ["Faiz karşılama (FVÖK/faiz)", covTxt],
    ], "Buffett az borç sever: şirket borcunu birkaç yılda nakit akışıyla kapatabilmeli.",
    { type: "bar", fmt: usd, series: [{ name: "Toplam borç" }, { name: "Serbest nakit akışı" }],
      groups: Y.map((y) => ({ label: y.year, values: [y.debt, y.fcf] })) });
  }

  // ---- 5. Fiyat ----
  function dcf(base, g, r, tg, n) {
    let pv = 0, f = base;
    for (let t = 1; t <= n; t++) { f *= 1 + g; pv += f / Math.pow(1 + r, t); }
    return pv + (f * (1 + tg)) / (r - tg) / Math.pow(1 + r, n);
  }
  VC.dcf = dcf;
  function price(ctx) {
    const Y = ctx.years, L = Y[Y.length - 1], p = ctx.price, s = ctx.settings.dcf;
    if (!(p > 0) || !L.shares) return noData("güncel fiyat veya hisse sayısı yok.");
    const mcap = p * L.shares;
    const fy = L.fcf != null ? L.fcf / mcap : null;
    const eps = L.netIncome != null && L.netIncome > 0 ? L.netIncome / L.shares : null;
    const pe = eps ? p / eps : null;
    const hist = clean(col(Y, "pe"));
    const medPe = hist.length >= 3 ? M.median(hist) : null;
    const peRel = pe && medPe ? pe / medPe : null;
    // DCF
    const fc = clean(col(Y, "fcf"));
    const base = fc.length >= 3 ? M.avg(fc.slice(-3)) : null;
    let iv = null, mos = null, gUsed = null, gNote = "";
    const r = s.discount / 100, tg = s.terminal / 100;
    if (base != null && base > 0 && r > tg) {
      const fy0 = Y.find((y) => y.fcf != null), g0 = M.cagr(fy0.fcf, L.fcf, Y.indexOf(L) - Y.indexOf(fy0));
      gUsed = Math.max(0, Math.min(s.growthCap / 100, g0 == null ? 0 : g0));
      gNote = g0 == null ? "FCF büyümesi hesaplanamadı, %0 varsayıldı" : "";
      iv = dcf(base, gUsed, r, tg, 10) / L.shares;
      mos = (iv - p) / iv;
    }
    const c = M.combine([
      { w: 0.3, f: M.lerp(fy, 0.02, 0.08) },
      { w: 0.3, f: M.lerp(peRel, 1.3, 0.8) },
      { w: 0.4, f: M.lerp(mos, -0.2, 0.3) },
    ]);
    if (!c) return noData("FCF getirisi, F/K geçmişi ve DCF hesaplanamadı.");
    let chart = null;
    if (iv != null) chart = { type: "bar", fmt: px, series: [{ name: "Güncel fiyat" }, { name: "İçsel değer (DCF)" }], groups: [{ label: "Hisse başı", values: [p, iv] }] };
    else if (hist.length >= 3) chart = { type: "line", fmt: (x) => (x == null ? "yok" : x.toFixed(1)), series: [{ name: "F/K", data: Y.map((y) => ({ label: y.year, value: y.pe })) }] };
    return done(c, [
      ["FCF getirisi", pct(fy)],
      ["F/K (şimdi / geçmiş medyan)", pe ? pe.toFixed(1).replace(".", ",") + " / " + (medPe ? medPe.toFixed(1).replace(".", ",") : "yok") : "yok (zarar)"],
      ["İçsel değer (DCF)", iv != null ? px(iv) + " (büyüme " + pct(gUsed) + ")" : "hesaplanamadı (ort. FCF ≤ 0 veya veri az)"],
      ["Güvenlik marjı", mos == null ? "yok" : pct(mos, 0)],
      ["Güncel fiyat", px(p)],
    ], "Fiyat kısmı kaba bir tahmindir; DCF son 3 yıl ort. FCF'yi " + s.growthCap + "% tavanlı büyümeyle 10 yıl taşır, iskonto %" + s.discount + "." + (gNote ? " (" + gNote + ".)" : ""), chart);
  }

  // ---- 6. Yönetim ----
  function mgmt(ctx) {
    const Y = ctx.years;
    const sh = Y.filter((y) => y.shares);
    const ur = clean(col(Y, "uROE"));
    if (sh.length < 3 && ur.length < 3) return noData("hisse sayısı ve ROE için en az 3 yıllık veri gerekli.");
    const shC = sh.length >= 3 ? M.cagr(sh[0].shares, sh[sh.length - 1].shares, sh.length - 1) : null;
    const urAvg = ur.length >= 3 ? M.avg(ur) : null;
    const c = M.combine([
      { w: 0.5, f: M.lerp(shC, 0.02, -0.02) },
      { w: 0.5, f: M.lerp(urAvg, 0.08, 0.2) },
    ]);
    return done(c, [
      ["Hisse sayısı değişimi (yıllık)", shC == null ? "yok" : (shC > 0 ? "+" : "") + pct(shC) + (shC < 0 ? " (geri alım)" : " (sulandırma)")],
      ["Kaldıraçsız ROE (ortalama)", pct(urAvg)],
    ], "Hisse sayısı azalıyorsa yönetim ortağın payını büyütüyor. Kaldıraçsız ROE = (net kâr + vergi sonrası faiz) / (özsermaye + borç).",
    { type: "line", fmt: (x) => (x == null ? "yok" : (x / 1e6).toFixed(0) + " mn"), series: [
      { name: "Seyreltilmiş hisse sayısı", data: Y.map((y) => ({ label: y.year, value: y.shares })) }] });
  }

  // ---- 7. 1 dolar testi ----
  function dollar(ctx) {
    const Y = ctx.years;
    const n = Math.min(5, Y.length - 1);
    if (n < 3) return noData("en az 4 yıllık tablo gerekli.");
    const S = Y[Y.length - 1 - n], E = Y[Y.length - 1];
    if (S.mcap == null || E.mcap == null) return noData("başlangıç/bitiş dönemi piyasa değeri hesaplanamadı (geçmiş fiyat yok).");
    const win = Y.slice(Y.length - n);
    if (win.some((y) => y.netIncome == null || y.dividends == null)) return noData("net kâr veya temettü verisi eksik; elde tutulan kâr hesaplanamadı.");
    const retained = win.reduce((s, y) => s + y.netIncome - y.dividends, 0);
    const dm = E.mcap - S.mcap;
    if (retained <= 0) return noData("dönemde elde tutulan kâr ≤ 0; oran anlamlı değil (piyasa değeri değişimi " + usd(dm) + ").");
    const ratio = dm / retained;
    const c = { f: M.lerp(ratio, 0.3, 1.3), partial: false };
    return done(c, [
      ["Dönem", S.year + " → " + E.year + " (" + n + " yıl)"],
      ["Elde tutulan kâr", usd(retained)],
      ["Piyasa değeri artışı", usd(dm)],
      ["Her 1$ kâr için değer", ratio.toFixed(2).replace(".", ",") + " $"],
    ], "Buffett: tutulan her 1 dolar kâr en az 1 dolar piyasa değeri yaratmalı. Piyasa değeri = yıl sonu fiyatı × seyreltilmiş hisse (yaklaşık).",
    { type: "bar", fmt: usd, series: [{ name: "Elde tutulan kâr" }, { name: "Piyasa değeri artışı" }], groups: [{ label: n + " yıl", values: [retained, dm] }] });
  }

  const FNS = { moat, stability, owner, debt, price, mgmt, dollar };

  // Tüm kriterleri hesapla; toplamı yalnızca puanlanabilen kriterler üzerinden 100'e normalle.
  VC.score = function (ctx) {
    const results = VC.CRITERIA.map((cr) => {
      const w = ctx.settings.weights[cr.key];
      const r = FNS[cr.key](ctx);
      return Object.assign({ key: cr.key, name: cr.name, weight: w }, r, { points: r.f == null ? null : r.f * w });
    });
    const scored = results.filter((r) => r.f != null && r.weight > 0);
    const wSum = scored.reduce((s, r) => s + r.weight, 0);
    const total = wSum > 0 ? (scored.reduce((s, r) => s + r.points, 0) / wSum) * 100 : null;
    return { results, total, scoredCount: scored.length, count: results.filter((r) => r.weight > 0).length };
  };
})((window.VC = window.VC || {}));
