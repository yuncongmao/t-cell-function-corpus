#!/bin/sh
# Re-stamp JS references with a content hash so browsers pick up changes.
# Run after editing assets/explore.js or assets/figs.js, before committing.
python3 - <<'PY'
import hashlib, re
for page, asset in [('explore.html','assets/explore.js'), ('index.html','assets/figs.js')]:
    v = hashlib.sha1(open(asset,'rb').read()).hexdigest()[:8]
    h = open(page, encoding='utf-8').read()
    h = re.sub(r'(src=")'+re.escape(asset)+r'(\?v=[0-9a-f]+)?(")',
               lambda m: m.group(1)+asset+'?v='+v+m.group(3), h)
    open(page,'w',encoding='utf-8').write(h)
    print(f'{page} -> {asset}?v={v}')
PY
