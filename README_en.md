# hentAI Image Gallery

> A lightweight, responsive static image gallery hosted on GitHub Pages.

No backend, database, or frontend build step. The website runs on plain HTML, CSS, and JavaScript. Node.js packages are only used for development tests.

## Live Preview

https://r0b5k3f0.github.io/hentAI/

## Features

- **Responsive masonry layout** with lazy-loaded, asynchronously decoded images
- **Keyword search** by title, tags, or filename, reusing existing cards
- **Sorting** by default order, natural filename order, or shuffle; filtering preserves the shuffled order
- **Accessible lightbox**: click or Tab to a picture and press Enter/Space; Escape closes it and restores focus
- **Clear states** for loading, empty galleries, no matches, broken images, and manifest retries
- **Safe rendering**: metadata is displayed as text; image paths are restricted to files inside `images/`

Requires a modern browser supporting JavaScript modules, `fetch`, and native `<dialog>`.

## Project Structure

```text
hentAI/
├── .github/workflows/
│   ├── generate-manifest.yml # Automatic manifest updates
│   └── tests.yml             # Unit and browser tests
├── index.html
├── assets/
│   ├── style.css
│   ├── gallery.js           # UI, events, loading, and lightbox
│   └── gallery-data.mjs     # Manifest validation, search, and sorting
├── images/
│   ├── manifest.json       # Generated image list
│   └── ...                 # Original images
├── tools/generate_manifest.py
├── tests/                  # Node, Python, and Playwright tests
├── package.json             # Development-only dependencies and scripts
├── package-lock.json
├── playwright.config.mjs
├── README.md
└── README_en.md
```

## Adding or Removing Images

1. Add or remove files directly inside `images/`. Supported extensions are `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, and `.avif` (case-insensitive). Aim for less than 1 MB per image.
2. For custom titles and tags, add metadata to `KNOWN_META` in `tools/generate_manifest.py`, keyed by the complete filename:

   ```python
   "my-image.jpg": {"title": "Image Title", "tags": "tag1 tag2"},
   ```

   Otherwise, the filename without its final extension becomes the title. No frontend JavaScript edits are needed.
3. Run from the project root:

   ```bash
   python3 tools/generate_manifest.py
   ```

4. Commit and deploy the images, metadata changes, and `images/manifest.json` together. Do not edit the generated manifest directly; regeneration overwrites it.

The generator URL-encodes spaces, Unicode, `#`, `?`, and other special characters. Subdirectories and symlinks are ignored. An empty manifest displays an empty gallery instead of probing guessed filenames.

The existing `Generate Gallery Manifest` workflow also updates the manifest after image or generator changes on `gh-pages`, `main`, and `master`. However, commits pushed using `GITHUB_TOKEN` do not trigger another branch-based Pages build. Generate the manifest before committing so that the same deployment includes the correct list.

## Local Preview

Use an HTTP server. Opening `index.html` directly via `file://` is not supported because of browser module and fetch restrictions.

```bash
python3 -m http.server 8000 --bind 0.0.0.0
# Visit http://localhost:8000
```

Manifest requests revalidate the cache; image requests use normal browser caching. A manifest timeout (10 seconds), HTTP failure, or invalid data displays an error and retry button instead of issuing hundreds of image probes.

## Tests

Data and generator tests require Node.js 20+ and Python 3.11+, with no package installation:

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -v
python3 tools/generate_manifest.py --check
```

Browser interaction tests use Playwright as a development-only dependency:

```bash
npm ci
npx playwright install chromium
npm run test:browser
```

Tests start an HTTP server automatically or reuse one already running on port 8000. On Linux, use `npx playwright install --with-deps chromium` if system libraries are missing. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium installation.

The included `Tests` workflow (`.github/workflows/tests.yml`) runs the generator, unit tests, and Chromium interaction tests on pushes and pull requests. A push to a branch with an open PR triggers both events, so two test runs are expected.

CI regenerates the manifest but does not commit the result. Run `python3 tools/generate_manifest.py --check` locally before committing to ensure the deployed manifest is up to date. Deploying the site does not require `node_modules` or a build step.

## GitHub Pages Deployment

In **Settings → Pages**, choose **Deploy from a branch**, with `gh-pages` / `root` as the source. After PR tests pass, merge into the deployment branch and confirm that **pages build and deployment** succeeds in **Actions**. Passing `Tests` verifies the code; it does not mean the site has finished deploying.

## License

For practice purposes only. Test images are AI-generated and can be freely replaced.
