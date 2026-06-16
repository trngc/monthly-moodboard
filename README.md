# MoodAlbum

A single-page web app — a year-in-photos album organised by month, themed by the
mood of the photos you add. No backend, no API key, all client-side.

- Drag-and-drop (or tap) photos into any month
- The app samples each photo on a canvas, extracts a dominant colour palette,
  and derives a mood for that month (Golden / Moody / Cool / Soft / Vivid /
  Verdant / Ember / Nocturne / Glacial / Hushed / Dreamy)
- Each month becomes a full-bleed editorial chapter — gradient built from its
  own colours, font pairing chosen for its mood, scroll reveals, parallax hero,
  page-flip feel between chapters
- Empty months are skipped

## Run

It's static — open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

No build step, no dependencies. Fonts load from Google Fonts.

## Files

- `index.html` — intro screen + album mount
- `styles.css` — editorial system (typography, month picker, chapter layout)
- `app.js` — uploads, canvas colour analysis, mood detection, chapter render,
  scroll-reveal + parallax + page-flip transitions
