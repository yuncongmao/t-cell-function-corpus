/*build*/window.__BUILD_FIGS = '1795203227';
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
function fetchJSON(u){return fetch(u).then(function(r){if(!r.ok)throw new Error(u);return r.json();});}
window.__fig = { el: el, label: label, tag: tag, fmt: fmt, fmtQ: fmtQ, fetchSet: fetchSet, fetchJSON: fetchJSON,
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
  rs = rs.slice().sort(function (a, b) {
    if (a.arm === 'FuncMap') return 1;
    if (b.arm === 'FuncMap') return -1;
    return a.mean - b.mean;
  });
  var W = Math.max(320, Math.min(plot.clientWidth || 700, 920));
  var narrow = W < 560;
  var L = 44, R = 10, T = 26, B = narrow ? 78 : 66;
  var H = (narrow ? 220 : 270) + T + B;
  var bw = (W - L - R) / rs.length;
  plot.innerHTML = '';
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', style: 'display:block;overflow:visible' }, plot);

  var isA = /auroc|auc/i.test(st.metric);
  var vals = [];
  rs.forEach(function (r) {
    vals.push(r.mean + r.sd, r.mean - r.sd);
    r.runs.forEach(function (v) { vals.push(v); });
  });
  var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
  var span = Math.max(hi - lo, 1e-6);
  var base = Math.max(0, lo - span * 0.10);          // zoomed floor, just under the lowest bar
  var top = hi + span * 0.26;                         // headroom for labels
  var broken = base > 1e-9;
  var Y = function (v) { return T + (1 - (v - base) / (top - base)) * (H - T - B); };
  var tk = F.ticks(base, top).filter(function (t) { return t >= base && t <= top; });

  tk.forEach(function (t) {
    el('line', { x1: L - 4, x2: W - R, y1: Y(t), y2: Y(t), stroke: F.RULE }, svg);
    label(svg, L - 8, Y(t) + 4, String(+t.toFixed(3)), { size: 11, fill: F.INK4, anchor: 'end' });
  });
  if (broken) {
    var yb = Y(base);
    [0, 4].forEach(function (dx) {
      el('line', { x1: L - 10 + dx, x2: L - 4 + dx, y1: yb + 3, y2: yb - 3,
        stroke: F.INK4, 'stroke-width': 1 }, svg);
    });
  }
  if (isA && top > 0.5 && base < 0.5) {
    el('line', { x1: L - 4, x2: W - R, y1: Y(0.5), y2: Y(0.5), stroke: F.INK4, 'stroke-dasharray': '3 3' }, svg);
  }
  el('line', { x1: L - 4, x2: W - R, y1: Y(base), y2: Y(base), stroke: '#d3d2cd' }, svg);

  var best = null;
  rs.forEach(function (r) { if (r.arm !== 'FuncMap' && (!best || r.mean > best.mean)) best = r; });

  rs.forEach(function (r, i) {
    var x = L + i * bw, cx = x + bw / 2, me = r.arm === 'FuncMap';
    var g = el('g', { class: 'fx-row', tabindex: '0' }, svg);
    el('rect', { x: x, y: T - 18, width: bw, height: H - T - B + 18, fill: 'transparent' }, g);
    var w = Math.min(bw - 9, 40);
    el('rect', { x: cx - w / 2, y: Y(r.mean), width: w, height: Math.max(1, Y(base) - Y(r.mean)), rx: 2,
      fill: me ? F.RED : (r === best ? F.BAR2 : F.BAR) }, g);
    if (r.sd > 0) {
      el('line', { x1: cx, x2: cx, y1: Y(r.mean - r.sd), y2: Y(r.mean + r.sd),
        stroke: me ? '#5d1b14' : F.INK3, 'stroke-width': 1.1 }, g);
      [r.mean - r.sd, r.mean + r.sd].forEach(function (v) {
        el('line', { x1: cx - 3.5, x2: cx + 3.5, y1: Y(v), y2: Y(v), stroke: me ? '#5d1b14' : F.INK3, 'stroke-width': 1.1 }, g);
      });
    }
    r.runs.forEach(function (v, j) {
      el('circle', { cx: cx + ((j % 5) - 2) * 2.4, cy: Y(v), r: 1.7, fill: '#fff',
        stroke: me ? '#5d1b14' : F.INK3, 'stroke-width': .8 }, g);
    });
    // significance star: FuncMap significantly ahead of this baseline
    if (r.d && r.d.significant === 'True' && +r.d.diff > 0) {
      label(g, cx, Y(r.mean + r.sd) - 7, '\u2605', { size: 10, anchor: 'middle', fill: F.INK3 });
    } else if (r.d && r.d.significant_against === 'True') {
      label(g, cx, Y(r.mean + r.sd) - 7, '\u25b2', { size: 9, anchor: 'middle', fill: '#2f6fb5' });
    }
    if (me) label(g, cx, Y(r.mean + r.sd) - 7, F.fmt(r.mean), { size: 11.5, anchor: 'middle', weight: 600, fill: F.INK });
    var lb = label(g, cx, H - B + 14, NAME[r.arm] || r.arm,
      { size: narrow ? 10 : 11, anchor: 'end', fill: me ? F.INK : F.INK3, weight: me ? 600 : 400 });
    lb.setAttribute('transform', 'rotate(-40 ' + cx + ' ' + (H - B + 14) + ')');
    var hov = function () { say(note, r, best, st, cfg); };
    g.addEventListener('mouseenter', hov);
    g.addEventListener('focus', hov);
  });
  var fm = null;
  rs.forEach(function (r) { if (r.arm === 'FuncMap') fm = r; });
  if (fm && best && fm.mean > best.mean) {
    var bi = rs.indexOf(best), fi = rs.indexOf(fm);
    var bx = L + bi * bw + bw / 2, fx = L + fi * bw + bw / 2;
    var yb = Y(best.mean), yf = Y(fm.mean);
    el('line', { x1: bx, x2: fx + 2, y1: yb, y2: yb, stroke: F.INK4,
      'stroke-dasharray': '2 3', 'stroke-width': 1 }, svg);
    el('line', { x1: fx + 2, x2: fx + 2, y1: yb, y2: yf, stroke: F.RED, 'stroke-width': 1.3 }, svg);
    el('path', { d: 'M ' + (fx - 1) + ' ' + (yf + 4) + ' L ' + (fx + 2) + ' ' + yf + ' L ' + (fx + 5) + ' ' + (yf + 4),
      stroke: F.RED, fill: 'none', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    label(svg, fx - Math.min(bw - 9, 40) / 2 - 5, (yb + yf) / 2 + 3.5, '+' + F.fmt(fm.mean - best.mean),
      { size: 10.5, fill: F.RED, weight: 600, anchor: 'end' });
  }
  say(note, fm || rs[rs.length - 1], best, st, cfg);
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
  { name: 'Species', parts: [['Human', 123, 822304], ['Mouse', 48, 333054], ['Rat', 11, 104467]] },
  { name: 'Antigen receptor', parts: [['TCR', 118, 886745], ['CAR', 64, 373080]] },
  { name: 'Perturbation', parts: [['CRISPR knockout', 132, 1057410], ['Knock-in', 30, 3060],
      ['CRISPR activation', 10, 149984], ['Overexpression', 7, 11799], ['CRISPR interference', 3, 37572]] },
  { name: 'Library scale', parts: [['Focused', 85, 10593], ['Genome-wide', 63, 1171120], ['Intermediate', 34, 78112]] }
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
    [['screens', 'Assays'], ['effects', 'Gene-level effects']].forEach(function (o) {
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
          (mode === 'screens' ? 'assays' : 'effects') + ' (' + pct.toFixed(1) + '%)';
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

/* ── in vivo screen design (Figure 6) ───────────────────────── */
(function () {
'use strict';
var F = window.__fig, el = F.el, label = F.label, tag = F.tag;
var STEPS = [
  ['Curated library', '~200 genes', 'chosen by hand for an in vivo screen'],
  ['In vivo screen', 'tumor-bearing mice', 'measure the effect of every gene in the library'],
  ['FuncMap', '200 anchors', 'measured genes anchor a genome-wide in silico screen'],
  ['Genome-wide', '~11,200 genes', 'predicted effects for every unmeasured gene'],
  ['Wet lab', 'top candidates', 'hits passing prespecified thresholds tested next']
];

window.__flow = function (host) {
  function draw() {
    var W = Math.max(320, Math.min(host.clientWidth || 700, 1000));
    var narrow = W < 680;
    host.innerHTML = '';
    if (narrow) {
      var ol = tag('div', 'flow-v', host);
      STEPS.forEach(function (s, i) {
        var r = tag('div', 'flow-step' + (i === 2 ? ' hi' : ''), ol);
        tag('div', 'n', r, String(i + 1));
        var b = tag('div', '', r);
        tag('div', 'h', b, s[0]);
        tag('div', 'q', b, s[1]);
        tag('div', 'd', b, s[2]);
      });
      return;
    }
    var H = 128, gap = 14, bw = (W - gap * (STEPS.length - 1)) / STEPS.length;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', style: 'display:block' }, host);
    STEPS.forEach(function (s, i) {
      var x = i * (bw + gap), g = el('g', {}, svg);
      var hi = i === 2;
      el('rect', { x: x, y: 16, width: bw, height: 86, rx: 8,
        fill: hi ? 'rgba(181,54,43,.06)' : '#fff',
        stroke: hi ? '#b5362b' : '#e7e6e2', 'stroke-width': hi ? 1.4 : 1 }, g);
      label(g, x + 12, 38, s[0], { size: 12.5, weight: 600, fill: hi ? '#b5362b' : F.INK });
      label(g, x + 12, 55, s[1], { size: 11.5, fill: F.INK3 });
      var words = s[2].split(' '), line = '', y = 73;
      words.forEach(function (w) {
        if ((line + ' ' + w).length > Math.floor((bw - 24) / 5.1)) {
          label(g, x + 12, y, line, { size: 10.5, fill: F.INK4 });
          line = w; y += 12;
        } else line = line ? line + ' ' + w : w;
      });
      if (line) label(g, x + 12, y, line, { size: 10.5, fill: F.INK4 });
      if (i < STEPS.length - 1) {
        var ax = x + bw + gap / 2;
        el('path', { d: 'M ' + (ax - 4) + ' 59 L ' + (ax + 4) + ' 59 M ' + (ax + 1) + ' 56 L ' + (ax + 4) + ' 59 L ' + (ax + 1) + ' 62',
          stroke: F.INK4, 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
      }
    });
  }
  draw();
  addEventListener('resize', draw);
};

var ORDER = ['Gene mean', 'kNN', 'SVD', 'Stack', 'PIE', 'CatBoost', 'AssayFormer', 'TabICL', 'Kumo', 'FuncMap'];

window.__fig6 = function (host, payload) {
  var metrics = payload.metrics, D = payload.data;
  var cur = 'Enriched AUROC';
  var ctrls = tag('div', 'fx-ctrls', host);
  var plot = tag('div', 'fx-plot', host);
  var note = tag('div', 'fx-note', host);

  function bar() {
    ctrls.innerHTML = '';
    [['Enriched', metrics.filter(function (m) { return m.indexOf('Enriched') === 0; })],
     ['Signed', metrics.filter(function (m) { return m.indexOf('Signed') === 0; })],
     ['Depleted', metrics.filter(function (m) { return m.indexOf('Depleted') === 0; })]
    ].forEach(function (grp) {
      if (!grp[1].length) return;
      var g = tag('div', 'fx-g', ctrls);
      tag('span', 'fx-gl', g, grp[0]);
      var box = tag('div', 'fx-gb', g);
      grp[1].forEach(function (m) {
        var lbl = m.replace(/^(Enriched|Depleted|Signed) /, '');
        var b = tag('button', m === cur ? 'on' : '', box, lbl);
        b.type = 'button';
        b.onclick = function () { cur = m; bar(); draw(); };
      });
    });
  }
  function draw() {
    var vals = D[cur];
    var names = ORDER.filter(function (n) { return vals[n] != null; });
    var W = Math.max(320, Math.min(plot.clientWidth || 700, 920));
    var narrow = W < 560;
    var L = 46, R = 10, T = 24, B = narrow ? 78 : 66;
    var H = (narrow ? 210 : 250) + T + B;
    var bw = (W - L - R) / names.length;
    plot.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', style: 'display:block;overflow:visible' }, plot);
    var hi = -Infinity, lo = Infinity;
    names.forEach(function (n) { hi = Math.max(hi, vals[n]); lo = Math.min(lo, vals[n]); });
    var span = Math.max(hi - lo, 1e-6);
    var base = Math.max(0, lo - span * 0.10), top = hi + span * 0.22;
    var Y = function (v) { return T + (1 - (v - base) / (top - base)) * (H - T - B); };
    var tk = F.ticks(base, top).filter(function (t) { return t >= base && t <= top; });
    tk.forEach(function (t) {
      el('line', { x1: L - 4, x2: W - R, y1: Y(t), y2: Y(t), stroke: F.RULE }, svg);
      label(svg, L - 8, Y(t) + 4, String(+t.toFixed(3)), { size: 11, fill: F.INK4, anchor: 'end' });
    });
    if (base > 1e-9) {
      [0, 4].forEach(function (dx) {
        el('line', { x1: L - 10 + dx, x2: L - 4 + dx, y1: Y(base) + 3, y2: Y(base) - 3,
          stroke: F.INK4, 'stroke-width': 1 }, svg);
      });
    }
    if (/AUROC/.test(cur) && base < 0.5 && top > 0.5) {
      el('line', { x1: L - 4, x2: W - R, y1: Y(0.5), y2: Y(0.5), stroke: F.INK4, 'stroke-dasharray': '3 3' }, svg);
      }
    var best = null;
    names.forEach(function (n) { if (n !== 'FuncMap' && (best === null || vals[n] > vals[best])) best = n; });
    names.forEach(function (n, i) {
      var x = L + i * bw, cx = x + bw / 2, me = n === 'FuncMap';
      var g = el('g', { class: 'fx-row', tabindex: '0' }, svg);
      el('rect', { x: x, y: T - 16, width: bw, height: H - T - B + 16, fill: 'transparent' }, g);
      var w = Math.min(bw - 9, 40);
      el('rect', { x: cx - w / 2, y: Y(vals[n]), width: w, height: Math.max(1, Y(base) - Y(vals[n])), rx: 2,
        fill: me ? F.RED : (n === best ? F.BAR2 : F.BAR) }, g);
      label(g, cx, Y(vals[n]) - 6, F.fmt(vals[n]),
        { size: me ? 11.5 : 10.5, anchor: 'middle', weight: me ? 600 : 400, fill: me ? F.INK : F.INK4 });
      var lb = label(g, cx, H - B + 14, n, { size: narrow ? 10 : 11, anchor: 'end',
        fill: me ? F.INK : F.INK3, weight: me ? 600 : 400 });
      lb.setAttribute('transform', 'rotate(-40 ' + cx + ' ' + (H - B + 14) + ')');
      g.addEventListener('mouseenter', function () { say(n); });
      g.addEventListener('focus', function () { say(n); });
    });
    if (vals['FuncMap'] != null && best && vals['FuncMap'] > vals[best]) {
      var bi = names.indexOf(best), fi = names.indexOf('FuncMap');
      var bx = L + bi * bw + bw / 2, fx = L + fi * bw + bw / 2;
      var yb = Y(vals[best]), yf = Y(vals['FuncMap']);
      el('line', { x1: bx, x2: fx + 2, y1: yb, y2: yb, stroke: F.INK4, 'stroke-dasharray': '2 3', 'stroke-width': 1 }, svg);
      el('line', { x1: fx + 2, x2: fx + 2, y1: yb, y2: yf, stroke: F.RED, 'stroke-width': 1.3 }, svg);
      el('path', { d: 'M ' + (fx - 1) + ' ' + (yf + 4) + ' L ' + (fx + 2) + ' ' + yf + ' L ' + (fx + 5) + ' ' + (yf + 4),
        stroke: F.RED, fill: 'none', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
      label(svg, fx - Math.min(bw - 9, 40) / 2 - 5, (yb + yf) / 2 + 3, '+' + F.fmt(vals['FuncMap'] - vals[best]),
        { size: 10.5, fill: F.RED, weight: 600, anchor: 'end' });
    }
    function say(n) {
      note.innerHTML = '';
      tag('span', 'fx-k', note, n);
      tag('span', 'fx-s', note, ' · ' + cur + ' = ' + F.fmt(vals[n]));
      if (n !== 'FuncMap') {
        var d = vals['FuncMap'] - vals[n];
        tag('div', 'fx-d', note, 'FuncMap − ' + n + ' = ' + (d > 0 ? '+' : '−') + F.fmt(Math.abs(d)));
      } else {
        tag('div', 'fx-d', note, 'Strongest baseline here: ' + best + ' at ' + F.fmt(vals[best]) + '.');
      }
    }
    say('FuncMap');
  }
  bar(); draw();
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
  var fl = document.getElementById('fx-flow');
  if (fl) window.__flow(fl);
  var f6 = document.getElementById('fx-fig6');
  if (f6) F.fetchJSON('assets/data/fig6.json').then(function (d) { window.__fig6(f6, d); })
    .catch(function () { fail(f6, 'static/images/fig6.png'); });
  [['fx-fig4', 'assets/data/fig4', 'static/images/fig4.png',
     { metrics: [{ id: 'rho', label: 'Spearman \u03c1' }, { id: 'auc', label: 'Hit AUROC' }] }]
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
