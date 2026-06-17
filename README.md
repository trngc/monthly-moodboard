# MoodAlbum

A single-page web app that turns a year of photos into a private, editorial
lookbook — organized by month, themed entirely by the colors and light of the
photographs you drop in. Everything runs on your device. No backend, no
accounts, no API keys.

## Running it

It is plain HTML, CSS, and JavaScript with no build step. Open `index.html`
directly in a modern browser, or serve the folder over HTTP for the cleanest
behaviour:

```bash
python3 -m http.server 4000
# then visit http://localhost:4000
```

## How it works

1. **Upload.** Drag and drop photos anywhere on the intro screen, or tap a
   month row to add files to that month. Files are auto-binned by their
   `lastModified` date when you use the global drop area; tapping a month
   forces them into that month.
2. **Analyze.** When you tap *Compose the album*, every image is drawn to a
   small offscreen canvas. Each photo's pixels are sampled to compute average
   warmth (a circular score around hue 30°), lightness, saturation, and a
   quantized dominant palette (top buckets in a 32³ RGB cube).
3. **Mood.** Each month's photos are aggregated and matched (by squared
   distance in warmth/sat/light) against eight mood archetypes —
   *Warm / Golden*, *Moody / Editorial*, *Cool / Minimal*, *Soft / Dreamy*,
   *Bold / Vivid*, *Earthy / Natural*, *Crisp / Bright*, *Twilight / Smoke* —
   each with its own font pairing.
4. **Compose.** A full-bleed chapter is generated per month with a background
   gradient built from that month's own palette, the matching serif-and-sans
   pairing, the detected mood as a subtitle under the month name, a hero
   photo, a varied magazine grid, scroll-reveal, parallax, and a soft fade
   between chapters.

## Files

- `index.html` — markup, font loading, intro and album scaffolds
- `styles.css` — editorial system: paper palette, serif headlines, generous
  whitespace, mobile-first layout
- `app.js` — state, drag/drop, canvas analysis, mood derivation, theme
  generation, chapter rendering, scroll effects
