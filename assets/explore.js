/*build*/window.__BUILD_EXPLORE = '1795202592';
/* T Cell Function Corpus — gene / assay explorer */
(function () {
'use strict';

var S = { genes: [], index: {}, shards: 128, assays: [], top: null, cache: {},
          gene: null, rows: [], filt: {}, sort: { k: 'sc', dir: -1 } };

var $ = function (s) { return document.querySelector(s); };
function h(tag, cls, parent, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function fnv(s) {
  var x = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return x;
}
function num(v, d) { return v == null ? '—' : v.toFixed(d == null ? 2 : d); }
function pval(v) {
  if (v == null) return '—';
  if (v === 0) return '<1×10⁻³⁰⁰';
  if (v >= 0.1) return v.toFixed(2);
  if (v >= 0.001) return v.toFixed(3);
  var e = v.toExponential(1).split('e');
  return e[0] + '×10⁻' + sup(Math.abs(+e[1]));
}
var ORD = ['⁰','¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹'];
function sup(n) { return String(n).split('').map(function (c) { return ORD[+c] || c; }).join(''); }

function getJSON(url) {
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  });
}

/* ── boot ───────────────────────────────────────────────────── */
Promise.all([getJSON('data/genes.json'), getJSON('data/assays.json')])
  .then(function (a) {
    S.shards = a[0].shards;
    S.genes = a[0].genes;
    S.genes.forEach(function (g) { S.index[g[0]] = g; });
    S.assays = a[1];
    $('#ngenes').textContent = S.genes.length.toLocaleString();
    initSearch();
    initTabs();
    renderAssayList();
    addEventListener('hashchange', function () {
      var g = (location.hash || '').replace(/^#/, '').toUpperCase();
      if (g && g !== S.gene) { $('#q').value = g; window.showGene(g); }
    });
    var start = (location.hash || '').replace(/^#/, '').toUpperCase();
    if (start) { $('#q').value = start; showGene(start); }
    else $('#panel-gene').innerHTML =
      '<p class="loading">Type a gene symbol above to see how it behaves across every assay that measured it.</p>';
  })
  .catch(function (e) {
    $('#panel-gene').innerHTML = '<p class="loading">Could not load the corpus data (' +
      e.message + '). If you are opening this file directly, serve the folder over HTTP instead.</p>';
  });

/* ── search ─────────────────────────────────────────────────── */
function initSearch() {
  var q = $('#q'), ac = $('#ac'), sel = -1, cur = [];

  function close() { ac.classList.add('hide'); sel = -1; }

  function suggest() {
    var v = q.value.trim().toUpperCase();
    if (!v) { close(); return; }
    var pre = [], mid = [];
    for (var i = 0; i < S.genes.length && pre.length + mid.length < 400; i++) {
      var g = S.genes[i], p = g[0].indexOf(v);
      if (p === 0) pre.push(g);
      else if (p > 0) mid.push(g);
    }
    cur = pre.concat(mid).slice(0, 40);
    ac.innerHTML = '';
    if (!cur.length) { h('div', 'muted', ac, 'No gene matches “' + q.value.trim() + '”'); }
    cur.forEach(function (g, i) {
      var d = h('div', '', ac);
      var nm = h('span', '', d);
      var p = g[0].indexOf(v);
      nm.appendChild(document.createTextNode(g[0].slice(0, p)));
      h('mark', '', nm, g[0].substr(p, v.length));
      nm.appendChild(document.createTextNode(g[0].slice(p + v.length)));
      h('span', 'n', d, g[1] + ' assay' + (g[1] === 1 ? '' : 's'));
      d.onmousedown = function (ev) { ev.preventDefault(); pick(i); };
    });
    ac.classList.remove('hide');
  }
  function pick(i) {
    if (!cur[i]) return;
    q.value = cur[i][0];
    close();
    showGene(cur[i][0]);
  }
  q.addEventListener('input', suggest);
  q.addEventListener('focus', suggest);
  q.addEventListener('blur', function () { setTimeout(close, 120); });
  q.addEventListener('keydown', function (e) {
    var items = ac.querySelectorAll('div');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      if (sel >= 0) items[sel].classList.remove('sel');
      sel = e.key === 'ArrowDown' ? Math.min(sel + 1, items.length - 1) : Math.max(sel - 1, 0);
      items[sel].classList.add('sel');
      items[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sel >= 0) pick(sel);
      else {
        var v = q.value.trim().toUpperCase();
        if (S.index[v]) { close(); showGene(v); }
        else if (cur.length) pick(0);
      }
    } else if (e.key === 'Escape') close();
  });
  document.querySelectorAll('.chips button').forEach(function (b) {
    b.onclick = function () { q.value = b.dataset.g; showGene(b.dataset.g); };
  });
}

function initTabs() {
  var T = [['#tab-gene', '#panel-gene'], ['#tab-assay', '#panel-assay'], ['#tab-cmp', '#panel-cmp']];
  T.forEach(function (cur) {
    var btn = $(cur[0]);
    if (!btn) return;
    btn.onclick = function () {
      T.forEach(function (o) {
        var b = $(o[0]), p = $(o[1]);
        if (!b || !p) return;
        b.classList.toggle('on', o === cur);
        p.classList.toggle('hide', o !== cur);
      });
      if (cur[0] === '#tab-cmp' && window.renderCompare) {
        window.renderCompare();
        setTimeout(function () { if (window.__cmpPaint && window.__C.pts.length) window.__cmpPaint(); }, 60);
      }
    };
  });
}

window.__E = { S: S, $: $, h: h, fnv: fnv, num: num, pval: pval, sup: sup, getJSON: getJSON };
})();

