"""Audit the shipped Compare data: structural integrity + literature sanity checks.

Runs against site/data/cmp/*.json (the deployed artifacts), not the database,
so it catches export bugs as well as biology problems.
"""
import json, os, sys, math

SITE = '/home/claude/work/site'
CMP = SITE + '/data/cmp'

genes = [g[0] for g in json.load(open(SITE + '/data/genes.json'))['genes']]
gi = {g: i for i, g in enumerate(genes)}
axes = json.load(open(CMP + '/axes.json'))['axes']

# ── control sets, with the sign the GENE-ROLE score should take on a
#    "more is better for T cell fitness" axis (promotes = +)
RIBO = [g for g in genes if (g.startswith('RPL') or g.startswith('RPS')) and g[3:4].isdigit()]
CORE_ESSENTIAL = ['POLR2A', 'POLR2B', 'PCNA', 'RAN', 'RRM1', 'SNRPD1', 'EIF4A3',
                  'PSMA1', 'PSMB2', 'COPS6', 'CDK9', 'RPA1']
TCR_REQUIRED = ['CD3D', 'CD3E', 'CD3G', 'LCK', 'ZAP70', 'LAT', 'LCP2', 'CD28', 'PLCG1']
IL2_REQUIRED = ['IL2RA', 'IL2RB', 'IL2RG', 'JAK1', 'JAK3', 'STAT5B']
BRAKES = ['CBLB', 'SOCS1', 'CISH', 'TNFAIP3', 'RASA2', 'TCEB2', 'ZC3H12A',
          'DGKA', 'DGKZ', 'UBASH3A', 'CD5', 'PTPN2', 'SOCS3', 'TMEM222']

FITNESS_WORDS = ('prolifer', 'persist', 'expansion', 'fitness', 'abundance',
                 'infiltrat', 'accumulation', 'viability', 'survival')

def load(aid):
    d = json.load(open(f'{CMP}/{aid}.json'))
    return d

def mean_rank(d, names):
    pos = {d['idx'][i]: d['v'][i] for i in range(len(d['idx']))}
    vals = [pos[gi[g]] for g in names if g in gi and gi[g] in pos]
    return (sum(vals) / len(vals), len(vals)) if vals else (None, 0)

problems, notes = [], []

# ── 1. structural checks ──────────────────────────────────────────────
print('=' * 72)
print('1. STRUCTURE')
files = {f[:-5] for f in os.listdir(CMP) if f.endswith('.json')} - {'axes'}
listed = {a['id'] for a in axes}
if files - listed:
    problems.append(f'files on disk not listed in axes.json: {sorted(files - listed)[:3]}')
if listed - files:
    problems.append(f'axes.json lists missing files: {sorted(listed - files)[:3]}')
print(f'   {len(listed)} axes listed, {len(files)} files on disk  '
      f'{"OK" if files == listed else "MISMATCH"}')

bad = 0
for a in axes:
    d = load(a['id'])
    n = len(d['idx'])
    if not (len(d['v']) == len(d['n']) == len(d.get('s', d['n'])) == n):
        problems.append(f"{a['id']}: array lengths differ"); bad += 1
    if n != a['genes']:
        problems.append(f"{a['id']}: axes.json says {a['genes']} genes, file has {n}"); bad += 1
    if d['idx'] != sorted(d['idx']):
        problems.append(f"{a['id']}: gene indices not sorted"); bad += 1
    if max(d['idx']) >= len(genes) or min(d['idx']) < 0:
        problems.append(f"{a['id']}: gene index out of range"); bad += 1
    if any(v is None or math.isnan(v) for v in d['v']):
        problems.append(f"{a['id']}: NaN/None score"); bad += 1
    lo, hi = min(d['v']), max(d['v'])
    if not (-0.51 <= lo <= -0.40 and 0.40 <= hi <= 0.51):
        problems.append(f"{a['id']}: rank range {lo:.3f}..{hi:.3f}, expected about -0.5..+0.5"); bad += 1
    mean = sum(d['v']) / n
    if abs(mean) > 0.02:
        problems.append(f"{a['id']}: mean rank {mean:+.3f}, expected about 0"); bad += 1
    if a['nsig'] != sum(1 for x in d.get('s', []) if x > 0):
        problems.append(f"{a['id']}: nsig disagrees with file"); bad += 1
print(f'   per-axis integrity: {len(axes) - min(bad, len(axes))}/{len(axes)} clean')

# ── 2. biology on fitness-like axes ───────────────────────────────────
print()
print('=' * 72)
print('2. BIOLOGY  (gene-role convention: + = gene promotes the phenotype)')
print('   expect essentials/TCR/IL-2 machinery POSITIVE, brakes NEGATIVE')
print()
fit = [a for a in axes if any(w in a['label'].lower() for w in FITNESS_WORDS)
       and a['mode'] in ('CRISPRn', 'CRISPRi')]
print(f'   {len(fit)} loss-of-function fitness-like axes\n')
hdr = f"   {'axis':38s} {'ribo':>7s} {'ess':>7s} {'TCR':>7s} {'IL2':>7s} {'brake':>7s}  verdict"
print(hdr)
for a in sorted(fit, key=lambda x: -x['assays']):
    d = load(a['id'])
    r = {k: mean_rank(d, v)[0] for k, v in
         [('ribo', RIBO), ('ess', CORE_ESSENTIAL), ('tcr', TCR_REQUIRED),
          ('il2', IL2_REQUIRED), ('brake', BRAKES)]}
    f = lambda v: '   n/a' if v is None else f'{v:+.3f}'
    pos = [r['ribo'], r['ess'], r['tcr']]
    ok_pos = [v for v in pos if v is not None]
    verdict = 'ok'
    if ok_pos and sum(ok_pos) / len(ok_pos) < -0.02:
        verdict = 'INVERTED?'
        problems.append(f"{a['id']}: required genes score negative (sign may be flipped)")
    elif r['brake'] is not None and r['brake'] > 0.05:
        verdict = 'brakes positive?'
        notes.append(f"{a['id']}: brake genes score positive ({r['brake']:+.3f})")
    lab = (a['label'][:30] + ' [' + str(a['assays']) + ']')
    print(f"   {lab:38s} {f(r['ribo']):>7s} {f(r['ess']):>7s} {f(r['tcr']):>7s} "
          f"{f(r['il2']):>7s} {f(r['brake']):>7s}  {verdict}")

print()
print('=' * 72)
print(f'PROBLEMS: {len(problems)}')
for p in problems[:14]:
    print('   !', p)
print(f'NOTES: {len(notes)}')
for n in notes[:10]:
    print('   -', n)
