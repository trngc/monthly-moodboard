# AGENTS.md

## Cursor Cloud specific instructions

MoodAlbum is a static, dependency-free single-page web app (plain HTML/CSS/JS, no
build step, no package manager, no backend). Source files: `index.html`,
`styles.css`, `app.js`, plus seed images in `placeholders/`.

### Running it
Serve the folder over HTTP and visit the port (see `README.md`):

```bash
python3 -m http.server 4000
# then open http://localhost:4000
```

Notes:
- Serve over HTTP rather than opening `index.html` via `file://`. At startup the app
  `fetch()`es the images in `placeholders/`, which fails under `file://`.
- The 12 months are auto-seeded with placeholder photos on load, so the "Compose"
  button is enabled immediately — no upload is needed to exercise the full
  landing → calendar flow end to end.
- Two external CDNs are used but are non-blocking: Google Fonts (falls back to
  system fonts) and `html2canvas` from jsDelivr (only needed for the "Save PNG"
  export). The core app works without network access to either.

### Lint / test / build
There is no lint, test, or build tooling in this repo — it is plain static files.