/* ── gene view ──────────────────────────────────────────────── */
(function () {
'use strict';
var E = window.__E, S = E.S, $ = E.$, h = E.h;
var NS = 'http://www.w3.org/2000/svg';
var FACETS = [
  ['org', 'Organism'], ['airr', 'Receptor'], ['imode', 'Modality'],
  ['phenotype_category', 'Phenotype'], ['selcat', 'Selection'], ['au', 'Study']
];
var PRETTY = {
  marker_sorting: 'Marker sorting', tumor_challenge: 'Tumor challenge',
  chronic_stimulation: 'Chronic stimulation', proliferation: 'Proliferation',
  activation: 'Activation', trafficking: 'Trafficking', infection: 'Infection',
  none: 'None', suppressive_condition: 'Suppressive condition',
  cytokine_polarization: 'Cytokine polarization', protein_expression: 'Protein expression',
  persistence: 'Persistence', differentiation: 'Differentiation', functional: 'Effector function',
  viability: 'Viability', rna_expression: 'RNA expression', other: 'Other'
};
function pretty(v) { return v == null ? '—' : (PRETTY[v] || v); }

window.showGene = function (sym) {
  sym = String(sym || '').toUpperCase();
  var p = $('#panel-gene');
  $('#tab-gene').click();
  if (!S.index[sym]) {
    p.innerHTML = '<p class="loading">No gene called “' + sym +
      '” in the corpus. Try the search box above.</p>';
    return;
  }
  history.replaceState(null, '', '#' + sym);
  p.innerHTML = '<p class="loading">Loading ' + sym + '…</p>';
  var sh = E.fnv(sym) % S.shards;
  var got = S.cache[sh] ? Promise.resolve(S.cache[sh])
    : E.getJSON('data/g/' + sh + '.json').then(function (d) { S.cache[sh] = d; return d; });
  got.then(function (d) {
    S.gene = sym;
    S.filt = {};
    S.rows = (d[sym] || []).map(function (r) {
      return { a: S.assays[r[0]], sc: r[1], lfc: r[2] == null ? null : r[2],
               fdr: r[3] == null ? null : r[3], hit: r[4] == null ? null : r[4],
               nm: r[5] || sym };
    }).filter(function (r) { return r.a; });
    render();
  }).catch(function (e) {
    p.innerHTML = '<p class="loading">Could not load data for ' + sym + ' (' + e.message + ').</p>';
  });
};

function visible() {
  return S.rows.filter(function (r) {
    for (var k in S.filt) if (S.filt[k] && String(r.a[k]) !== S.filt[k]) return false;
    return true;
  });
}

function render() {
  var p = $('#panel-gene');
  p.innerHTML = '';
  var rows = S.rows;
  var names = {}; rows.forEach(function (r) { names[r.nm] = 1; });
  var alias = Object.keys(names).filter(function (n) { return n !== S.gene; });

  var head = h('div', 'ghead', p);
  h('h2', '', head, S.gene);
  if (alias.length) h('span', 'alias', head, 'also reported as ' + alias.join(', '));

  var up = rows.filter(function (r) { return r.sc > 0; }).length;
  var dn = rows.filter(function (r) { return r.sc < 0; }).length;
  var studies = {}; rows.forEach(function (r) { studies[r.a.study_id] = 1; });
  var sum = h('div', 'gsum', p);
  sum.innerHTML = 'Measured in <b>' + rows.length + '</b> of ' + S.assays.length +
    ' assays, across <b>' + Object.keys(studies).length + '</b> studies. ' +
    '<span class="pill"><i style="background:var(--up)"></i>' + up + ' promote</span> ' +
    '<span class="pill"><i style="background:var(--dn)"></i>' + dn + ' restrain</span>';

  buildFilters(p);
  var vis = visible();
  stripPlot(p, vis);
  window.__table(p, vis);
}

function buildFilters(p) {
  var bar = h('div', 'filters', p);
  FACETS.forEach(function (f) {
    var vals = {};
    S.rows.forEach(function (r) { if (r.a[f[0]] != null) vals[r.a[f[0]]] = (vals[r.a[f[0]]] || 0) + 1; });
    var keys = Object.keys(vals).sort();
    if (keys.length < 2) return;
    var lab = h('label', '', bar);
    lab.appendChild(document.createTextNode(f[1]));
    var sel = h('select', '', lab);
    var o0 = h('option', '', sel, 'All');
    o0.value = '';
    keys.forEach(function (k) {
      var o = h('option', '', sel, (f[0] === 'au' ? k : pretty(k)) + '  (' + vals[k] + ')');
      o.value = k;
    });
    sel.value = S.filt[f[0]] || '';
    sel.onchange = function () { S.filt[f[0]] = sel.value; redraw(); };
  });
  var c = h('span', 'count', bar);
  var n = visible().length;
  c.textContent = n + ' of ' + S.rows.length + ' shown';
  if (Object.keys(S.filt).some(function (k) { return S.filt[k]; })) {
    var b = h('button', 'clear', bar, 'Clear');
    b.onclick = function () { S.filt = {}; render(); };
  }
}

function redraw() {
  var keep = S.filt;
  render();
  S.filt = keep;
}

/* strip plot: one row per phenotype category */
function stripPlot(p, rows) {
  if (!rows.length) { h('p', 'loading', p, 'No assays match these filters.'); return; }
  var box = h('div', 'strip', p);
  var groups = {};
  rows.forEach(function (r) {
    var k = r.a.phenotype_category || 'other';
    (groups[k] = groups[k] || []).push(r);
  });
  var max = 0;
  rows.forEach(function (r) { max = Math.max(max, Math.abs(r.sc)); });
  max = Math.max(max, 0.5) * 1.08;

  var keys = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length; });
  var W = Math.max(320, Math.min(box.clientWidth || 760, 900)), PAD = 26;
  var X = function (v) { return PAD + (v + max) / (2 * max) * (W - 2 * PAD); };

  // axis
  var ar = h('div', 'striprow', box);
  h('div', 'lab', ar, '');
  var av = document.createElementNS(NS, 'svg');
  av.setAttribute('viewBox', '0 0 ' + W + ' 22');
  av.setAttribute('width', '100%');
  av.style.display = 'block';
  [-max, -max / 2, 0, max / 2, max].forEach(function (t) {
    var tx = document.createElementNS(NS, 'text');
    tx.setAttribute('x', X(t)); tx.setAttribute('y', 15);
    tx.setAttribute('text-anchor', 'middle');
    tx.setAttribute('class', 'axis');
    tx.textContent = (t === 0 ? '0' : (t > 0 ? '+' : '−') + Math.abs(t).toFixed(1));
    av.appendChild(tx);
  });
  ar.querySelector('.lab').innerHTML = '<em>restrains ← → promotes</em>';
  ar.appendChild(av);

  keys.forEach(function (k) {
    var row = h('div', 'striprow', box);
    var lab = h('div', 'lab', row);
    lab.appendChild(document.createTextNode(pretty(k)));
    h('em', '', lab, groups[k].length + ' assay' + (groups[k].length === 1 ? '' : 's'));
    var svg = document.createElementNS(NS, 'svg');
    var H = 34;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', '100%');
    svg.style.display = 'block';

    var ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', PAD); ln.setAttribute('x2', W - PAD);
    ln.setAttribute('y1', H / 2); ln.setAttribute('y2', H / 2);
    ln.setAttribute('stroke', '#e7e6e2');
    svg.appendChild(ln);
    var zr = document.createElementNS(NS, 'line');
    zr.setAttribute('x1', X(0)); zr.setAttribute('x2', X(0));
    zr.setAttribute('y1', 4); zr.setAttribute('y2', H - 4);
    zr.setAttribute('stroke', '#d3d2cd');
    svg.appendChild(zr);

    groups[k].forEach(function (r, i) {
      var cc = document.createElementNS(NS, 'circle');
      cc.setAttribute('cx', X(r.sc));
      cc.setAttribute('cy', H / 2 + ((i % 3) - 1) * 4.4);
      cc.setAttribute('r', 4.6);
      cc.setAttribute('class', 'dot');
      cc.setAttribute('fill', r.sc >= 0 ? '#b5362b' : '#2f6fb5');
      cc.setAttribute('fill-opacity', r.fdr != null && r.fdr < 0.1 ? '0.95' : '0.42');
      cc.addEventListener('mouseenter', function (ev) { tip(ev, r); });
      cc.addEventListener('mousemove', move);
      cc.addEventListener('mouseleave', hide);
      svg.appendChild(cc);
    });
    row.appendChild(svg);
  });
  var leg = h('p', 'tiny', box,
    'Each dot is one assay. Position is the harmonized signed score; solid dots have FDR < 0.1.');
  leg.style.marginTop = '8px';
}

