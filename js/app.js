// Ekran akışı, ayarlar ve görüntüleme.
(function (VC) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SKEY = "vc_settings";

  function defaults() {
    const w = {};
    VC.CRITERIA.forEach((c) => { w[c.key] = c.weight; });
    return { weights: w, dcf: Object.assign({}, VC.DEFAULT_DCF) };
  }
  function loadSettings() {
    const d = defaults();
    try {
      const s = JSON.parse(localStorage.getItem(SKEY));
      if (s && s.weights) Object.keys(d.weights).forEach((k) => { if (isFinite(s.weights[k])) d.weights[k] = +s.weights[k]; });
      if (s && s.dcf) Object.keys(d.dcf).forEach((k) => { if (isFinite(s.dcf[k])) d.dcf[k] = +s.dcf[k]; });
    } catch (e) { /* bozuk kayıt: varsayılan */ }
    return d;
  }
  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { /* özel pencere */ } }

  let settings = loadSettings();
  let state = null; // {ticker, profile, years, notes}

  const keyReady = () => typeof FMP_API_KEY === "string" && FMP_API_KEY.length > 0 && FMP_API_KEY !== "BURAYA_ANAHTARINIZI_YAZIN";

  function setStatus(msg, isError) {
    const el = $("status");
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
  }

  // ---- Evet/Hayır sorusu ----
  const ukey = (t) => "vc_understand_" + t;
  function getAns(t) { try { return localStorage.getItem(ukey(t)); } catch (e) { return null; } }
  function showAns(a) {
    document.querySelectorAll("#understand .yn .btn").forEach((b) => b.classList.toggle("active", b.dataset.ans === a));
    $("understandWarn").classList.toggle("hidden", a !== "no");
  }
  document.querySelectorAll("#understand .yn .btn").forEach((b) => b.addEventListener("click", () => {
    if (!state) return;
    try { localStorage.setItem(ukey(state.ticker), b.dataset.ans); } catch (e) { /* yoksay */ }
    showAns(b.dataset.ans);
  }));

  // ---- Görüntüleme ----
  function verdict(t) {
    return t >= 75 ? "Buffett ölçütlerine güçlü uyum" : t >= 55 ? "Kısmen uyumlu" : "Zayıf uyum";
  }
  function render() {
    if (!state) return;
    const S = VC.score({ years: state.years, price: +state.profile.price, settings });
    const t = S.total;
    $("total").innerHTML =
      '<div class="total-main"><div class="big">' + (t == null ? "—" : Math.round(t)) + '<small>/100</small></div>' +
      '<div><div class="verdict">' + (t == null ? "Hesaplanamadı" : verdict(t)) + "</div>" +
      '<div class="muted">' + S.scoredCount + "/" + S.count + " kriter puanlandı" +
      (S.scoredCount < S.count ? ". Toplam, yalnızca puanlanan kriterlerin ağırlığına göre 100'e çevrildi." : ".") + "</div>" +
      (state.notes.length ? '<ul class="notes">' + state.notes.map((n) => "<li>" + esc(n) + "</li>").join("") + "</ul>" : "") +
      '<div class="muted">Veri: ' + state.years.length + " yıllık (" + esc(state.years[0].year) + "–" + esc(state.years[state.years.length - 1].year) + ").</div></div></div>";
    $("criteria").innerHTML = S.results.map((r) => {
      const head = '<div class="chead"><h3>' + esc(r.name) + '</h3><span class="pill' + (r.f == null ? " nodata" : "") + '">' +
        (r.f == null ? "VERİ YOK" : r.points.toFixed(1).replace(".", ",") + " / " + r.weight) + "</span></div>";
      const facts = r.facts.length ? '<dl class="facts">' + r.facts.map((f) => "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>").join("") + "</dl>" : "";
      return '<article class="card crit' + (r.f == null ? " nodata" : "") + '">' + head + facts +
        '<p class="reason">' + esc(r.reason) + "</p>" + (r.chart ? VC.chart(r.chart, r.name) : "") + "</article>";
    }).join("");
    $("result").classList.remove("hidden");
  }

  // ---- Analiz ----
  async function analyze(ticker) {
    $("understand").classList.add("hidden");
    $("result").classList.add("hidden");
    state = null;
    setStatus(ticker + " için veri çekiliyor…");
    $("searchBtn").disabled = true;
    try {
      const raw = await VC.fetchAll(ticker, FMP_API_KEY);
      const years = VC.m.buildYears(raw);
      state = { ticker, profile: raw.profile, years, notes: raw.notes };
      $("companyName").textContent = (raw.profile.companyName || ticker) + " (" + ticker + ")";
      showAns(getAns(ticker));
      $("understand").classList.remove("hidden");
      setStatus("");
      render();
    } catch (e) {
      setStatus(e.message || "Bilinmeyen bir hata oluştu.", true);
    } finally {
      $("searchBtn").disabled = false;
    }
  }

  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("tickerInput").value.trim().toUpperCase();
    if (!/^[A-Z0-9.\-]{1,10}$/.test(t)) return setStatus("Geçerli bir hisse kodu yazın (örn. NVDA).", true);
    if (!keyReady()) return setStatus("API anahtarı yok. config.example.js dosyasını js/config.js olarak kopyalayıp anahtarınızı yazın.", true);
    analyze(t);
  });

  // ---- Ayarlar ----
  function buildSettings() {
    $("weights").innerHTML = VC.CRITERIA.map((c) =>
      '<label class="wrow"><span>' + esc(c.name) + '</span><input type="range" min="0" max="40" step="1" data-w="' + c.key + '" value="' + settings.weights[c.key] + '">' +
      '<output id="o_' + c.key + '">' + settings.weights[c.key] + "</output></label>").join("") +
      '<h3 class="sub">DCF varsayımları</h3>' +
      [["discount", "İskonto oranı (%)", 5, 15, 0.5], ["growthCap", "Büyüme tavanı (%)", 0, 20, 1], ["terminal", "Sonsuz büyüme (%)", 0, 4, 0.5]].map((d) =>
        '<label class="wrow"><span>' + d[1] + '</span><input type="range" min="' + d[2] + '" max="' + d[3] + '" step="' + d[4] + '" data-d="' + d[0] + '" value="' + settings.dcf[d[0]] + '"><output id="od_' + d[0] + '">' + settings.dcf[d[0]] + "</output></label>").join("");
    sumInfo();
  }
  function sumInfo() {
    const s = VC.CRITERIA.reduce((a, c) => a + settings.weights[c.key], 0);
    $("weightSum").textContent = "Toplam ağırlık: " + s + (s === 100 ? "" : " (100 değil; puan yine de oranlanarak 100 üzerinden gösterilir)");
  }
  $("weights").addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.w) { settings.weights[el.dataset.w] = +el.value; $("o_" + el.dataset.w).textContent = el.value; sumInfo(); }
    else if (el.dataset.d) { settings.dcf[el.dataset.d] = +el.value; $("od_" + el.dataset.d).textContent = el.value; }
    else return;
    saveSettings();
    render();
  });
  $("resetWeights").addEventListener("click", () => { settings = defaults(); saveSettings(); buildSettings(); render(); });
  $("settingsBtn").addEventListener("click", () => $("settingsPanel").classList.remove("hidden"));
  $("closeSettings").addEventListener("click", () => $("settingsPanel").classList.add("hidden"));
  $("settingsPanel").addEventListener("click", (e) => { if (e.target === $("settingsPanel")) $("settingsPanel").classList.add("hidden"); });

  buildSettings();
  if (!keyReady()) setStatus("API anahtarı bulunamadı. config.example.js → js/config.js olarak kopyalayıp anahtarınızı yazın.", true);
})((window.VC = window.VC || {}));
