# hentAI Image Gallery

> A simple, lightweight, responsive static image gallery, deployed via GitHub Pages.

This is a practice project for a static image gallery. No backend, no database — just plain HTML / CSS / JavaScript that runs anywhere GitHub Pages can serve it.

## Live Preview

```
https://r0b5k3f0.github.io/hentAI/
```

> Note: GitHub Pages deploys from the `gh-pages` branch. After a push it may take a few minutes to go live.

## Features

- 🖼️ **Responsive masonry grid** for phone, tablet, and desktop; image dimensions are known up front, so nothing jumps around while loading
- ⚡ **Automatic thumbnails**: the grid loads WebP thumbnails (about 1/4 of the original size overall); the full image is only fetched when you open the lightbox
- 🔍 **Keyword search** by title, tag, or filename — separate several keywords with spaces
- ↕️ **Multiple sort modes**: default (order in `meta.json`) / by filename A→Z / Z→A / shuffle
- 🔎 **Lightbox viewer** — click to enlarge, ← → to navigate, Esc to close, swipe on touch devices
- ♿ **Keyboard & assistive-tech friendly**: cards are focusable with Tab and open with Enter; the lightbox manages focus and has ARIA labels
- 🤖 **Self-maintaining**: drop images into `images/` and push — GitHub Actions generates the manifest and thumbnails
- 📦 **Zero front-end dependencies** — no framework, no bundler

## Project Structure

```
hentAI/
├── index.html                  # Home page (gallery UI)
├── assets/
│   ├── style.css               # Styles
│   └── gallery.js              # Interaction logic (manifest loading, search, sort, lightbox)
├── images/
│   ├── 01.jpg … 22.jpg         # Your images (includes test images)
│   ├── meta.json               # ✏️ Titles / tags — this is the file you edit
│   ├── manifest.json           # 🤖 Generated image list (do not edit)
│   └── thumbs/                 # 🤖 Generated WebP thumbnails (do not edit)
├── tools/
│   ├── generate_manifest.py    # Script that builds manifest.json and thumbnails
│   └── requirements.txt        # Script dependency (Pillow, only needed for thumbnails)
├── .github/workflows/
│   └── generate-manifest.yml   # Runs the script after image pushes and commits the result
├── .nojekyll                   # Tells GitHub Pages to skip Jekyll and serve files as-is
├── README.md                   # Traditional Chinese README
└── README_en.md                # This file
```

## How to Add Images

1. Drop your images into `images/` (jpg / jpeg / png / webp / gif / avif).
2. (Optional) Open `images/meta.json` and add a title and tags:

   ```json
   "your-image.jpg": { "title": "Image Title", "tags": "tag1 tag2" }
   ```

   - Images without an entry use their filename as the title (`my-photo.jpg` → `my photo`).
   - **The order of entries in `meta.json` is the gallery's "default" order** — just move lines around to rearrange. Images not listed are appended in natural filename order.
   - `tags` can be a space-separated string or an array.
3. Push to `gh-pages`. GitHub Actions generates `images/manifest.json` and `images/thumbs/`, commits them back, and Pages redeploys.

To generate locally (e.g. for an offline preview):

```bash
pip install -r tools/requirements.txt   # once; without Pillow the manifest still builds, just without thumbnails
python tools/generate_manifest.py
```

Flags: `--force` regenerates every thumbnail, `--no-thumbs` only updates the manifest.

> `manifest.json` and `thumbs/` are build outputs — don't edit them by hand; change titles/tags in `meta.json`.
> Thumbnail filenames include a hash of the source image, so replacing an image (even with the same filename) regenerates its thumbnail and removes the stale one.

## Local Preview

Serve the folder with a local server — don't double-click `index.html`:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

> Why? Browsers block `fetch()` under `file://`, so the page can't read `manifest.json` and falls back to the slow probe-every-filename mode.

## Deploy to GitHub Pages

This project's content lives on the `gh-pages` branch:

```bash
git checkout -b gh-pages
git add .
git commit -m "deploy gallery"
git push origin gh-pages
```

Then in the repo go to **Settings → Pages**, set Source to `gh-pages` / `root`, and you're done.

### About the automation workflow

- It runs when anything under `images/**` or `tools/**` changes, and can also be started manually from **Actions → Generate Gallery Manifest → Run workflow** (recommended once after setup to confirm permissions).
- It commits with the built-in `GITHUB_TOKEN` and needs `contents: write` (already declared in the workflow file).
- Commits made by the bot do not re-trigger the workflow, so there is no loop; the Pages deployment still happens as usual.

## License

For practice purposes only. Test images are AI-generated and can be freely replaced.
