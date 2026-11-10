/* SOMA KPI dashboard — renderer. Reads window.SOMA_DATA (data.js). Hand-built SVG, no libraries.
   Motion follows the HAI motion spec: draw-on once in view, ambient loop pauses off-screen / tab hidden /
   user-paused, nothing moves under prefers-reduced-motion. */
(function () {
  'use strict';
  var D = window.SOMA_DATA || {};
  var NS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };

  /* ---------------- helpers ---------------- */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, attrs) { var t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent); t.textContent = s; return t; }
  // sum of the numeric values; null when none are numeric. .partial = some were missing.
  function sum(list) {
    var t = 0, n = 0, miss = 0;
    list.forEach(function (v) { if (isNum(v)) { t += v; n++; } else miss++; });
    return n ? { v: t, partial: miss > 0 } : null;
  }
  function div(a, b) { return isNum(a) && isNum(b) && b > 0 ? a / b : null; }
  function niceMax(v) {
    if (!isNum(v) || v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    // max = 4 ticks of a nice step (1, 2, 2.5, 5 x 10^k) so axis labels read cleanly
    var step = v / 4, sp = Math.pow(10, Math.floor(Math.log10(step))), sm = step / sp;
    var ns = sm <= 1 ? 1 : sm <= 2 ? 2 : sm <= 2.5 ? 2.5 : sm <= 5 ? 5 : 10;
    void m; return ns * sp * 4;
  }
  var fmt = {
    int: function (v) { return Math.round(v).toLocaleString('en-US'); },
    usd: function (v) { return '$' + Math.round(v).toLocaleString('en-US'); },
    usdK: function (v) {
      if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
      if (Math.abs(v) >= 1e4) return '$' + Math.round(v / 1e3) + 'K';
      return '$' + Math.round(v).toLocaleString('en-US');
    },
    cpl: function (v) { if (v === 0) return '$0'; return v >= 10 ? '$' + Math.round(v).toLocaleString('en-US') : '$' + v.toFixed(2); },
    pct: function (v) { return Math.round(v * 100) + '%'; },
    pct1: function (v) { var p = v * 100; return (p < 10 ? p.toFixed(1) : Math.round(p)) + '%'; },
    axisUsd: function (v) { return v >= 1000 ? '$' + (v / 1000).toFixed(v % 1000 ? 1 : 0).replace(/\.0$/, '') + 'K' : '$' + Math.round(v); }
  };
  function isoLabel(iso, withYear) {
    if (!iso) return '';
    var p = iso.split('-'), m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+p[1] - 1];
    return m + ' ' + (+p[2]) + (withYear ? ', ' + p[0] : '');
  }
  var AWAIT = '<span class="await">Awaiting data</span>';
  function chip(s, text) { return '<span class="chip" data-s="' + s + '">' + esc(text) + '</span>'; }

  /* ---------------- motion state ---------------- */
  var paused = false;
  try { paused = sessionStorage.getItem('soma-motion') === 'paused'; } catch (e) {}
  function motionAllowed() { return !mq.matches && !paused; }
  function applyMotion() {
    root.setAttribute('data-motion', mq.matches ? 'reduced' : paused ? 'paused' : 'running');
    var b = $('#motionToggle'); if (!b) return;
    var label = b.querySelector('span');
    if (mq.matches) { b.disabled = true; b.setAttribute('aria-pressed', 'false'); label.textContent = 'Motion reduced'; }
    else { b.disabled = false; b.setAttribute('aria-pressed', paused ? 'true' : 'false'); label.textContent = paused ? 'Play motion' : 'Pause motion'; }
  }
  if (mq.addEventListener) mq.addEventListener('change', applyMotion);
  document.addEventListener('visibilitychange', function () { root.toggleAttribute('data-hidden', document.hidden); });

  /* ---------------- derived figures ---------------- */
  var M = Array.isArray(D.months) ? D.months : [];
  function ch(m, c, k) { return m && m[c] && isNum(m[c][k]) ? m[c][k] : null; }
  var T = {
    spendMeta: sum(M.map(function (m) { return ch(m, 'meta', 'spend'); })),
    spendGoogle: sum(M.map(function (m) { return ch(m, 'google', 'spend'); })),
    leadsMeta: sum(M.map(function (m) { return ch(m, 'meta', 'leads'); })),
    leadsGoogle: sum(M.map(function (m) { return ch(m, 'google', 'leads'); }))
  };
  T.spend = sum(M.reduce(function (a, m) { return a.concat([ch(m, 'meta', 'spend'), ch(m, 'google', 'spend')]); }, []));
  T.leads = sum(M.reduce(function (a, m) { return a.concat([ch(m, 'meta', 'leads'), ch(m, 'google', 'leads')]); }, []));
  T.cpl = T.spend && T.leads ? { v: div(T.spend.v, T.leads.v), partial: T.spend.partial || T.leads.partial } : null;
  if (T.cpl && !isNum(T.cpl.v)) T.cpl = null;
  var monthSpend = M.map(function (m) { var s = sum([ch(m, 'meta', 'spend'), ch(m, 'google', 'spend')]); return s ? s.v : null; });
  var monthLeads = M.map(function (m) { var s = sum([ch(m, 'meta', 'leads'), ch(m, 'google', 'leads')]); return s ? s.v : null; });
  function cplOf(m, c) { return div(ch(m, c, 'spend'), ch(m, c, 'leads')); }
  function blendedCpl(m) {
    var s = 0, l = 0, n = 0;
    ['meta', 'google'].forEach(function (c) { var a = ch(m, c, 'spend'), b = ch(m, c, 'leads'); if (isNum(a) && isNum(b)) { s += a; l += b; n++; } });
    return n ? div(s, l) : null;
  }
  var G = (D.ghl && D.ghl.funnel) || {};

  /* ---------------- static binds ---------------- */
  var meta = D.meta || {};
  function bind(k, v) { $$('[data-bind="' + k + '"]').forEach(function (n) { if (v) n.textContent = v; }); }
  if (meta.headline) { bind('h1a', meta.headline[0]); bind('h1b', meta.headline[1]); }
  bind('eyebrow', (meta.client || 'SOMA') + ' \u00b7 Performance');
  bind('period', meta.periodLabel);
  bind('prepared', meta.preparedBy ? 'Prepared by ' + meta.preparedBy : null);
  bind('preparedOn', isoLabel(meta.preparedOn, true));
  bind('footDate', isoLabel(meta.preparedOn, true));
  if (meta.placeholder) {
    var pb = document.createElement('div'); pb.className = 'phbanner'; pb.setAttribute('role', 'note');
    pb.innerHTML = '<span class="chip" data-s="unconfirmed">Placeholder</span><span>Sample numbers for layout only. Real figures replace these when the channel exports land.</span>';
    var hdr = document.querySelector('header.bar'); if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(pb, hdr.nextSibling);
    document.documentElement.setAttribute('data-placeholder', '');
  }

  /* ---------------- KPI scorecards ---------------- */
  function countSpan(v, f) { return '<span class="num" data-count="' + v + '" data-fmt="' + f + '">' + fmt[f](v) + '</span>'; }
  function partialChip(x) { return x && x.partial ? chip('awaiting', 'partial') : ''; }
  function kpiCard(o) {
    var val = o.value != null ? '<p class="kpi__value' + (o.grad ? ' grad' : '') + '">' + (o.prefix || '') + countSpan(o.value, o.fmt) + '</p>' : '<p class="kpi__value">' + AWAIT + '</p>';
    return '<article class="card kpi' + (o.wide ? ' kpi--wide' : '') + '" data-kpi="' + o.id + '">' +
      '<p class="label">' + esc(o.label) + '</p>' + val +
      (o.sub ? '<p class="kpi__sub">' + o.sub + '</p>' : '') +
      (o.spark ? '<div class="kpi__spark" data-spark="' + o.id + '"></div>' : '') +
      '<div class="kpi__foot">' + (o.chips || '') + '</div></article>';
  }
  var qualRate = div(G.qualified, G.leads);
  var weekQual = (D.thisWeek || []).filter(function (w) { return w.id === 'qualified'; })[0];
  var pipe = (D.ghl && D.ghl.openPipeline) || {};
  var rev = D.ghl && isNum(D.ghl.revenue) ? D.ghl.revenue : null;
  var kpis = [
    { id: 'spend', label: 'Total ad spend', value: T.spend && T.spend.v, fmt: 'usd', sub: 'Meta + Google', spark: monthSpend.some(isNum), chips: partialChip(T.spend) || (T.spend ? '' : chip('awaiting', 'Meta, Google exports')) },
    { id: 'leads', label: 'Total leads', value: T.leads && T.leads.v, fmt: 'int', sub: 'Platform-reported', spark: monthLeads.some(isNum), chips: partialChip(T.leads) },
    { id: 'cpl', label: 'Cost per lead', value: T.cpl && T.cpl.v, fmt: 'cpl', sub: 'Blended, both channels', spark: M.some(function (m) { return isNum(blendedCpl(m)); }), chips: partialChip(T.cpl) },
    { id: 'qual', label: 'Qualified rate', value: qualRate, fmt: 'pct', sub: weekQual && isNum(weekQual.of) ? 'Last week on calls: ' + fmt.pct(weekQual.value / weekQual.of) + ' (' + weekQual.value + ' of ' + weekQual.of + ')' : 'GoHighLevel', chips: qualRate != null ? chip('live', 'GoHighLevel') : '' },
    { id: 'booked', label: 'Booked consults', value: isNum(G.booked) ? G.booked : null, fmt: 'int', sub: 'GoHighLevel' },
    { id: 'closed', label: 'Closed patients', value: isNum(G.closed) ? G.closed : null, fmt: 'int', sub: 'Revenue: ' + (rev != null ? '<b style="color:var(--ink)">' + fmt.usd(rev) + '</b>' : 'awaiting data') },
    { id: 'pipeline', label: 'Open pipeline', wide: true, grad: true, value: isNum(pipe.value) ? pipe.value : null, fmt: 'usdK', prefix: pipe.approx ? '~' : '', sub: esc(pipe.note || ''), chips: (pipe.status === 'unconfirmed' ? chip('unconfirmed', 'Open pipeline, unconfirmed') : '') + (pipe.period ? chip('mtd', pipe.period) : '') }
  ];
  $('#kpiGrid').innerHTML = kpis.map(kpiCard).join('');

  function spark(host, values, color) {
    var w = Math.max(host.clientWidth, 80), h = 30, pts = [];
    var max = Math.max.apply(null, values.filter(isNum)), min = Math.min.apply(null, values.filter(isNum));
    if (max === min) { max += 1; min -= 1; }
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, 'aria-hidden': 'true' });
    var d = '';
    values.forEach(function (v, i) {
      if (!isNum(v)) return;
      var x = 4 + i * (w - 8) / Math.max(values.length - 1, 1), y = 4 + (1 - (v - min) / (max - min)) * (h - 8);
      d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); pts.push([x, y]);
    });
    el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, class: 'draw' }, svg);
    pts.forEach(function (p, i) { el('circle', { cx: p[0], cy: p[1], r: i === pts.length - 1 ? 3 : 2, fill: i === pts.length - 1 ? 'var(--orange)' : color, class: 'fade' }, svg); });
    host.innerHTML = ''; host.appendChild(svg);
  }
  function renderSparks() {
    var s = $('[data-spark="spend"]'); if (s) spark(s, monthSpend, 'var(--purple)');
    s = $('[data-spark="leads"]'); if (s) spark(s, monthLeads, 'var(--purple)');
    s = $('[data-spark="cpl"]'); if (s) spark(s, M.map(blendedCpl), 'var(--heading-secondary)');
  }

  /* ---------------- chart: spend vs leads ---------------- */
  function awaitOverlay(plot) { var o = document.createElement('div'); o.className = 'plot__await'; o.innerHTML = '<span>Awaiting data</span>'; plot.appendChild(o); }

  function chartSpendLeads(plot) {
    var w = Math.max(plot.clientWidth, 260), narrow = w < 480;
    var h = Math.round(Math.min(340, Math.max(230, w * 0.48)));
    var pl = narrow ? 40 : 54, pr = narrow ? 30 : 44, pt = 14, pb = 30, iw = w - pl - pr, ih = h - pt - pb;
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': 'Monthly spend and leads by channel' });
    var spendVals = [], leadVals = [];
    M.forEach(function (m) { spendVals.push(ch(m, 'meta', 'spend'), ch(m, 'google', 'spend')); leadVals.push(ch(m, 'meta', 'leads'), ch(m, 'google', 'leads')); });
    var hasSpend = spendVals.some(isNum), hasLeads = leadVals.some(isNum), empty = !hasSpend && !hasLeads;
    var sMax = niceMax(Math.max.apply(null, spendVals.filter(isNum).concat([0]))), lMax = niceMax(Math.max.apply(null, leadVals.filter(isNum).concat([0])));
    var ax = el('g', { class: 'ax' }, svg);
    for (var i = 0; i <= 4; i++) {
      var y = pt + ih - ih * i / 4;
      el('line', { x1: pl, x2: pl + iw, y1: y, y2: y, class: 'gridline', opacity: i === 0 ? 1 : .55 }, ax);
      if (hasSpend) txt(ax, pl - 8, y + 3.5, fmt.axisUsd(sMax * i / 4), { 'text-anchor': 'end' });
      if (hasLeads) txt(ax, pl + iw + 8, y + 3.5, fmt.int(lMax * i / 4), { 'text-anchor': 'start' });
    }
    var n = Math.max(M.length, 1), gw = iw / n, bw = Math.min(30, gw * 0.24), gap = Math.min(6, gw * 0.05);
    var lines = { meta: [], google: [] };
    M.forEach(function (m, idx) {
      var cx = pl + gw * idx + gw / 2;
      txt(ax, cx, h - 8, m.label + (m.partial ? ' MTD' : ''), { 'text-anchor': 'middle', class: 'lbl' });
      ['meta', 'google'].forEach(function (c, j) {
        var x = c === 'meta' ? cx - gap / 2 - bw : cx + gap / 2, v = ch(m, c, 'spend');
        if (empty) {
          var gh = ih * (0.32 + idx * 0.12 + (j ? -0.08 : 0));
          el('rect', { x: x, y: pt + ih - gh, width: bw, height: gh, rx: 4, class: 'ghost-fill' }, svg);
        } else if (isNum(v)) {
          var bh = Math.max(1, ih * v / sMax);
          var r = el('rect', { x: x, y: pt + ih - bh, width: bw, height: bh, rx: 4, fill: m.partial ? 'url(#p-hatch-' + c + ')' : (c === 'meta' ? 'var(--c-meta)' : 'var(--c-google)'), 'fill-opacity': m.partial ? 1 : .9, class: 'grow', style: '--d:' + (idx * 0.08 + j * 0.04) + 's' }, svg);
          var t = el('title', {}, r); t.textContent = m.label + ' ' + c + ' spend ' + fmt.usd(v);
        } else {
          el('rect', { x: x, y: pt + ih - 18, width: bw, height: 18, rx: 4, class: 'ghost-fill' }, svg);
        }
        var lv = ch(m, c, 'leads');
        lines[c].push(isNum(lv) ? [cx, pt + ih - ih * lv / lMax, lv] : null);
      });
    });
    if (empty) {
      var gp = '';
      M.forEach(function (m, idx) { var x = pl + gw * idx + gw / 2, y = pt + ih * (0.62 - idx * 0.12); gp += (gp ? 'L' : 'M') + x + ' ' + y; });
      el('path', { d: gp, class: 'ghost', pathLength: 1 }, svg);
    }
    ['meta', 'google'].forEach(function (c) {
      var col = c === 'meta' ? 'var(--c-meta)' : 'var(--c-google)', d = '', pts = lines[c];
      pts.forEach(function (p, i) { if (!p) return; d += (d && pts[i - 1] ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
      if (d) el('path', { d: d, fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, class: 'draw' }, svg);
      pts.forEach(function (p) {
        if (!p) return;
        el('circle', { cx: p[0], cy: p[1], r: 4.5, fill: 'var(--paper)', stroke: col, 'stroke-width': 2, class: 'fade' }, svg);
        if (!narrow) txt(svg, p[0], p[1] - 10, fmt.int(p[2]), { 'text-anchor': 'middle', class: 'val fade' });
      });
    });
    plot.appendChild(svg);
    if (empty) awaitOverlay(plot);
  }

  /* ---------------- chart: channel split donut ---------------- */
  function arcPath(cx, cy, r, a0, a1) {
    var la = a1 - a0 > Math.PI ? 1 : 0;
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + la + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
  }
  function chartSplit(plot) {
    var w = Math.max(plot.clientWidth, 240), size = Math.min(w, 300), h = size, cx = w / 2, cy = h / 2;
    var R1 = size / 2 - 14, R2 = R1 - 30, sw1 = 16, sw2 = 10;
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': 'Channel share of spend and leads' });
    var rings = [
      { r: R1, sw: sw1, a: T.spendMeta, b: T.spendGoogle, name: 'spend' },
      { r: R2, sw: sw2, a: T.leadsMeta, b: T.leadsGoogle, name: 'leads' }
    ];
    var anyData = false, rows = [];
    rings.forEach(function (rg, ri) {
      el('circle', { cx: cx, cy: cy, r: rg.r, fill: 'none', stroke: 'var(--surface-raised)', 'stroke-width': rg.sw }, svg);
      var a = rg.a ? rg.a.v : null, b = rg.b ? rg.b.v : null, tot = (a || 0) + (b || 0);
      if (!tot) { el('circle', { cx: cx, cy: cy, r: rg.r, class: 'ghost' }, svg); rows.push(null); return; }
      anyData = true;
      var start = -Math.PI / 2, gapA = 0.035, shareA = (a || 0) / tot;
      var segs = [[shareA, 'var(--c-meta)'], [1 - shareA, 'var(--c-google)']], cur = start;
      segs.forEach(function (s, si) {
        if (s[0] <= 0) return;
        var a0 = cur + (s[0] < 1 ? gapA / 2 : 0), a1 = cur + s[0] * Math.PI * 2 - (s[0] < 1 ? gapA / 2 : 0.0001);
        el('path', { d: arcPath(cx, cy, rg.r, a0, a1), fill: 'none', stroke: s[1], 'stroke-width': rg.sw, 'stroke-linecap': 'butt', pathLength: 1, class: 'draw', style: 'animation-delay:' + (ri * .25 + si * .15) + 's' }, svg);
        cur += s[0] * Math.PI * 2;
      });
      rows.push({ name: rg.name, a: shareA, tot: tot, partial: (rg.a && rg.a.partial) || (rg.b && rg.b.partial) });
    });
    if (anyData && T.spend) {
      txt(svg, cx, cy - 2, fmt.usdK(T.spend.v), { 'text-anchor': 'middle', class: 'val', style: 'font-size:' + Math.round(size * 0.1) + 'px;letter-spacing:-.04em' });
      txt(svg, cx, cy + 16, 'TOTAL SPEND', { 'text-anchor': 'middle', class: 'tick' });
    }
    var wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;gap:14px';
    wrap.appendChild(svg);
    var tbl = document.createElement('div'); tbl.className = 'ga4'; tbl.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
    tbl.innerHTML = rows.map(function (r, i) {
      var name = i === 0 ? 'Meta / Google spend' : 'Meta / Google leads';
      return '<div><span class="label">' + name + '</span>' + (r ? '<b><span style="color:var(--c-meta)">' + fmt.pct(r.a) + '</span> <span style="color:var(--muted);font-weight:400">/</span> <span style="color:#ff5a5b">' + fmt.pct(1 - r.a) + '</span></b>' : AWAIT) + '</div>';
    }).join('');
    wrap.appendChild(tbl);
    plot.appendChild(wrap);
    if (!anyData) awaitOverlay(plot);
  }

  /* ---------------- chart: CPL trend ---------------- */
  function chartCpl(plot) {
    var w = Math.max(plot.clientWidth, 260), narrow = w < 520;
    var h = Math.round(Math.min(300, Math.max(210, w * 0.26)));
    var pl = narrow ? 44 : 56, pr = 18, pt = 22, pb = 30, iw = w - pl - pr, ih = h - pt - pb;
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': 'Cost per lead by month' });
    var series = {
      blended: M.map(blendedCpl),
      meta: M.map(function (m) { return cplOf(m, 'meta'); }),
      google: M.map(function (m) { return cplOf(m, 'google'); })
    };
    var all = series.blended.concat(series.meta, series.google).filter(isNum), empty = !all.length;
    var max = niceMax(Math.max.apply(null, all.concat([0])) * 1.1);
    var ax = el('g', { class: 'ax' }, svg), n = Math.max(M.length, 1);
    function X(i) { return pl + (n === 1 ? iw / 2 : iw * i / (n - 1)); }
    for (var i = 0; i <= 4; i++) {
      var y = pt + ih - ih * i / 4;
      el('line', { x1: pl, x2: pl + iw, y1: y, y2: y, class: 'gridline', opacity: i === 0 ? 1 : .55 }, ax);
      if (!empty) txt(ax, pl - 8, y + 3.5, fmt.cpl(max * i / 4), { 'text-anchor': 'end' });
    }
    M.forEach(function (m, i) { txt(ax, X(i), h - 8, m.label + (m.partial ? ' MTD' : ''), { 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', class: 'lbl' }); });
    if (empty) {
      el('path', { d: 'M' + X(0) + ' ' + (pt + ih * .35) + ' C' + X(0.9) + ' ' + (pt + ih * .25) + ',' + X(1.4) + ' ' + (pt + ih * .7) + ',' + X(n - 1) + ' ' + (pt + ih * .55), class: 'ghost' }, svg);
      plot.appendChild(svg); awaitOverlay(plot); return;
    }
    function Y(v) { return pt + ih - ih * v / max; }
    function pathOf(vals) { var d = ''; vals.forEach(function (v, i) { if (!isNum(v)) return; d += (d && isNum(vals[i - 1]) ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }); return d; }
    // area under blended
    var bl = series.blended, first = -1, last = -1;
    bl.forEach(function (v, i) { if (isNum(v)) { if (first < 0) first = i; last = i; } });
    if (first >= 0 && bl.slice(first, last + 1).every(isNum) && last > first) {
      el('path', { d: pathOf(bl) + 'L' + X(last) + ' ' + (pt + ih) + 'L' + X(first) + ' ' + (pt + ih) + 'Z', fill: 'url(#g-area)', class: 'fade', style: '--d:.6s' }, svg);
    }
    [['meta', 'var(--c-meta)', 1.5, '5 5'], ['google', 'var(--c-google)', 1.5, '5 5'], ['blended', 'var(--c-total)', 2.5, null]].forEach(function (s) {
      var d = pathOf(series[s[0]]); if (!d) return;
      // dashed channel lines draw through a mask-free trick: solid draw for blended, fade for dashed
      if (s[3]) el('path', { d: d, fill: 'none', stroke: s[1], 'stroke-width': s[2], 'stroke-dasharray': s[3], 'stroke-linecap': 'round', class: 'fade', style: '--d:.3s', opacity: .9 }, svg);
      else el('path', { d: d, fill: 'none', stroke: s[1], 'stroke-width': s[2], 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, class: 'draw' }, svg);
    });
    bl.forEach(function (v, i) {
      if (!isNum(v)) return;
      el('circle', { cx: X(i), cy: Y(v), r: 5, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2, class: 'fade' }, svg);
      txt(svg, X(i), Y(v) - 12, fmt.cpl(v), { 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', class: 'val fade' });
    });
    plot.appendChild(svg);
  }

  /* ---------------- chart: funnel ---------------- */
  var STAGES = [['leads', 'Leads'], ['contacted', 'Contacted'], ['qualified', 'Qualified'], ['booked', 'Booked'], ['closed', 'Closed']];
  function chartFunnel(plot) {
    var w = Math.max(plot.clientWidth, 260), vals = STAGES.map(function (s) { return isNum(G[s[0]]) ? G[s[0]] : null; });
    var empty = !vals.some(isNum), max = Math.max.apply(null, vals.filter(isNum).concat([1]));
    var note = $('#funnelNote');
    if (note) note.textContent = isNum(G.leads) && isNum(G.closed) && G.leads > 0 ? 'Lead to patient: ' + fmt.pct1(G.closed / G.leads) + ' over the period.' : 'Whole period, from GoHighLevel.';
    if (w < 640) return funnelVertical(plot, vals, empty, max);
    var h = 300, top = 92, fh = 170, n = STAGES.length, sw = w / n, cy = top + fh / 2;
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': 'Lead funnel' });
    // half heights per stage edge; ghost uses a decorative taper
    var hh = vals.map(function (v, i) {
      if (empty) return fh / 2 * (1 - i * 0.17);
      if (!isNum(v)) return null;
      return Math.max(fh / 2 * 0.07, fh / 2 * Math.sqrt(v / max));
    });
    for (var i = 0; i < n; i++) if (hh[i] == null) hh[i] = i ? hh[i - 1] : fh / 2;
    var edges = hh.concat([hh[n - 1] * 0.82]);
    var topPts = [], botPts = [];
    for (i = 0; i <= n; i++) { var x = i * sw; topPts.push([x, cy - (i === n ? edges[n] : edges[i])]); botPts.push([x, cy + (i === n ? edges[n] : edges[i])]); }
    // smooth outline
    function curve(pts) { var d = 'M' + pts[0][0] + ' ' + pts[0][1]; for (var k = 1; k < pts.length; k++) { var p0 = pts[k - 1], p1 = pts[k], mx = (p0[0] + p1[0]) / 2; d += 'C' + mx + ' ' + p0[1] + ',' + mx + ' ' + p1[1] + ',' + p1[0] + ' ' + p1[1]; } return d; }
    var topD = curve(topPts), bot = botPts.slice().reverse(), botD = curve(bot).replace(/^M[^C]+/, '');
    var shape = topD + 'L' + bot[0][0] + ' ' + bot[0][1] + botD + 'Z';
    el('path', { d: shape, fill: empty ? 'rgb(59 47 121 / .12)' : 'url(#g-funnel)', class: 'fade', style: '--d:.5s' }, svg);
    el('path', { d: shape, fill: 'none', stroke: empty ? 'var(--line-strong)' : 'url(#g-outline)', 'stroke-width': 1.5, 'stroke-dasharray': empty ? null : null, pathLength: 1, class: 'draw' + (empty ? ' ghost-draw' : '') }, svg);
    for (i = 1; i < n; i++) el('line', { x1: i * sw, x2: i * sw, y1: cy - edges[i], y2: cy + edges[i], stroke: 'var(--line-strong)', 'stroke-dasharray': '3 4', class: 'fade', style: '--d:1s' }, svg);
    STAGES.forEach(function (s, i) {
      var x = i * sw + 14, v = vals[i];
      txt(svg, x, 22, s[1].toUpperCase(), { class: 'tick' });
      if (isNum(v)) {
        txt(svg, x, 56, fmt.int(v), { class: 'val', style: 'font-size:' + Math.round(Math.min(34, sw * 0.17)) + 'px;letter-spacing:-.04em' });
        var prev = vals[i - 1];
        if (i > 0 && isNum(prev) && prev > 0) txt(svg, x, 76, fmt.pct1(v / prev) + ' of ' + STAGES[i - 1][1].toLowerCase(), { class: 'tick', fill: 'var(--purple)' });
      } else txt(svg, x, 54, 'Awaiting', { class: 'val val--muted' });
    });
    plot.appendChild(svg);
    if (empty) awaitOverlay(plot);
  }
  function funnelVertical(plot, vals, empty, max) {
    var ul = document.createElement('ul'); ul.className = 'bars' + (empty ? ' bars--ghost' : '');
    ul.innerHTML = STAGES.map(function (s, i) {
      var v = vals[i], prev = vals[i - 1];
      var pct = empty ? (1 - i * 0.17) : isNum(v) ? Math.max(0.04, Math.sqrt(v / max)) : 0;
      var conv = i > 0 && isNum(v) && isNum(prev) && prev > 0 ? ' \u00b7 ' + fmt.pct1(v / prev) : '';
      return '<li><div class="bars__row"><span>' + s[1] + '</span><span>' + (isNum(v) ? fmt.int(v) + conv : 'Awaiting data') + '</span></div>' +
        '<div class="bars__track" style="height:22px;width:100%;margin-inline:auto"><span class="bars__fill" style="width:' + (pct * 100).toFixed(1) + '%;left:' + ((1 - pct) * 50).toFixed(1) + '%;background:' + (empty ? 'transparent' : 'linear-gradient(90deg,var(--purple-deep),var(--purple))') + ';transform-origin:50% 50%"></span></div></li>';
    }).join('');
    plot.appendChild(ul);
  }

  /* ---------------- top ads / campaigns ---------------- */
  function chartList(plot, list) {
    var ul = document.createElement('ul');
    if (!Array.isArray(list) || !list.length) {
      ul.className = 'bars bars--ghost';
      ul.innerHTML = [0.9, 0.7, 0.52, 0.38, 0.26].map(function (p) {
        return '<li><div class="bars__row"><span style="color:var(--muted)">\u2014</span><span>\u2014</span></div><div class="bars__track" style="width:' + p * 100 + '%"></div></li>';
      }).join('');
      plot.appendChild(ul); awaitOverlay(plot); return;
    }
    var rows = list.slice().sort(function (a, b) { return (b.leads || 0) - (a.leads || 0); }).slice(0, 6);
    var max = Math.max.apply(null, rows.map(function (r) { return r.leads || 0; }).concat([1]));
    ul.className = 'bars';
    ul.innerHTML = rows.map(function (r, i) {
      var col = r.channel === 'google' ? 'var(--c-google)' : 'var(--c-meta)', c = div(r.spend, r.leads);
      return '<li><div class="bars__row"><span><span class="sr">' + (r.channel === 'google' ? 'Google' : 'Meta') + ': </span>' + esc(r.name) + '</span><span>' + (isNum(r.leads) ? fmt.int(r.leads) + ' leads' : '\u2014') + (c != null ? ' \u00b7 ' + fmt.cpl(c) : '') + '</span></div>' +
        '<div class="bars__track"><span class="bars__fill" style="width:' + ((r.leads || 0) / max * 100).toFixed(1) + '%;background:' + col + ';transition-delay:' + (i * 0.07) + 's"></span></div></li>';
    }).join('');
    plot.appendChild(ul);
  }

  /* ---------------- GA4 ---------------- */
  (function () {
    var g = D.ga4 || {}, host = $('#ga4');
    var cells = [['Sessions', g.sessions, 'int'], ['Users', g.users, 'int'], ['Conversions', g.conversions, 'int'], ['Conversion rate', g.conversionRate, 'pct1']];
    host.innerHTML = cells.map(function (c) { return '<div><span class="label">' + c[0] + '</span>' + (isNum(c[1]) ? '<b>' + countSpan(c[1], c[2]) + '</b>' : AWAIT) + '</div>'; }).join('');
  })();

  /* ---------------- this week ---------------- */
  function wkViz(w) {
    var svg = '<svg viewBox="0 0 200 56" preserveAspectRatio="xMinYMax meet" aria-hidden="true">';
    if (w.id === 'volume' && isNum(w.from) && isNum(w.to)) {
      var hA = Math.max(3, 50 * w.from / w.to);
      svg += '<rect x="0" y="' + (56 - hA) + '" width="56" height="' + hA + '" rx="4" fill="var(--line-strong)" class="grow"/>' +
        '<path d="M66 ' + (56 - hA - 6) + ' C 100 ' + (56 - hA - 6) + ', 104 8, 132 8" fill="none" stroke="url(#g-outline)" stroke-width="1.5" stroke-dasharray="1 1" pathLength="1" class="draw"/>' +
        '<rect x="140" y="6" width="56" height="50" rx="4" fill="var(--purple)" class="grow" style="--d:.35s"/>';
    } else if (w.id === 'qualified' && isNum(w.of)) {
      var cols = 15, rows = Math.ceil(w.of / cols);
      for (var i = 0; i < w.of; i++) { var cx = 6 + (i % cols) * 13, cy = 56 - 6 - Math.floor(i / cols) * 14; svg += '<circle cx="' + cx + '" cy="' + cy + '" r="4.2" fill="' + (i < w.value ? 'var(--purple)' : 'none') + '" stroke="' + (i < w.value ? 'var(--purple)' : 'var(--line-strong)') + '" class="fade" style="--d:' + (i * 0.015).toFixed(3) + 's"/>'; }
      void rows;
    } else if (w.id === 'google' && isNum(w.value)) {
      svg += '<line x1="0" y1="50" x2="200" y2="50" stroke="var(--line)"/>';
      for (var k = 0; k < Math.round(w.value); k++) svg += '<rect x="' + (k * 30) + '" y="14" width="20" height="36" rx="10" fill="var(--c-google)" class="grow" style="--d:' + (k * 0.1) + 's"/>';
      svg += '<text x="' + (Math.round(w.value) * 30 + 6) + '" y="36" class="tick">PER DAY</text>';
    } else if (w.id === 'pipeline') {
      svg += '<rect x="0.75" y="18.75" width="198.5" height="30" rx="15" fill="rgb(59 47 121 / .25)" stroke="#e9b97a" stroke-dasharray="4 4" stroke-opacity=".7"/>' +
        '<text x="16" y="38" class="tick" fill="#e9b97a">OPEN, NOT CLOSED</text>';
    } else if (w.id === 'doctors' && isNum(w.of)) {
      for (var j = 0; j < w.of; j++) {
        var x = 8 + (j % 6) * 32, y = j < 6 ? 14 : 42, on = j < w.value;
        svg += '<g class="fade" style="--d:' + (j * 0.05) + 's"><circle cx="' + x + '" cy="' + (y - 3) + '" r="5" fill="' + (on ? 'var(--purple)' : 'none') + '" stroke="' + (on ? 'var(--purple)' : 'var(--line-strong)') + '"/><path d="M' + (x - 8) + ' ' + (y + 11) + 'a8 7 0 0 1 16 0" fill="' + (on ? 'var(--purple)' : 'none') + '" stroke="' + (on ? 'var(--purple)' : 'var(--line-strong)') + '"/></g>';
      }
    }
    return svg + '</svg>';
  }
  (function () {
    var host = $('#weekGrid');
    host.innerHTML = (D.thisWeek || []).map(function (w) {
      var big, ap = w.approx ? '~' : '';
      if (w.id === 'volume' && isNum(w.from)) big = ap + fmt.int(w.to) + '<small>from ' + ap + fmt.int(w.from) + '</small>';
      else if (isNum(w.of)) big = (w.id === 'qualified' ? fmt.pct(w.value / w.of) + '<small>' + w.value + ' of ' + w.of + '</small>' : w.value + '<small>of ' + w.of + '</small>');
      else if (w.unit === 'USD') big = '<span class="grad">' + ap + fmt.usdK(w.value) + '</span>';
      else big = ap + w.value + (w.unit ? '<small>' + esc(w.unit) + '</small>' : '');
      return '<article class="card wk" data-week="' + esc(w.id) + '"><p class="label">' + esc(w.label) + '</p><p class="wk__value">' + big + '</p>' +
        '<div class="wk__viz">' + wkViz(w) + '</div><p class="wk__note">' + esc(w.note || '') + '</p>' +
        '<div class="wk__foot">' + (w.status === 'unconfirmed' ? chip('unconfirmed', 'Unconfirmed') : '') + chip('live', 'As of ' + isoLabel(w.asOf)) + '</div></article>';
    }).join('');
  })();

  /* ---------------- game plan ---------------- */
  $('#planList').innerHTML = (D.gamePlan || []).map(function (g) {
    return '<li><p>' + esc(g.text) + '</p>' + (g.when ? chip(/ongoing/i.test(g.when) ? 'awaiting' : 'live', g.when) : '') + '</li>';
  }).join('');

  /* ---------------- hero grid (HAI dashed column guides + a drawn gradient line) ---------------- */
  function heroGrid() {
    var s = $('#heroGrid'); if (!s) return;
    var w = s.clientWidth || 1200, h = s.clientHeight || 600; s.setAttribute('viewBox', '0 0 ' + w + ' ' + h); s.innerHTML = '';
    var cols = w < 600 ? 3 : 6;
    for (var i = 1; i < cols; i++) el('line', { x1: w * i / cols, x2: w * i / cols, y1: 0, y2: h, stroke: 'rgba(244,239,255,.13)', 'stroke-dasharray': '4 6' }, s);
    var d = 'M0 ' + (h * .82);
    var pts = [0.1, 0.25, 0.38, 0.52, 0.66, 0.8, 1].map(function (x, i) { return [w * x, h * (0.8 - i * 0.07 - (i % 2 ? 0.03 : 0))]; });
    pts.forEach(function (p) { d += 'L' + p[0].toFixed(0) + ' ' + p[1].toFixed(0); });
    el('path', { d: d, fill: 'none', stroke: 'url(#g-outline)', 'stroke-width': 1.25, 'stroke-opacity': .7, pathLength: 1, class: 'draw' }, s);
  }

  /* ---------------- render charts (re-render on resize; no re-animation once settled) ---------------- */
  var renderers = {
    spendLeads: chartSpendLeads, split: chartSplit, cpl: chartCpl, funnel: chartFunnel,
    topAds: function (p) { chartList(p, D.topAds); }, topCampaigns: function (p) { chartList(p, D.topCampaigns); }
  };
  function renderAll() {
    $$('[data-chart]').forEach(function (fig) {
      var r = renderers[fig.getAttribute('data-chart')]; if (!r) return;
      var plot = fig.querySelector('.plot'); plot.innerHTML = ''; r(plot);
    });
    renderSparks(); heroGrid();
  }

  /* ---------------- outlines + draw-on observers ---------------- */
  // outline rect sized in px from the card's own box (CSS-percent rect geometry does not re-layout reliably)
  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (es) { es.forEach(function (e) { sizeOutline(e.target); }); }) : null;
  function sizeOutline(card) {
    var s = card.querySelector(':scope > .outline'); if (!s) return;
    var w = card.offsetWidth, h = card.offsetHeight, rx = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    $$('rect', s).forEach(function (r) { r.setAttribute('x', .5); r.setAttribute('y', .5); r.setAttribute('width', Math.max(0, w - 1)); r.setAttribute('height', Math.max(0, h - 1)); r.setAttribute('rx', Math.max(0, rx - .5)); });
  }
  function addOutline(card) {
    var s = el('svg', { class: 'outline', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' });
    el('rect', { pathLength: 1, class: 'o-draw' }, s);
    el('rect', { pathLength: 1, class: 'o-run' }, s);
    card.appendChild(s); sizeOutline(card);
    if (ro) ro.observe(card);
  }
  function countUp(scope) {
    $$('[data-count]', scope).forEach(function (n) {
      var v = parseFloat(n.getAttribute('data-count')), f = fmt[n.getAttribute('data-fmt')] || fmt.int;
      if (!motionAllowed()) { n.textContent = f(v); return; }
      var t0 = performance.now(), dur = 1300;
      (function step(now) {
        var t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
        n.textContent = f(paused ? v : v * e);
        if (t < 1 && !paused) requestAnimationFrame(step);
      })(t0);
    });
  }

  applyMotion();
  renderAll();
  var drawTargets = $$('.card').concat([$('.hero')]);
  $$('.card').forEach(addOutline);

  function reveal(t) {
    if (t.hasAttribute('data-drawn')) return;
    t.setAttribute('data-drawn', '');
    countUp(t);
    setTimeout(function () { t.setAttribute('data-settled', ''); }, 3200);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) reveal(e.target); });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    var vis = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.toggleAttribute('data-offscreen', !e.isIntersecting); });
    }, { threshold: 0.01 });
    drawTargets.forEach(function (t) { io.observe(t); if (t.classList.contains('card')) vis.observe(t); });
  } else drawTargets.forEach(reveal);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { renderAll(); $$('.card').forEach(sizeOutline); });

  var rt, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (window.innerWidth === lastW) return; lastW = window.innerWidth; renderAll(); $$('.card').forEach(sizeOutline); }, 160);
  });

  var btn = $('#motionToggle');
  btn.addEventListener('click', function () {
    if (mq.matches) return;
    paused = !paused;
    try { sessionStorage.setItem('soma-motion', paused ? 'paused' : 'running'); } catch (e) {}
    applyMotion();
  });
})();
