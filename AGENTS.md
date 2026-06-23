# AGENTS.md

## Cursor Cloud specific instructions

MoodAlbum is a fully static, client-side single-page web app (vanilla HTML/CSS/JS). There is **no package manager, build step, lint config, test suite, or backend**.

### Running the app
Serve the repo root over HTTP (serving is required so the app's `fetch()` of `placeholders/*.jpg` works; `file://` is blocked by CORS):

```bash
python3 -m http.server 4000
# visit http://localhost:4000
```

Any port works; the app has no hardcoded port dependency.

### Non-obvious caveats
- On load, the app preloads seeded sample images from `placeholders/` via `fetch()`, so it must be served over HTTP, not opened from disk.
- Google Fonts and `html2canvas` (the "Save PNG" export) load from CDNs at runtime. The core album flow works offline with fallback fonts; only typography polish and PNG export need internet.
- There is nothing to install, lint, test, or build. The "dev" and "prod" modes are identical — just the static server.
