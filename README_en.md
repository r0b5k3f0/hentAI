# hentAI Image Gallery

> A simple, lightweight, responsive static image gallery, deployed via GitHub Pages.

This is a practice project for a static image gallery. No backend, no database — just plain HTML / CSS / JavaScript that runs anywhere GitHub Pages can serve it.

## Live Preview

```
https://r0b5k3f0.github.io/hentAI/
```

> Note: GitHub Pages deploys from the `gh-pages` branch. After the first push it may take a few minutes to go live.

## Features

- 🖼️ **Responsive grid** that adapts to phone, tablet, and desktop
- 🔍 **Keyword search** by title, tag, or filename
- ↕️ **Multiple sort modes**: default / by filename / shuffle
- 🔎 **Lightbox viewer** — click to enlarge, ESC to close
- ⚡ **Zero dependencies** — no packages, no build step

## Project Structure

```
hentAI/
├── index.html          # Home page (gallery UI)
├── assets/
│   ├── style.css       # Styles
│   └── gallery.js      # Image list and interaction logic
├── images/             # Your images (includes test images)
├── README.md           # This file in Traditional Chinese
└── README_en.md        # English version
```

## How to Add Images

1. Drop your images into the `images/` folder (`.jpg` / `.png` recommended, ideally under 1MB).
2. Open `assets/gallery.js` and add an entry to the `IMAGES` array:

   ```js
   { src: "images/your-image.jpg", title: "Image Title", tags: "tag1 tag2" }
   ```

3. Push — the gallery picks it up automatically.

## Local Preview

Just open `index.html` in a browser, or run a simple local server:

```bash
# Python 3
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to GitHub Pages

This project's content lives on the `gh-pages` branch:

```bash
git checkout -b gh-pages
git add .
git commit -m "deploy gallery"
git push origin gh-pages
```

Then in the repo go to **Settings → Pages**, set Source to `gh-pages` / `root`, and you're done.

## License

For practice purposes only. Test images are AI-generated and can be freely replaced.
