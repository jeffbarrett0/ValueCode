// Adım 1: sadece iskelet. Veri çekme Adım 2'de eklenecek.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function keyReady() {
    return typeof FMP_API_KEY === "string" &&
      FMP_API_KEY.length > 0 && FMP_API_KEY !== "BURAYA_ANAHTARINIZI_YAZIN";
  }

  function setStatus(msg, isError) {
    const el = $("status");
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
  }

  $("settingsBtn").addEventListener("click", () => $("settingsPanel").classList.remove("hidden"));
  $("closeSettings").addEventListener("click", () => $("settingsPanel").classList.add("hidden"));

  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("tickerInput").value.trim().toUpperCase();
    if (!t) return setStatus("Lütfen bir hisse kodu yazın.", true);
    if (!keyReady()) {
      return setStatus("API anahtarı yok. config.example.js dosyasını js/config.js olarak kopyalayıp anahtarınızı yazın.", true);
    }
    setStatus("Veri çekme Adım 2'de eklenecek. Şimdilik iskelet hazır: " + t);
  });

  if (!keyReady()) {
    setStatus("API anahtarı bulunamadı. config.example.js → js/config.js olarak kopyalayıp anahtarınızı yazın.", true);
  }
})();
