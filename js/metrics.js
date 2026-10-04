// Ham FMP tablolarından yıllık rakamlar ve yardımcı istatistikler.
(function (VC) {
  "use strict";
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  const first = function () { for (let i = 0; i < arguments.length; i++) { const x = num(arguments[i]); if (x !== null) return x; } return null; };
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const std = (a) => { if (a.length < 2) return null; const m = avg(a); return Math.sqrt(avg(a.map((x) => (x - m) * (x - m)))); };
  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  // v, a'dayken 0; b'dayken 1. b < a ise ters çalışır (düşük değer iyi).
  const lerp = (v, a, b) => (v == null ? null : clamp01((v - a) / (b - a)));
  const cagr = (a, b, yrs) => (a > 0 && b > 0 && yrs > 0 ? Math.pow(b / a, 1 / yrs) - 1 : null);
  // parçalı puan: eksik parçalar atlanır, kalanların ağırlığı yeniden dağıtılır
  const combine = (parts) => {
    let w = 0, s = 0, miss = false;
    parts.forEach((p) => { if (p.f == null) { miss = true; return; } w += p.w; s += p.w * p.f; });
    return w === 0 ? null : { f: s / w, partial: miss };
  };
  const notNull = (x) => x != null;

  const DEFAULT_TAX = 0.21; // vergi oranı hesaplanamayan yıllar için ABD kurumlar vergisi

  function priceAt(prices, date) {
    const t = Date.parse(date);
    let best = null;
    for (let i = 0; i < prices.length; i++) {
      if (Date.parse(prices[i].date) <= t) best = prices[i]; else break;
    }
    if (!best) return null;
    return t - Date.parse(best.date) <= 10 * 864e5 ? best.price : null;
  }

  function match(rows, inc) {
    let r = rows.find((x) => x.date === inc.date);
    if (!r && inc.fiscalYear != null) r = rows.find((x) => String(x.fiscalYear) === String(inc.fiscalYear));
    return r || {};
  }

  function buildYears(raw) {
    return raw.income.map((i) => {
      const b = match(raw.balance, i), c = match(raw.cash, i);
      const revenue = num(i.revenue), gp = num(i.grossProfit), op = num(i.operatingIncome);
      const ni = first(i.netIncome, c.netIncome);
      const interest = num(i.interestExpense) !== null ? Math.abs(i.interestExpense) : null;
      const shares = first(i.weightedAverageShsOutDil, i.weightedAverageShsOut);
      const da = first(c.depreciationAndAmortization, i.depreciationAndAmortization);
      const ocf = first(c.netCashProvidedByOperatingActivities, c.operatingCashFlow);
      const capexRaw = num(c.capitalExpenditure);
      const capex = capexRaw !== null ? Math.abs(capexRaw) : null;
      const fcf = first(c.freeCashFlow, ocf !== null && capex !== null ? ocf - capex : null);
      const debt = first(b.totalDebt, (num(b.shortTermDebt) || 0) + (num(b.longTermDebt) || 0) || null);
      const cash = first(b.cashAndShortTermInvestments, b.cashAndCashEquivalents);
      const equity = num(b.totalStockholdersEquity);
      const divRaw = first(c.commonDividendsPaid, c.netDividendsPaid);
      const pretax = num(i.incomeBeforeTax), taxExp = num(i.incomeTaxExpense);
      const tax = pretax !== null && pretax > 0 && taxExp !== null ? Math.max(0, Math.min(0.35, taxExp / pretax)) : DEFAULT_TAX;
      const ic = equity !== null && debt !== null && cash !== null ? equity + debt - cash : null;
      const roic = op !== null && ic !== null && ic > 0 ? (op * (1 - tax)) / ic : null;
      const capital = equity !== null && debt !== null ? equity + debt : null;
      const interestForU = interest !== null ? interest : debt === 0 ? 0 : null;
      const uROE = ni !== null && capital !== null && capital > 0 && interestForU !== null ? (ni + interestForU * (1 - tax)) / capital : null;
      const price = priceAt(raw.prices || [], i.date);
      const eps = ni !== null && shares ? ni / shares : null;
      return {
        year: String(i.fiscalYear || (i.date || "").slice(0, 4)), date: i.date,
        revenue, grossProfit: gp, operatingIncome: op, netIncome: ni, interest, shares, da, ocf, capex, fcf,
        ownerEarnings: ni !== null && da !== null && capex !== null ? ni + da - capex : null,
        debt, cash, equity, dividends: divRaw !== null ? Math.abs(divRaw) : null, tax,
        grossMargin: revenue && gp !== null ? gp / revenue : null,
        roic, uROE, price,
        mcap: price !== null && shares ? price * shares : null,
        pe: price !== null && eps !== null && eps > 0 ? price / eps : null,
      };
    });
  }

  VC.m = { num, avg, std, median, lerp, cagr, combine, notNull, clamp01, buildYears, priceAt };
})((window.VC = window.VC || {}));
