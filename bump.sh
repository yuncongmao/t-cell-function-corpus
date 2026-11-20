#!/bin/sh
# Stamp a build id into the JS and the pages that load it, so a browser can never
# end up running new HTML against stale JS. Run after editing any JS, before commit.
python3 - <<'PY'
import re, time
build = str(int(time.time()))
pairs = [('explore.html', 'assets/explore.js'), ('index.html', 'assets/figs.js')]
for page, asset in pairs:
    js = open(asset, encoding='utf-8').read()
    js = re.sub(r'^/\*build\*/.*\n', '', js)
    open(asset, 'w', encoding='utf-8').write(
        "/*build*/window.__BUILD_" + asset.split('/')[-1].split('.')[0].upper() +
        " = '" + build + "';\n" + js)
    h = open(page, encoding='utf-8').read()
    h = re.sub(r'(src=")' + re.escape(asset) + r'(\?v=[0-9a-f]+)?(")',
               lambda m: m.group(1) + asset + '?v=' + build + m.group(3), h)
    h = re.sub(r"(__EXPECTED_BUILD__\s*=\s*')[^']*(')", r"\g<1>" + build + r"\2", h)
    open(page, 'w', encoding='utf-8').write(h)
    print(page, '->', asset + '?v=' + build)
PY
