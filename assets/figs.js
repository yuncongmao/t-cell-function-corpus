/* Native figures — benchmark explorer reads the paper's Source Data CSVs. */
(function () {
'use strict';
var NS = 'http://www.w3.org/2000/svg';
var FONT = 'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
var INK = '#111113', INK2 = '#3c3e44', INK3 = '#6a6d75', INK4 = '#9a9ca3';
var RULE = '#e7e6e2', TINT = '#f5f4f1', BAR = '#dad8d2', BAR2 = '#b3b1aa', RED = '#b5362b';

function el(tag, attrs, parent) {
  var e = document.createElementNS(NS, tag);
  for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function label(parent, x, y, str, o) {
  o = o || {};
  var t = el('text', { x: x, y: y, 'font-family': FONT, 'font-size': o.size || 12,
    fill: o.fill || INK2, 'text-anchor': o.anchor || 'start', 'font-weight': o.weight || 400,
    'dominant-baseline': o.base || null }, parent);
  t.textContent = str;
  return t;
}
function tag(name, cls, parent, text) {
  var e = document.createElement(name);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function fmt(v, n) { return v.toFixed(n == null ? 3 : n); }
function fmtQ(q) {
  if (q < 1e-4) return q.toExponential(0).replace('e-', '×10⁻');
  return q < 0.001 ? q.toExponential(1) : q.toFixed(3);
}
function csv(text) {
  var rows = text.trim().split(/\r?\n/), head = rows[0].split(',');
  return rows.slice(1).map(function (line) {
    var cells = line.split(','), o = {};
    for (var i = 0; i < head.length; i++) o[head[i]] = cells[i];
    return o;
  });
}
function fetchSet(base) {
  return Promise.all(['overall', 'runs', 'differences'].map(function (n) {
    return fetch(base + '/' + n + '.csv').then(function (r) {
      if (!r.ok) throw new Error(n);
      return r.text();
    }).then(csv);
  })).then(function (a) { return { overall: a[0], runs: a[1], diffs: a[2] }; });
}
function ticks(lo, hi) {
  var raw = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  var step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  var out = [], t = Math.ceil(lo / step) * step;
  for (; t <= hi + 1e-9; t += step) out.push(Math.round(t / step) * step);
  return out;
}
window.__fig = { el: el, label: label, tag: tag, fmt: fmt, fmtQ: fmtQ, fetchSet: fetchSet,
  ticks: ticks, FONT: FONT, INK: INK, INK2: INK2, INK3: INK3, INK4: INK4,
  RULE: RULE, TINT: TINT, BAR: BAR, BAR2: BAR2, RED: RED };
})();

/* ── benchmark explorer ─────────────────────────────────────── */
(function () {
'use strict';
var F = window.__fig, el = F.el, label = F.label, tag = F.tag;

var NAME = { gene_mean: 'Gene mean', knn: 'kNN', svd: 'SVD', stack_frozen: 'Stack',
  pie_frozen: 'PIE', catboost: 'CatBoost', assayformer_ours: 'AssayFormer',
  tabicl_native: 'TabICL', kumo_small: 'Kumo', FuncMap: 'FuncMap' };
var KIND = { gene_mean: 'statistical', knn: 'classical ML', svd: 'classical ML',
  stack_frozen: 'single-cell FM, frozen', pie_frozen: 'single-cell FM, frozen',
  catboost: 'gradient boosting, per screen', assayformer_ours: 'trained on our corpus',
  tabicl_native: 'tabular FM, frozen', kumo_small: 'tabular FM, frozen', FuncMap: 'ours' };

window.__bench = function (host, data, cfg) {
  var st = { task: '2', k: 'K200', metric: cfg.metrics[0].id, dir: 'E' };
  var ctrls = tag('div', 'fx-ctrls', host);
  var plot = tag('div', 'fx-plot', host);
  var note = tag('div', 'fx-note', host);

  function kf(r) { return [r.rung, r.setting, r.metric, cfg.dirs ? r.direction : ''].join('|'); }
  var O = {}, R = {}, D = {};
  data.overall.forEach(function (r) { (O[kf(r)] = O[kf(r)] || []).push(r); });
  data.runs.forEach(function (r) { var k = kf(r) + '|' + r.arm; (R[k] = R[k] || []).push(+r.mean); });
  data.diffs.forEach(function (r) { D[kf(r) + '|' + r.baseline] = r; });

  function group(lab, opts, cur, pick) {
    var g = tag('div', 'fx-g', ctrls);
    tag('span', 'fx-gl', g, lab);
    var box = tag('div', 'fx-gb', g);
    opts.forEach(function (o) {
      var b = tag('button', o.id === cur ? 'on' : '', box, o.label);
      b.type = 'button';
      if (o.off) { b.disabled = true; b.className = 'off'; }
      else b.onclick = function () { pick(o.id); };
    });
  }
  function controls() {
    ctrls.innerHTML = '';
    group('Task', [{ id: '1', label: 'Imputation' }, { id: '2', label: 'Unseen screen' },
      { id: '3', label: 'Unseen study' }], st.task, function (v) { st.task = v; draw(); });
    group('Revealed genes', ['K10', 'K50', 'K200'].map(function (k) {
      return { id: k, label: k.slice(1), off: st.task === '1' };
    }), st.task === '1' ? '' : st.k, function (v) { st.k = v; draw(); });
    if (cfg.dirs) group('Hits', [{ id: 'E', label: 'Enriched' }, { id: 'D', label: 'Depleted' }],
      st.dir, function (v) { st.dir = v; draw(); });
    group('Metric', cfg.metrics, st.metric, function (v) { st.metric = v; draw(); });
  }
  host.__draw = function () { draw(); };

  function rows() {
    var setting = st.task === '1' ? 'pooled' : st.k;
    var key = [st.task, setting, st.metric, cfg.dirs ? st.dir : ''].join('|');
    return (O[key] || []).map(function (r) {
      var d = D[key + '|' + r.arm];
      return { arm: r.arm, mean: +r.mean_over_runs, sd: +r.sd_over_runs,
        runs: R[key + '|' + r.arm] || [], d: d };
    }).sort(function (a, b) { return b.mean - a.mean; });
  }
  function draw() { controls(); render(plot, note, rows(), st, cfg); }
  draw();
  addEventListener('resize', function () { render(plot, note, rows(), st, cfg); });
};

function render(plot, note, rs, st, cfg) {
  var F = window.__fig, el = F.el, label = F.label;
  if (!rs.length) { plot.innerHTML = '<p class="fx-empty">Not run in this setting.</p>'; note.textContent = ''; return; }
  var W = Math.max(300, Math.min(plot.clientWidth || 680, 920));
  var narrow = W < 560;
  var L = narrow ? 86 : 118, Rm = narrow ? 56 : 150, rowH = 30, top = 10, axH = 26;
  var H = top + rs.length * rowH + axH;
  plot.innerHTML = '';
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', style: 'display:block' }, plot);

  var isA = /auroc|auc/i.test(st.metric);
  var vals = [];
  rs.forEach(function (r) { vals.push(r.mean + r.sd); r.runs.forEach(function (v) { vals.push(v); }); });
  var hi = Math.max.apply(null, vals);
  var lo = 0, tk = F.ticks(lo, hi * 1.04);
  var hiA = Math.max(tk[tk.length - 1], hi * 1.02);
  var X = function (v) { return L + (v - lo) / (hiA - lo) * (W - L - Rm); };

  tk.forEach(function (t) {
    el('line', { x1: X(t), x2: X(t), y1: top - 2, y2: H - axH + 2, stroke: F.RULE }, svg);
    label(svg, X(t), H - axH + 16, String(+t.toFixed(3)), { size: 11, fill: F.INK4, anchor: 'middle' });
  });
  if (isA && hiA > 0.5) {
    el('line', { x1: X(0.5), x2: X(0.5), y1: top - 2, y2: H - axH + 2, stroke: F.INK4, 'stroke-dasharray': '3 3' }, svg);
    label(svg, X(0.5), top - 4, 'chance', { size: 10, fill: F.INK4, anchor: 'middle' });
  }
  var best = null;
  rs.forEach(function (r) { if (r.arm !== 'FuncMap' && (!best || r.mean > best.mean)) best = r; });

  rs.forEach(function (r, i) {
    var y = top + i * rowH, cy = y + rowH / 2, me = r.arm === 'FuncMap';
    var g = el('g', { class: 'fx-row', tabindex: '0' }, svg);
    el('rect', { x: 0, y: y, width: W, height: rowH, fill: 'transparent' }, g);
    label(g, L - 10, cy + 4, NAME[r.arm] || r.arm, { anchor: 'end', size: narrow ? 11.5 : 12.5,
      fill: me ? F.INK : F.INK2, weight: me ? 600 : 400 });
    el('rect', { x: X(0), y: cy - 8, width: Math.max(1, X(r.mean) - X(0)), height: 16, rx: 2,
      fill: me ? F.RED : (r === best ? F.BAR2 : F.BAR) }, g);
    if (r.sd > 0) el('line', { x1: X(r.mean - r.sd), x2: X(r.mean + r.sd), y1: cy, y2: cy,
      stroke: me ? '#5d1b14' : F.INK3, 'stroke-width': 1.2 }, g);
    r.runs.forEach(function (v, j) {
      el('circle', { cx: X(v), cy: cy + (j - 2) * 1.5, r: 2, fill: '#fff',
        stroke: me ? '#5d1b14' : F.INK3, 'stroke-width': .9 }, g);
    });
    label(g, X(r.mean + r.sd) + 9, cy + 4, F.fmt(r.mean), { size: 12, fill: me ? F.INK : F.INK2, weight: me ? 600 : 400 });
    if (!narrow && r.d) {
      var ahead = +r.d.diff > 0, sig = r.d.significant === 'True', ag = r.d.significant_against === 'True';
      var txt = (ahead ? '+' : '−') + F.fmt(Math.abs(+r.d.diff)) + (sig ? ' ★' : ag ? ' ▲' : '');
      label(g, W - 8, cy + 4, txt, { size: 11.5, anchor: 'end',
        fill: ag ? '#2f6fb5' : sig ? F.INK2 : F.INK4 });
    }
    var hov = function () { say(note, r, best, st, cfg); };
    g.addEventListener('mouseenter', hov);
    g.addEventListener('focus', hov);
  });
  say(note, rs[0], best, st, cfg);
}

function say(note, r, best, st, cfg) {
  var F = window.__fig;
  note.innerHTML = '';
  var n = NAME[r.arm] || r.arm;
  var head = F.tag('span', 'fx-k', note, n);
  F.tag('span', 'fx-s', note, ' · ' + KIND[r.arm] + ' · ' + F.fmt(r.mean) + ' ± ' + F.fmt(r.sd) + ' s.d. over 5 runs');
  if (r.d) {
    var ahead = +r.d.diff > 0;
    var s = document.createElement('div');
    s.className = 'fx-d';
    s.textContent = 'FuncMap − ' + n + ' = ' + (ahead ? '+' : '−') + F.fmt(Math.abs(+r.d.diff)) +
      '  (95% CI ' + F.fmt(+r.d.ci_low) + ' to ' + F.fmt(+r.d.ci_high) + ')' +
      ', q = ' + F.fmtQ(+r.d.q_bh) + ', ahead in ' + r.d.studies_funcmap_ahead + ' of ' + r.d.n_studies + ' studies';
    note.appendChild(s);
  } else if (r.arm === 'FuncMap') {
    F.tag('div', 'fx-d', note, best ? 'Strongest baseline here: ' + (NAME[best.arm] || best.arm) + ' at ' + F.fmt(best.mean) + '.' : '');
  }
}
})();

/* ── corpus composition (native) ────────────────────────────── */
(function () {
'use strict';
var F = window.__fig, el = F.el, label = F.label, tag = F.tag;
var SHADE = ['#111113', '#55585f', '#8d9097', '#bcbdc1', '#dedfe1'];

var GROUPS = [
  { name: 'Species', parts: [['Human', 83, 822304], ['Mouse', 28, 333054], ['Rat', 2, 104467]] },
  { name: 'Antigen receptor', parts: [['TCR', 75, 886745], ['CAR', 38, 373080]] },
  { name: 'Perturbation', parts: [['CRISPR knockout', 70, 1057410], ['Knock-in', 30, 3060],
      ['CRISPR activation', 7, 149984], ['CRISPR interference', 3, 37572], ['Overexpression', 3, 11799]] },
  { name: 'Library scale', parts: [['Focused', 58, 56783], ['Genome-wide', 34, 1171120], ['Intermediate', 21, 31922]] }
];

window.__corpus = function (host) {
  var mode = 'screens';
  var ctrls = tag('div', 'fx-ctrls', host);
  var body = tag('div', 'fx-comp', host);
  function bar() {
    ctrls.innerHTML = '';
    var g = tag('div', 'fx-g', ctrls);
    tag('span', 'fx-gl', g, 'Show');
    var box = tag('div', 'fx-gb', g);
    [['screens', 'Screens'], ['effects', 'Gene-level effects']].forEach(function (o) {
      var b = tag('button', mode === o[0] ? 'on' : '', box, o[1]);
      b.type = 'button';
      b.onclick = function () { mode = o[0]; bar(); draw(); };
    });
  }
  function draw() {
    body.innerHTML = '';
    var idx = mode === 'screens' ? 1 : 2;
    GROUPS.forEach(function (grp) {
      var row = tag('div', 'fx-crow', body);
      tag('div', 'fx-cname', row, grp.name);
      var right = tag('div', 'fx-cright', row);
      var track = tag('div', 'fx-ctrack', right);
      var tot = grp.parts.reduce(function (s, p) { return s + p[idx]; }, 0);
      var keys = tag('div', 'fx-ckeys', right);
      grp.parts.forEach(function (p, pi) {
        var pct = p[idx] / tot * 100;
        var seg = tag('div', 'fx-cseg', track);
        seg.style.width = pct + '%';
        seg.style.background = SHADE[pi % 5];
        seg.title = p[0] + ' \u2014 ' + p[idx].toLocaleString() + ' ' +
          (mode === 'screens' ? 'screens' : 'effects') + ' (' + pct.toFixed(1) + '%)';
        if (pct > 14) { var v = tag('span', '', seg, p[idx].toLocaleString()); v.style.color = pi < 2 ? '#fff' : '#111113'; }
        var key = tag('div', 'fx-ckey', keys);
        var sw = tag('span', 'fx-sw', key); sw.style.background = SHADE[pi % 5];
        tag('span', '', key, p[0] + ' ' + p[idx].toLocaleString());
      });
    });
  }
  bar(); draw();
};

/* ── corpus vs BioGRID ORCS ─────────────────────────────────── */
var ORCS = [['Primary T-cell publications', 37, 7], ['Screens', 113, 15],
  ['Assay instances in shared studies', 34, 22], ['Metadata dimensions', 33, 16],
  ['Phenotype readouts, shared screens', 9, 2]];

window.__orcs = function (host) {
  function draw() {
    var W = Math.max(300, Math.min(host.clientWidth || 680, 920));
    var narrow = W < 560, L = narrow ? 0 : 230, rowH = narrow ? 56 : 44;
    var H = ORCS.length * rowH + 10;
    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', style: 'display:block' }, host);
    var max = 113, right = 54, bw = W - (narrow ? 0 : L) - right;
    ORCS.forEach(function (r, i) {
      var y = i * rowH + (narrow ? 14 : 8);
      if (narrow) label(svg, 0, y, r[1 - 1] && r[0], { size: 11.5, fill: F.INK });
      else label(svg, L - 14, y + 16, r[0], { size: 12.5, fill: F.INK2, anchor: 'end' });
      var x0 = narrow ? 0 : L, yy = narrow ? y + 8 : y;
      [[r[1], F.RED, 'This corpus'], [r[2], F.BAR, 'BioGRID ORCS']].forEach(function (p, j) {
        var w = Math.max(2, p[0] / max * bw);
        var g = el('g', {}, svg);
        el('rect', { x: x0, y: yy + j * 13, width: w, height: 11, rx: 1.5, fill: p[1] }, g);
        label(g, x0 + w + 6, yy + j * 13 + 9.5, String(p[0]), { size: 11, fill: j ? F.INK3 : F.INK });
        var t = el('title', {}, g); t.textContent = p[2] + ': ' + p[0];
      });
      label(svg, W - 2, yy + 16, (r[1] / r[2]).toFixed(1) + '×', { size: 12, anchor: 'end', weight: 600, fill: F.INK });
    });
  }
  draw();
  addEventListener('resize', draw);
};
})();

/* ── boot ───────────────────────────────────────────────────── */
(function () {
'use strict';
var F = window.__fig;
function fail(host, href) {
  host.innerHTML = '<p class="fx-empty">Chart could not load. ' +
    '<a href="' + href + '" target="_blank" rel="noopener">Open the paper figure</a>.</p>';
}
function boot() {
  var c = document.getElementById('fx-corpus');
  if (c) window.__corpus(c);
  var o = document.getElementById('fx-orcs');
  if (o) window.__orcs(o);
  [['fx-fig4', 'assets/data/fig4', 'static/images/fig4.png',
     { metrics: [{ id: 'rho', label: 'Spearman ρ' }, { id: 'auc', label: 'Hit AUROC' }] }],
   ['fx-fig5', 'assets/data/fig5', 'static/images/fig5.png',
     { dirs: true, metrics: [{ id: 'AUROC', label: 'AUROC' }, { id: 'AP', label: 'Avg. precision' },
       { id: 'P_lower50', label: 'Precision@50' }, { id: 'recall50', label: 'Recall@50' }] }]
  ].forEach(function (spec) {
    var host = document.getElementById(spec[0]);
    if (!host) return;
    F.fetchSet(spec[1]).then(function (d) { window.__bench(host, d, spec[3]); })
      .catch(function () { fail(host, spec[2]); });
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
