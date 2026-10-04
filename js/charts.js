// Kütüphanesiz basit SVG grafikler (çizgi ve çubuk).
(function (VC) {
  "use strict";
  const COLORS = ["#3fb98f", "#5aa9ff", "#e0a63a"];
  const W = 320, H = 150, PL = 46, PR = 8, PT = 10, PB = 22;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function scale(vals) {
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    lo = Math.min(lo, 0); hi = Math.max(hi, 0);
    if (lo === hi) hi = lo + 1;
    return { lo, hi, y: (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB) };
  }
  function frame(sc, fmt, labels, xAt) {
    let s = '<line class="ax" x1="' + PL + '" x2="' + (W - PR) + '" y1="' + sc.y(0) + '" y2="' + sc.y(0) + '"/>';
    [sc.hi, sc.lo].forEach((v) => {
      s += '<text class="tk" x="' + (PL - 4) + '" y="' + (sc.y(v) + 3) + '" text-anchor="end">' + esc(fmt(v)) + "</text>";
    });
    const idx = labels.length <= 6 ? labels.map((_, i) => i) : [0, Math.floor((labels.length - 1) / 2), labels.length - 1];
    idx.forEach((i) => {
      s += '<text class="tk" x="' + xAt(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === labels.length - 1 && labels.length > 1 ? 'end' : 'middle') + '">' + esc(labels[i]) + "</text>";
    });
    return s;
  }
  const legend = (series) => '<div class="legend">' + series.map((s, i) =>
    '<span><i style="background:' + COLORS[i % 3] + '"></i>' + esc(s.name) + "</span>").join("") + "</div>";
  const wrap = (svg, series, label) =>
    '<div class="chart"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(label) + '">' + svg + "</svg>" + legend(series) + "</div>";

  function line(c, label) {
    const labels = c.series[0].data.map((d) => d.label);
    const vals = [];
    c.series.forEach((s) => s.data.forEach((d) => { if (d.value != null) vals.push(d.value); }));
    if (!vals.length) return "";
    const sc = scale(vals), n = labels.length;
    const xAt = (i) => PL + (n === 1 ? 0.5 : i / (n - 1)) * (W - PL - PR);
    let svg = frame(sc, c.fmt, labels, xAt);
    c.series.forEach((s, k) => {
      let d = "", pen = false, dots = "";
      s.data.forEach((p, i) => {
        if (p.value == null) { pen = false; return; }
        d += (pen ? "L" : "M") + xAt(i).toFixed(1) + " " + sc.y(p.value).toFixed(1);
        pen = true;
        dots += '<circle cx="' + xAt(i).toFixed(1) + '" cy="' + sc.y(p.value).toFixed(1) + '" r="2.5" fill="' + COLORS[k % 3] + '"><title>' + esc(p.label + ": " + c.fmt(p.value)) + "</title></circle>";
      });
      svg += '<path d="' + d + '" fill="none" stroke="' + COLORS[k % 3] + '" stroke-width="2"/>' + dots;
    });
    return wrap(svg, c.series, label);
  }

  function bar(c, label) {
    const vals = [];
    c.groups.forEach((g) => g.values.forEach((v) => { if (v != null) vals.push(v); }));
    if (!vals.length) return "";
    const sc = scale(vals), n = c.groups.length, k = c.series.length;
    const gw = (W - PL - PR) / n, bw = Math.min(26, (gw * 0.8) / k);
    const xAt = (i) => PL + gw * (i + 0.5);
    let svg = frame(sc, c.fmt, c.groups.map((g) => g.label), xAt);
    c.groups.forEach((g, i) => {
      g.values.forEach((v, j) => {
        if (v == null) return;
        const x = xAt(i) - (bw * k) / 2 + j * bw, y0 = sc.y(0), y1 = sc.y(v);
        svg += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + (bw - 1).toFixed(1) +
          '" height="' + Math.max(1, Math.abs(y1 - y0)).toFixed(1) + '" fill="' + COLORS[j % 3] + '" rx="1"><title>' +
          esc(g.label + " · " + c.series[j].name + ": " + c.fmt(v)) + "</title></rect>";
        if (n <= 2) svg += '<text class="vl" x="' + (x + bw / 2).toFixed(1) + '" y="' + (Math.min(y0, y1) - 3).toFixed(1) + '" text-anchor="middle">' + esc(c.fmt(v)) + "</text>";
      });
    });
    return wrap(svg, c.series, label);
  }

  VC.chart = (c, label) => (!c ? "" : c.type === "line" ? line(c, label) : bar(c, label));
})((window.VC = window.VC || {}));