var tipEl = null;
function tip(ev, r) {
  hide();
  tipEl = h('div', 'tipbox', document.body);
  var a = r.a;
  tipEl.innerHTML = '<b>' + a.phenotype_name + '</b><br>' +
    '<span class="s">' + (a.au || '') + ' ' + (a.yr || '') + ' · ' + (a.org || '') +
    ' · ' + (a.airr || '') + ' · ' + (a.imode || '') + '</span><br>' +
    'score ' + E.num(r.sc) + (r.fdr != null ? ' · FDR ' + E.pval(r.fdr) : '') +
    '<br><span class="s">' + pretty(a.selcat) + '</span>';
  move(ev);
}
function move(ev) {
  if (!tipEl) return;
  var x = ev.clientX + 14, y = ev.clientY + 14;
  var b = tipEl.getBoundingClientRect();
  if (x + b.width > innerWidth - 10) x = ev.clientX - b.width - 14;
  if (y + b.height > innerHeight - 10) y = ev.clientY - b.height - 14;
  tipEl.style.left = x + 'px';
  tipEl.style.top = y + 'px';
}
function hide() { if (tipEl) { tipEl.remove(); tipEl = null; } }
window.__hideTip = hide;
window.__pretty = pretty;
window.__visible = visible;
window.__renderGene = render;
})();

