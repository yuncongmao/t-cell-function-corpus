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
  var tg = $('#tab-gene'), ta = $('#tab-assay');
  tg.onclick = function () {
    tg.classList.add('on'); ta.classList.remove('on');
    $('#panel-gene').classList.remove('hide'); $('#panel-assay').classList.add('hide');
  };
  ta.onclick = function () {
    ta.classList.add('on'); tg.classList.remove('on');
    $('#panel-assay').classList.remove('hide'); $('#panel-gene').classList.add('hide');
  };
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
