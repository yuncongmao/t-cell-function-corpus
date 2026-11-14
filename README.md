# T Cell Function Corpus — project website

Source for <https://yuncongmao.github.io/t-cell-function-corpus/>.

Static site, no build step: `index.html` plus `static/images/`. GitHub Pages serves it directly.

## Deploy

```bash
git init
git add .
git commit -m "Project website"
git branch -M main
git remote add origin https://github.com/yuncongmao/t-cell-function-corpus.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.**
The site goes live at `https://yuncongmao.github.io/t-cell-function-corpus/` within a minute or two.

`.nojekyll` is included so Pages serves every file as-is (Jekyll otherwise ignores paths starting with `_`).

## Before going public — fill in the placeholders

In `index.html`, replace:

| Placeholder | Where | Replace with |
|---|---|---|
| `PAPER_URL` | nav, hero button (2 places) | bioRxiv / journal link |
| `DATA_URL` | Data & code card | Zenodo / HuggingFace / Figshare link |
| `SCHEMA_URL` | Data & code card | link to the schema in the code repo |
| `https://github.com/yuncongmao` | nav, hero, data card | the actual code repo URL |
| `href="#"` on author names | hero author list | each author's homepage |

Figures are exported from the manuscript at 1600 px wide. To update one, drop a new PNG over
`static/images/figN.png` and push.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