/* ── gene table ─────────────────────────────────────────────── */
(function () {
'use strict';
var E = window.__E, S = E.S, h = E.h;
var pretty = window.__pretty;
var COLS = [
  { k: 'sc', t: 'Score', num: 1 },
  { k: 'lfc', t: 'log2FC', num: 1 },
  { k: 'fdr', t: 'FDR', num: 1 },
  { k: 'ph', t: 'Phenotype' },
  { k: 'ctx', t: 'Context' },
  { k: 'study', t: 'Study' }
];
function val(r, k) {
  if (k === 'sc') return r.sc;
  if (k === 'lfc') return r.lfc;
  if (k === 'fdr') return r.fdr == null ? 2 : r.fdr;
  if (k === 'ph') return (r.a.phenotype_category || '') + (r.a.phenotype_name || '');
  if (k === 'ctx') return (r.a.org || '') + (r.a.imode || '');
  return (r.a.au || '') + (r.a.yr || '');
}
window.__table = function (p, rows) {
  if (!rows.length) return;
  var wrap = h('div', '', p);
  wrap.style.overflowX = 'auto';
  var t = h('table', 'rows', wrap);
  var thead = h('thead', '', t), tr = h('tr', '', thead);
  COLS.forEach(function (c) {
    var th = h('th', S.sort.k === c.k ? 'sorted' : '', tr, c.t);
    if (c.num) th.style.textAlign = 'right';
    if (S.sort.k === c.k) h('span', 'ar', th, S.sort.dir < 0 ? '▼' : '▲');
    th.onclick = function () {
      if (S.sort.k === c.k) S.sort.dir *= -1;
      else { S.sort.k = c.k; S.sort.dir = (c.k === 'fdr') ? 1 : (c.num ? -1 : 1); }
      window.__hideTip();
      window.__renderGene();
    };
  });
  var sorted = rows.slice().sort(function (x, y) {
    var a = val(x, S.sort.k), b = val(y, S.sort.k);
    if (S.sort.k === 'sc') { a = Math.abs(a); b = Math.abs(b); }
    if (a === b) return 0;
    return (a > b ? 1 : -1) * S.sort.dir;
  });
  var max = 0;
  rows.forEach(function (r) { max = Math.max(max, Math.abs(r.sc)); });
  var tb = h('tbody', '', t);
  sorted.forEach(function (r) {
    var a = r.a, row = h('tr', '', tb);
    var td = h('td', 'sc', row);
    td.style.color = r.sc >= 0 ? 'var(--up)' : 'var(--dn)';
    var bar = h('span', 'bar', td);
    bar.style.width = Math.max(2, Math.abs(r.sc) / (max || 1) * 34) + 'px';
    bar.style.background = r.sc >= 0 ? 'var(--up)' : 'var(--dn)';
    bar.style.opacity = '.3';
    bar.style.marginRight = '6px';
    td.appendChild(document.createTextNode((r.sc > 0 ? '+' : '') + E.num(r.sc)));
    h('td', 'num', row, E.num(r.lfc));
    var f = h('td', 'num', row, E.pval(r.fdr));
    if (r.fdr != null && r.fdr < 0.1) f.style.color = 'var(--ink)';
    else f.style.color = 'var(--ink-4)';

    var ph = h('td', '', row);
    h('div', '', ph, a.phenotype_name || a.readout || '—');
    h('div', 'ctx', ph, pretty(a.phenotype_category) +
      (a.phenotype_method ? ' · ' + a.phenotype_method : ''));

    var cx = h('td', 'ctx', row);
    cx.innerHTML = '<b>' + [a.org, a.airr, a.imode].filter(Boolean).join(' · ') + '</b><br>' +
      pretty(a.selcat) + (a.stim ? ' · ' + a.stim : '');

    var st = h('td', '', row);
    var lk = h('a', '', st, (a.au || '') + ' ' + (a.yr || ''));
    lk.href = a.doi ? ('https://doi.org/' + String(a.doi).replace(/^https?:\/\/doi\.org\//, '')) : '#';
    lk.target = '_blank';
    lk.rel = 'noopener';
    lk.style.textDecoration = 'none';
    lk.style.borderBottom = '1px solid var(--rule-2)';
    h('div', 'ctx', st, a.jr || '');
    if (r.nm !== S.gene) h('div', 'tiny', st, 'reported as ' + r.nm);
  });
};
})();

/* ── assay browser ──────────────────────────────────────────── */
(function () {
'use strict';
var E = window.__E, S = E.S, $ = E.$, h = E.h;
var pretty = window.__pretty;
var AF = [['org', 'Organism'], ['airr', 'Receptor'], ['imode', 'Modality'],
          ['phenotype_category', 'Phenotype'], ['selcat', 'Selection']];
var af = {};

window.renderAssayList = function () {
  var p = $('#panel-assay');
  p.innerHTML = '';
  var bar = h('div', 'filters', p);
  AF.forEach(function (f) {
    var vals = {};
    S.assays.forEach(function (a) { if (a[f[0]] != null) vals[a[f[0]]] = (vals[a[f[0]]] || 0) + 1; });
    var lab = h('label', '', bar);
    lab.appendChild(document.createTextNode(f[1]));
    var sel = h('select', '', lab);
    var o0 = h('option', '', sel, 'All'); o0.value = '';
    Object.keys(vals).sort().forEach(function (k) {
      var o = h('option', '', sel, pretty(k) + '  (' + vals[k] + ')');
      o.value = k;
    });
    sel.value = af[f[0]] || '';
    sel.onchange = function () { af[f[0]] = sel.value; renderAssayList(); };
  });
  var list = S.assays.filter(function (a) {
    for (var k in af) if (af[k] && String(a[k]) !== af[k]) return false;
    return true;
  });
  h('span', 'count', bar, list.length + ' of ' + S.assays.length + ' assays');
  if (Object.keys(af).some(function (k) { return af[k]; })) {
    var b = h('button', 'clear', bar, 'Clear');
    b.onclick = function () { af = {}; renderAssayList(); };
  }
  var box = h('div', 'alist', p);
  list.forEach(function (a) {
    var c = h('div', 'acard', box);
    h('h4', '', c, a.phenotype_name || a.readout);
    h('div', 'meta', c, (a.au || '') + ' ' + (a.yr || '') + ' · ' + (a.jr || '') +
      ' · ' + a.n_genes.toLocaleString() + ' genes measured');
    var tg = h('div', 'tags', c);
    [a.org, a.airr, a.imode, pretty(a.phenotype_category), pretty(a.selcat)]
      .filter(Boolean).forEach(function (x) { h('span', '', tg, x); });
    c.onclick = function () { drawer(a); };
  });
};

function drawer(a) {
  var i = S.assays.indexOf(a);
  var d = h('div', 'drawer', document.body);
  d.onclick = function (e) { if (e.target === d) d.remove(); };
  var inn = h('div', 'in', d);
  var x = h('button', 'close', inn, '×');
  x.onclick = function () { d.remove(); };
  h('h3', '', inn, a.phenotype_name || a.readout);
  h('div', 'meta muted', inn, (a.au || '') + ' ' + (a.yr || '') + ' · ' + (a.jr || ''));
  var kv = h('dl', 'kv', inn);
  [['Study', a.study_title || a.study_name], ['Screen', a.screen_title],
   ['Readout', a.readout], ['Phenotype', pretty(a.phenotype_category)],
   ['Method', a.phenotype_method || a.phenotype_assay_method],
   ['Direction convention', a.dirconv], ['Cell system', a.csname],
   ['Organism', a.org], ['Receptor', (a.airr || '') + (a.airrname ? ' · ' + a.airrname : '')],
   ['Modality', a.imode], ['Library', a.ilibname || a.ilib],
   ['Delivery', a.ideliv], ['Selection', pretty(a.selcat)],
   ['Selection detail', a.sel], ['Stimulation', a.stim],
   ['Culture', a.cult], ['Harvest', a.harvest],
   ['Genes measured', a.n_genes.toLocaleString()]
  ].forEach(function (kvp) {
    if (!kvp[1]) return;
    h('dt', '', kv, kvp[0]);
    h('dd', '', kv, String(kvp[1]));
  });
  if (a.doi) {
    h('dt', '', kv, 'Paper');
    var dd = h('dd', '', kv);
    var lk = h('a', '', dd, String(a.doi));
    lk.href = 'https://doi.org/' + String(a.doi).replace(/^https?:\/\/doi\.org\//, '');
    lk.target = '_blank'; lk.rel = 'noopener';
  }
  var tl = h('div', 'toplists', inn);
  var load = S.top ? Promise.resolve(S.top)
    : E.getJSON('data/assay_top.json').then(function (t) { S.top = t; return t; });
  load.then(function (t) {
    var rec = t[String(i)];
    if (!rec) return;
    [['Top promoting', rec.up], ['Top restraining', rec.dn]].forEach(function (pair) {
      var col = h('div', '', tl);
      h('h5', '', col, pair[0]);
      var ol = h('ol', '', col);
      pair[1].slice(0, 25).forEach(function (g) {
        var li = h('li', '', ol);
        var lk = h('a', '', li, g[0]);
        lk.href = '#' + g[0];
        lk.onclick = function (ev) {
          ev.preventDefault();
          d.remove();
          $('#q').value = g[0];
          window.showGene(g[0]);
        };
        var s = h('span', '', li, (g[1] > 0 ? '+' : '') + g[1].toFixed(2));
        s.style.color = g[1] >= 0 ? 'var(--up)' : 'var(--dn)';
      });
    });
  });
}
})();

/* ── compare: two axes, genes as points ─────────────────────── */
(function () {
'use strict';
var E = window.__E, S = E.S, $ = E.$, h = E.h;
var C = { axes: null, cache: {}, X: null, Y: null, pts: [], quad: 'all',
          thr: 0.15, hl: {}, dpr: 1, view: 'ko', minSig: 2 };
var DEF_X = 'c-proliferation--crisprn', DEF_Y = 'r-t-cell-persistence--crisprn';

window.renderCompare = function () {
  var p = $('#panel-cmp');
  if (C.axes) return;
  p.innerHTML = '<div class="loading">Loading axes…</div>';
  E.getJSON('data/cmp/axes.json').then(function (d) {
    C.axes = d.axes;
    build(p);
  }).catch(function (e) {
    p.innerHTML = '<p class="loading">Could not load comparison data (' + e.message + ').</p>';
  });
};

function axisOptions(sel, cur) {
  sel.innerHTML = '';
  var groups = {};
  C.axes.forEach(function (a) {
    var g = a.kind === 'cat' ? 'Phenotype group' : 'Specific readout';
    (groups[g] = groups[g] || []).push(a);
  });
  ['Phenotype group', 'Specific readout'].forEach(function (gn) {
    if (!groups[gn]) return;
    var og = document.createElement('optgroup');
    og.label = gn;
    groups[gn].forEach(function (a) {
      var o = document.createElement('option');
      o.value = a.id;
      o.textContent = a.label + '  · ' + a.modeLabel + '  · ' +
        a.assays + ' assay' + (a.assays === 1 ? '' : 's') + ', ' + a.genes.toLocaleString() + ' genes' +
        (a.nsig ? '' : '  · no FDR');
      if (a.id === cur) o.selected = true;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
}

function build(p) {
  p.innerHTML = '';
  var top = h('div', 'cmp-top', p);
  ['X', 'Y'].forEach(function (ax) {
    var box = h('div', 'axbox', top);
    h('div', 'hd', box, ax + ' axis');
    var sel = h('select', '', box);
    sel.id = 'ax' + ax;
    h('div', 'sub', box, '').id = 'sub' + ax;
    sel.onchange = function () { load(ax, sel.value); };
  });
  axisOptions($('#axX'), DEF_X);
  axisOptions($('#axY'), DEF_Y);

  var bar = h('div', 'cmp-bar', p);
  var l1 = h('label', '', bar);
  l1.appendChild(document.createTextNode('Threshold'));
  var rg = h('input', '', l1); rg.type = 'range'; rg.min = '0'; rg.max = '0.45';
  rg.step = '0.01'; rg.value = String(C.thr);
  var rv = h('span', 'val', l1, C.thr.toFixed(2));
  rg.oninput = function () { C.thr = +rg.value; rv.textContent = C.thr.toFixed(2); paint(); };
  var l0 = h('label', '', bar);
  l0.appendChild(document.createTextNode('Show'));
  var vb = h('div', 'fx-gb', l0);
  [['ko', 'Effect of knocking out'], ['role', 'Gene role']].forEach(function (o) {
    var b = h('button', C.view === o[0] ? 'on' : '', vb, o[1]);
    b.type = 'button';
    b.onclick = function () { C.view = o[0]; build($('#panel-cmp')); };
  });
  var l3 = h('label', '', bar);
  l3.appendChild(document.createTextNode('Significant in \u2265'));
  var mn = h('input', '', l3); mn.type = 'range'; mn.min = '0'; mn.max = '12'; mn.step = '1';
  mn.value = String(C.minSig);
  var mv = h('span', 'val', l3, C.minSig ? String(C.minSig) : 'any');
  mn.oninput = function () {
    C.minSig = +mn.value;
    mv.textContent = C.minSig ? String(C.minSig) : 'any';
    paint();
  };
  var l2 = h('label', '', bar);
  l2.appendChild(document.createTextNode('Highlight'));
  var sq = h('input', '', l2); sq.type = 'search';
  sq.placeholder = 'PDCD1, TOX, CBLB…';
  sq.oninput = function () {
    C.hl = {};
    sq.value.toUpperCase().split(/[\s,;]+/).forEach(function (g) { if (g) C.hl[g] = 1; });
    paint();
  };
  h('span', 'count', bar, '').id = 'cmpcount';

  var wrap = h('div', 'cmp-wrap', p);
  wrap.id = 'cmpwrap';
  var cv = h('canvas', '', wrap); cv.id = 'cmpcv';
  var ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ov.id = 'cmpov';
  wrap.appendChild(ov);

  h('div', '', p).id = 'cmpq';
  var note = h('p', 'cmp-note', p);
  note.innerHTML = 'Each point is a gene. For every assay on an axis the gene is ranked within that assay; those ranks are averaged, then ranked again across genes, so both axes spread evenly from <b>−0.5</b> to <b>+0.5</b> and are directly comparable. <b>Significant in ≥</b> keeps only genes called at FDR &lt; 0.1 in at least that many assays, which is what separates real regulators from genes that rank high by chance. Axes stay within one perturbation modality, since a knockout and a CRISPRa effect are not comparable. With <b>Effect of knocking out</b> selected, loss-of-function axes are sign-flipped so right and up mean the knockout raises the phenotype; <b>Gene role</b> shows the corpus’s native convention, where positive means the gene promotes it.';

  load('X', DEF_X, true);
  load('Y', DEF_Y);
  addEventListener('resize', paint);
}

function load(ax, id, quiet) {
  var a = null;
  C.axes.forEach(function (x) { if (x.id === id) a = x; });
  if (!a) return;
  $('#sub' + ax).textContent = 'loading…';
  var got = C.cache[id] ? Promise.resolve(C.cache[id])
    : E.getJSON('data/cmp/' + id + '.json').then(function (d) { C.cache[id] = d; return d; });
  got.then(function (d) {
    C[ax] = { meta: a, data: d };
    C.quad = 'all';
    var sub = $('#sub' + ax);
    sub.textContent = a.modeLabel + ' · ' + a.assays + ' assay' +
      (a.assays === 1 ? '' : 's') + ' · ' + a.genes.toLocaleString() + ' genes measured';
    if (!a.nsig) {
      var w = document.createElement('span');
      w.textContent = '  · no FDR reported — the significance filter cannot apply here';
      w.style.color = '#b5362b';
      sub.appendChild(w);
    }
    join();
  }).catch(function () { $('#sub' + ax).textContent = 'could not load'; });
}

var LOF = { CRISPRn: 1, CRISPRi: 1 };
function sign(meta) {
  return (C.view === 'ko' && LOF[meta.mode]) ? -1 : 1;
}
window.__cmpSign = sign;
function join() {
  if (!C.X || !C.Y) return;
  var mx = {}, i, sx = sign(C.X.meta), sy = sign(C.Y.meta);
  for (i = 0; i < C.X.data.idx.length; i++) mx[C.X.data.idx[i]] = i;
  C.pts = [];
  for (i = 0; i < C.Y.data.idx.length; i++) {
    var gi = C.Y.data.idx[i], j = mx[gi];
    if (j === undefined) continue;
    C.pts.push({ g: S.genes[gi][0], x: C.X.data.v[j] * sx, y: C.Y.data.v[i] * sy,
                 nx: C.X.data.n[j], ny: C.Y.data.n[i],
                 sx: (C.X.data.s || [])[j] || 0, sy: (C.Y.data.s || [])[i] || 0 });
  }
  C.maxSx = 0; C.maxSy = 0;
  C.pts.forEach(function (p) {
    if (p.sx > C.maxSx) C.maxSx = p.sx;
    if (p.sy > C.maxSy) C.maxSy = p.sy;
  });
  paint();
}
function paint(){ if (window.__cmpPaint) window.__cmpPaint(); }
window.__C = C;
window.__cmpJoin = join;
})();

/* ── compare: plotting ──────────────────────────────────────── */
(function () {
'use strict';
var E = window.__E, $ = E.$, h = E.h, C = window.__C;
var NS = 'http://www.w3.org/2000/svg';
var PAD = { l: 66, r: 18, t: 18, b: 52 };
var geom = null;

function passN(p) {
  if (!C.minSig) return true;
  return p.sx + p.sy >= C.minSig;
}
function quadOf(p, t) {
  if (!passN(p)) return null;
  if (Math.abs(p.x) < t || Math.abs(p.y) < t) return null;
  return (p.x > 0 ? 'R' : 'L') + (p.y > 0 ? 'T' : 'B');
}

window.__passN = passN;
window.__cmpPaint = function () {
  var wrap = $('#cmpwrap'), cv = $('#cmpcv');
  if (!wrap || !C.pts.length) return;
  var W = wrap.clientWidth || 700;
  var H = Math.max(360, Math.min(Math.round(W * 0.66), 560));
  var dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.height = H + 'px';
  var g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);

  var lim = 0.5;
  var X = function (v) { return PAD.l + (v + lim) / (2 * lim) * (W - PAD.l - PAD.r); };
  var Y = function (v) { return PAD.t + (lim - v) / (2 * lim) * (H - PAD.t - PAD.b); };
  geom = { X: X, Y: Y, W: W, H: H };
  var t = C.thr;

  // grid
  g.strokeStyle = '#e7e6e2'; g.lineWidth = 1;
  [-0.4, -0.2, 0.2, 0.4].forEach(function (v) {
    g.beginPath(); g.moveTo(X(v), PAD.t); g.lineTo(X(v), H - PAD.b); g.stroke();
    g.beginPath(); g.moveTo(PAD.l, Y(v)); g.lineTo(W - PAD.r, Y(v)); g.stroke();
  });
  // zero axes
  g.strokeStyle = '#c9c8c3';
  g.beginPath(); g.moveTo(X(0), PAD.t); g.lineTo(X(0), H - PAD.b); g.stroke();
  g.beginPath(); g.moveTo(PAD.l, Y(0)); g.lineTo(W - PAD.r, Y(0)); g.stroke();
  // threshold lines
  if (t > 0) {
    g.strokeStyle = '#d3d2cd'; g.setLineDash([3, 3]);
    [t, -t].forEach(function (v) {
      g.beginPath(); g.moveTo(X(v), PAD.t); g.lineTo(X(v), H - PAD.b); g.stroke();
      g.beginPath(); g.moveTo(PAD.l, Y(v)); g.lineTo(W - PAD.r, Y(v)); g.stroke();
    });
    g.setLineDash([]);
  }

  // points
  var counts = { RT: 0, RB: 0, LT: 0, LB: 0 }, hits = [];
  C.pts.forEach(function (p) {
    var q = quadOf(p, t);
    if (q) counts[q]++;
    var on = C.hl[p.g];
    if (on) hits.push(p);
    if (C.quad !== 'all' && q !== C.quad && !on) {
      g.fillStyle = 'rgba(154,156,163,.20)';
    } else if (q === 'RB') g.fillStyle = 'rgba(181,54,43,.55)';
    else if (q === 'RT') g.fillStyle = 'rgba(201,138,30,.5)';
    else if (q === 'LB') g.fillStyle = 'rgba(47,125,82,.5)';
    else if (q === 'LT') g.fillStyle = 'rgba(47,111,181,.5)';
    else g.fillStyle = 'rgba(154,156,163,.30)';
    g.beginPath(); g.arc(X(p.x), Y(p.y), 2.1, 0, 6.2832); g.fill();
  });
  hits.forEach(function (p) {
    g.beginPath(); g.arc(X(p.x), Y(p.y), 4.4, 0, 6.2832);
    g.fillStyle = '#111113'; g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.stroke();
  });

  // axis labels + ticks
  g.font = '11px Inter,system-ui,sans-serif';
  g.fillStyle = '#9a9ca3'; g.textAlign = 'center';
  [-0.4, -0.2, 0, 0.2, 0.4].forEach(function (v) {
    g.fillText(v === 0 ? '0' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1), X(v), H - PAD.b + 16);
  });
  g.textAlign = 'right';
  [-0.4, -0.2, 0.2, 0.4].forEach(function (v) {
    g.fillText((v > 0 ? '+' : '−') + Math.abs(v).toFixed(1), PAD.l - 8, Y(v) + 4);
  });
  g.fillStyle = '#6a6d75';
  g.font = '12px Inter,system-ui,sans-serif';
  g.textAlign = 'center';
  var vb = C.view === 'ko' ? '  → knockout raises' : '  → gene promotes';
  g.fillText(C.X.meta.label + vb, (PAD.l + W - PAD.r) / 2, H - 14);
  g.save();
  g.translate(15, (PAD.t + H - PAD.b) / 2);
  g.rotate(-Math.PI / 2);
  g.fillText(C.Y.meta.label + vb, 0, 0);
  g.restore();

  overlay(hits, X, Y);
  $('#cmpcount').textContent = C.pts.length.toLocaleString() + ' genes on both axes';
  quadBar(counts);
};

function overlay(hits, X, Y) {
  var ov = $('#cmpov');
  ov.innerHTML = '';
  ov.setAttribute('viewBox', '0 0 ' + geom.W + ' ' + geom.H);
  hits.slice(0, 40).forEach(function (p) {
    var t = document.createElementNS(NS, 'text');
    t.setAttribute('x', X(p.x) + 7); t.setAttribute('y', Y(p.y) - 6);
    t.setAttribute('font-family', 'Inter,system-ui,sans-serif');
    t.setAttribute('font-size', '11.5'); t.setAttribute('font-weight', '600');
    t.setAttribute('fill', '#111113');
    t.textContent = p.g;
    ov.appendChild(t);
  });
}

function QNAME(q) {
  var up = C.view === 'ko' ? 'raises' : 'promotes', dn = C.view === 'ko' ? 'lowers' : 'restrains';
  var sh = function (s) { return s.length > 20 ? s.slice(0, 18) + '…' : s; };
  var x = sh(C.X.meta.label), y = sh(C.Y.meta.label);
  return { RT: up + ' ' + x + ', ' + up + ' ' + y,
           RB: up + ' ' + x + ', ' + dn + ' ' + y,
           LT: dn + ' ' + x + ', ' + up + ' ' + y,
           LB: dn + ' ' + x + ', ' + dn + ' ' + y }[q];
}

function quadBar(counts) {
  var box = $('#cmpq');
  box.innerHTML = '';
  var tabs = h('div', 'qtabs', box);
  var opts = [['all', 'All genes', C.pts.length]];
  ['RB', 'RT', 'LB', 'LT'].forEach(function (q) { opts.push([q, QNAME(q), counts[q]]); });
  opts.forEach(function (o) {
    var b = h('button', C.quad === o[0] ? 'on' : '', tabs, o[1] + ' (' + o[2].toLocaleString() + ')');
    b.type = 'button';
    b.onclick = function () { C.quad = o[0]; window.__cmpPaint(); };
  });
  var dl = h('button', 'dl', tabs, 'Download CSV');
  dl.type = 'button';
  dl.onclick = csv;
  table(box);
}

function rowsNow() {
  var t = C.thr;
  var r = C.pts.filter(function (p) {
    if (!window.__passN(p)) return false;
    return C.quad === 'all' ? true : quadOf(p, t) === C.quad;
  });
  r.sort(function (a, b) {
    return (Math.abs(b.x) + Math.abs(b.y)) - (Math.abs(a.x) + Math.abs(a.y));
  });
  return r;
}

function table(box) {
  var rows = rowsNow().slice(0, 60);
  if (!rows.length) {
    h('p', 'loading', box, 'Nothing passes these filters \u2014 try lowering the significance ' +
      'requirement or the threshold. Axes built from one or two assays cannot reach a high ' +
      'significance count.');
    return;
  }
  var wrap = h('div', '', box);
  wrap.style.overflowX = 'auto';
  wrap.style.marginTop = '14px';
  var tb = h('table', 'rows', wrap);
  var tr = h('tr', '', h('thead', '', tb));
  ['Gene', C.X.meta.label, C.Y.meta.label, 'Assays', 'Signif.'].forEach(function (c, i) {
    var th = h('th', '', tr, c);
    if (i) th.style.textAlign = 'right';
  });
  var body = h('tbody', '', tb);
  rows.forEach(function (p) {
    var r = h('tr', '', body);
    var td = h('td', '', r);
    var a = h('a', '', td, p.g);
    a.href = '#' + p.g;
    a.style.fontWeight = '600';
    a.style.textDecoration = 'none';
    a.onclick = function (e) { e.preventDefault(); $('#q').value = p.g; window.showGene(p.g); };
    [[p.x, 'x'], [p.y, 'y']].forEach(function (v) {
      var c = h('td', 'num', r, (v[0] > 0 ? '+' : '−') + Math.abs(v[0]).toFixed(3));
      c.style.color = v[0] > 0 ? 'var(--up)' : 'var(--dn)';
    });
    h('td', 'num', r, p.nx + ' / ' + p.ny);
    var sc = h('td', 'num', r, p.sx + ' / ' + p.sy);
    if (p.sx + p.sy === 0) sc.style.color = 'var(--ink-4)';
  });
  if (rowsNow().length > 60)
    h('p', 'tiny', box, 'Showing the 60 strongest of ' + rowsNow().length.toLocaleString() +
      ' — download the CSV for the full list.');
}

function csv() {
  var rows = rowsNow();
  var out = ['gene,' + JSON.stringify(C.X.meta.label) + ',' + JSON.stringify(C.Y.meta.label) +
             ',assays_x,assays_y,significant_x,significant_y'];
  rows.forEach(function (p) {
    out.push(p.g + ',' + p.x.toFixed(4) + ',' + p.y.toFixed(4) + ',' + p.nx + ',' + p.ny +
             ',' + p.sx + ',' + p.sy);
  });
  var blob = new Blob([out.join('\n')], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tcell-corpus-compare.csv';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}
})();

/* ── compare: hover + click ─────────────────────────────────── */
(function () {
'use strict';
var E = window.__E, $ = E.$, h = E.h, C = window.__C;
var tip = null;
function hide() { if (tip) { tip.remove(); tip = null; } }

document.addEventListener('mousemove', function (ev) {
  var cv = document.getElementById('cmpcv');
  if (!cv || !C.pts.length) return;
  var r = cv.getBoundingClientRect();
  if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) {
    hide(); return;
  }
  var p = nearest(ev.clientX - r.left, ev.clientY - r.top, r.width, r.height);
  if (!p) { hide(); return; }
  if (!tip) tip = h('div', 'tipbox', document.body);
  tip.innerHTML = '<b>' + p.g + '</b><br>' +
    '<span class="s">' + C.X.meta.label + '</span> ' + fmt(p.x) + ' <span class="s">(' + p.nx + ' assays)</span><br>' +
    '<span class="s">' + C.Y.meta.label + '</span> ' + fmt(p.y) + ' <span class="s">(' + p.ny + ' assays)</span>';
  var x = ev.clientX + 14, y = ev.clientY + 14;
  var b = tip.getBoundingClientRect();
  if (x + b.width > innerWidth - 10) x = ev.clientX - b.width - 14;
  if (y + b.height > innerHeight - 10) y = ev.clientY - b.height - 14;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}, { passive: true });

function fmt(v) { return (v > 0 ? '+' : '−') + Math.abs(v).toFixed(3); }

function nearest(px, py, w, hgt) {
  var PADl = 66, PADr = 18, PADt = 18, PADb = 52, lim = 0.5;
  var X = function (v) { return PADl + (v + lim) / (2 * lim) * (w - PADl - PADr); };
  var Y = function (v) { return PADt + (lim - v) / (2 * lim) * (hgt - PADt - PADb); };
  var best = null, bd = 100;
  for (var i = 0; i < C.pts.length; i++) {
    var p = C.pts[i];
    var dx = X(p.x) - px, dy = Y(p.y) - py, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = p; }
  }
  return bd <= 64 ? best : null;
}

document.addEventListener('click', function (ev) {
  var cv = document.getElementById('cmpcv');
  if (!cv || ev.target !== cv || !C.pts.length) return;
  var r = cv.getBoundingClientRect();
  var p = nearest(ev.clientX - r.left, ev.clientY - r.top, r.width, r.height);
  if (!p) return;
  hide();
  $('#q').value = p.g;
  window.showGene(p.g);
});
})();
