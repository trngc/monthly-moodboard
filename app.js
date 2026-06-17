/* =============================================================
   MoodAlbum — client-only single page app
   ============================================================= */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* ---------- State ---------- */

const state = {
  // 12 entries, one per month; each: { name, photos: [{id,file,url,analysis}] }
  months: MONTHS.map((name) => ({ name, photos: [] })),
};

let nextPhotoId = 1;

/* ---------- DOM ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const introEl = $("#intro");
const albumEl = $("#album");
const monthList = $("#monthList");
const globalDrop = $("#globalDrop");
const globalInput = $("#globalInput");
const composeBtn = $("#composeBtn");
const counterPhotos = $("#counterPhotos");
const counterMonths = $("#counterMonths");
const backBtn = $("#backBtn");
const albumCover = $("#albumCover");
const albumChapters = $("#albumChapters");
const albumProgressFill = $("#albumProgressFill");

/* =============================================================
   Intro: render month rows
   ============================================================= */

function renderMonths() {
  monthList.innerHTML = "";
  state.months.forEach((m, idx) => {
    const li = document.createElement("li");
    li.className = "month";
    li.dataset.month = idx;

    li.innerHTML = `
      <div class="month__head">
        <span class="month__num">${String(idx + 1).padStart(2, "0")}</span>
        <h3 class="month__name">${m.name}</h3>
        <span class="month__count">${m.photos.length ? `${m.photos.length} photo${m.photos.length === 1 ? "" : "s"}` : "—"}</span>
      </div>
      <div class="month__actions">
        <button class="btn btn--mini" type="button" data-add="${idx}">Add photos</button>
      </div>
      <div class="month__strip" data-strip="${idx}"></div>
      <input type="file" accept="image/*" multiple hidden data-input="${idx}" />
    `;
    monthList.appendChild(li);

    const strip = li.querySelector(`[data-strip="${idx}"]`);
    m.photos.forEach((p) => strip.appendChild(makeThumb(p, idx)));

    const input = li.querySelector(`[data-input="${idx}"]`);
    li.querySelector(`[data-add="${idx}"]`).addEventListener("click", () => input.click());
    input.addEventListener("change", (e) => {
      handleFiles([...e.target.files], idx);
      input.value = "";
    });

    // Drop handlers per month row
    li.addEventListener("dragenter", (e) => { e.preventDefault(); li.classList.add("is-drag"); });
    li.addEventListener("dragover", (e) => { e.preventDefault(); });
    li.addEventListener("dragleave", (e) => {
      if (!li.contains(e.relatedTarget)) li.classList.remove("is-drag");
    });
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      li.classList.remove("is-drag");
      const files = [...(e.dataTransfer?.files || [])].filter(isImage);
      if (files.length) handleFiles(files, idx);
    });
  });
  refreshCounters();
}

function makeThumb(photo, monthIdx) {
  const t = document.createElement("div");
  t.className = "thumb";
  t.innerHTML = `
    <img src="${photo.url}" alt="" />
    <button type="button" class="thumb__x" aria-label="Remove">&times;</button>
  `;
  t.querySelector(".thumb__x").addEventListener("click", () => {
    state.months[monthIdx].photos = state.months[monthIdx].photos.filter((p) => p.id !== photo.id);
    URL.revokeObjectURL(photo.url);
    renderMonths();
  });
  return t;
}

function refreshCounters() {
  const nPhotos = state.months.reduce((s, m) => s + m.photos.length, 0);
  const nMonths = state.months.filter((m) => m.photos.length > 0).length;
  counterPhotos.textContent = nPhotos;
  counterMonths.textContent = nMonths;
  composeBtn.disabled = nMonths === 0;
}

/* =============================================================
   File handling
   ============================================================= */

function isImage(f) { return f && f.type && f.type.startsWith("image/"); }

function handleFiles(files, monthIdx /* nullable */) {
  files = files.filter(isImage);
  if (!files.length) return;

  files.forEach((file) => {
    const target = monthIdx == null ? guessMonthFromFile(file) : monthIdx;
    const url = URL.createObjectURL(file);
    state.months[target].photos.push({
      id: nextPhotoId++,
      file,
      url,
      analysis: null,
    });
  });
  renderMonths();
}

function guessMonthFromFile(file) {
  // Try lastModified date; fall back to first non-empty month, else January
  const d = file.lastModified ? new Date(file.lastModified) : null;
  if (d && !isNaN(d)) return d.getMonth();
  const firstWith = state.months.findIndex((m) => m.photos.length > 0);
  return firstWith === -1 ? 0 : firstWith;
}

/* ---- global drop ---- */

["dragenter", "dragover"].forEach((ev) =>
  globalDrop.addEventListener(ev, (e) => {
    e.preventDefault();
    globalDrop.classList.add("is-drag");
  })
);
["dragleave", "drop"].forEach((ev) =>
  globalDrop.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === "dragleave" && globalDrop.contains(e.relatedTarget)) return;
    globalDrop.classList.remove("is-drag");
  })
);
globalDrop.addEventListener("drop", (e) => {
  const files = [...(e.dataTransfer?.files || [])];
  if (files.length) handleFiles(files, null);
});
globalDrop.addEventListener("click", () => globalInput.click());
globalDrop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); globalInput.click(); }
});
globalInput.addEventListener("change", (e) => {
  handleFiles([...e.target.files], null);
  globalInput.value = "";
});

// Prevent the browser from opening dropped files when missed
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

/* =============================================================
   Image analysis — canvas, palette, warmth/light/saturation
   ============================================================= */

const workCanvas = document.getElementById("workCanvas");
const SAMPLE_SIZE = 80;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function analyzePhoto(photo) {
  const img = await loadImage(photo.url);
  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  workCanvas.width = SAMPLE_SIZE;
  workCanvas.height = SAMPLE_SIZE;
  ctx.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  let sumR = 0, sumG = 0, sumB = 0;
  let sumS = 0, sumL = 0;
  let sumWarmCos = 0, sumWarmSin = 0; // for circular warm score
  const buckets = new Map(); // 5-bit-per-channel = 32^3 keys; we'll compress
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 200) continue;
    sumR += r; sumG += g; sumB += b;

    const { h, s, l } = rgbToHsl(r, g, b);
    sumS += s;
    sumL += l;

    // Warm score: hue around 30° (orange) is most warm, 210° (cyan) is coldest.
    // Use circular component: warm = cos(hue - 30°)
    const rad = ((h - 30) * Math.PI) / 180;
    sumWarmCos += Math.cos(rad);
    sumWarmSin += Math.sin(rad);

    // Quantize to a coarser cube for palette extraction
    const key =
      ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5); // 32^3 = 32768 buckets
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
    count += 1;
  }

  if (count === 0) {
    return { palette: ["#888"], warm: 0.5, light: 0.5, sat: 0.5, avgRGB: [128,128,128] };
  }

  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;
  const sat = sumS / count;
  const light = sumL / count;
  const warmRaw = sumWarmCos / count; // -1..1
  const warm = (warmRaw + 1) / 2;     // 0..1

  // Top palette buckets
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const palette = [];
  for (const b of sorted) {
    if (palette.length >= 5) break;
    const r = Math.round(b.r / b.n);
    const g = Math.round(b.g / b.n);
    const bl = Math.round(b.b / b.n);
    const hex = rgbToHex(r, g, bl);
    if (!palette.some((p) => colorDistance(p, [r,g,bl]) < 28)) {
      palette.push([r, g, bl]);
    }
  }
  while (palette.length < 3) palette.push([Math.round(avgR), Math.round(avgG), Math.round(avgB)]);

  return {
    palette,
    paletteHex: palette.map(([r,g,b]) => rgbToHex(r,g,b)),
    avgRGB: [avgR, avgG, avgB],
    warm,
    light,
    sat,
  };
}

function colorDistance(a, b) {
  const dr = a[0]-b[0], dg = a[1]-b[1], db = a[2]-b[2];
  return Math.sqrt(dr*dr + dg*dg + db*db);
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v|0)).toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s; const l = (max + min) / 2;
  if (max === min) { h = 0; s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      default: h = ((r - g) / d + 4);
    }
    h *= 60;
  }
  return { h, s, l };
}

function hexToRgb(hex) {
  const m = hex.replace("#", "");
  const n = parseInt(m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relLuminance([r,g,b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/* =============================================================
   Mood + theme derivation
   ============================================================= */

// Mood archetypes: (warm, sat, light) targets + identity
const MOOD_ARCHETYPES = [
  {
    id: "warm-golden", label: "Warm / Golden",
    target: [0.82, 0.55, 0.55],
    quote: "Sunlight running through everything.",
    pairing: { serif: "'Playfair Display', serif", sans: "'Inter', sans-serif" },
  },
  {
    id: "moody-editorial", label: "Moody / Editorial",
    target: [0.40, 0.42, 0.22],
    quote: "Half-light, long shadows, a quieter pulse.",
    pairing: { serif: "'Cormorant Garamond', serif", sans: "'DM Sans', sans-serif" },
  },
  {
    id: "cool-minimal", label: "Cool / Minimal",
    target: [0.22, 0.22, 0.72],
    quote: "Clean air. Clear lines. The page mostly empty.",
    pairing: { serif: "'DM Serif Display', serif", sans: "'Space Grotesk', sans-serif" },
  },
  {
    id: "soft-dreamy", label: "Soft / Dreamy",
    target: [0.58, 0.30, 0.78],
    quote: "Soft like a film washed twice.",
    pairing: { serif: "'Italiana', serif", sans: "'Manrope', sans-serif" },
  },
  {
    id: "bold-vivid", label: "Bold / Vivid",
    target: [0.55, 0.85, 0.55],
    quote: "All the saturation turned up at once.",
    pairing: { serif: "'Bodoni Moda', serif", sans: "'Inter', sans-serif" },
  },
  {
    id: "earthy-natural", label: "Earthy / Natural",
    target: [0.68, 0.42, 0.42],
    quote: "Stone, linen, a slow afternoon.",
    pairing: { serif: "'Fraunces', serif", sans: "'Work Sans', sans-serif" },
  },
  {
    id: "crisp-bright", label: "Crisp / Bright",
    target: [0.45, 0.55, 0.86],
    quote: "Cold morning, sharp edges, white light.",
    pairing: { serif: "'Libre Caslon Display', serif", sans: "'Inter', sans-serif" },
  },
  {
    id: "twilight-smoke", label: "Twilight / Smoke",
    target: [0.40, 0.30, 0.30],
    quote: "Between day and night, with a little ash.",
    pairing: { serif: "'EB Garamond', serif", sans: "'Archivo', sans-serif" },
  },
];

function pickMood({ warm, sat, light }) {
  let best = MOOD_ARCHETYPES[0];
  let bestD = Infinity;
  for (const m of MOOD_ARCHETYPES) {
    const [tw, ts, tl] = m.target;
    // weight light a bit higher — it's the most felt dimension
    const d =
      Math.pow(warm - tw, 2) * 1.0 +
      Math.pow(sat  - ts, 2) * 1.0 +
      Math.pow(light - tl, 2) * 1.2;
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

function aggregateMonth(photos) {
  let warm = 0, sat = 0, light = 0;
  const allBuckets = new Map(); // weighted palette across photos
  for (const p of photos) {
    const a = p.analysis;
    warm += a.warm; sat += a.sat; light += a.light;
    a.palette.forEach((rgb, i) => {
      const key = (rgb[0] >> 5) * 1024 + (rgb[1] >> 5) * 32 + (rgb[2] >> 5);
      const weight = (5 - i);
      const cur = allBuckets.get(key) || { r:0, g:0, b:0, w:0 };
      cur.r += rgb[0] * weight;
      cur.g += rgb[1] * weight;
      cur.b += rgb[2] * weight;
      cur.w += weight;
      allBuckets.set(key, cur);
    });
  }
  const n = photos.length;
  warm /= n; sat /= n; light /= n;
  const palette = [...allBuckets.values()]
    .sort((a, b) => b.w - a.w)
    .slice(0, 6)
    .map((c) => [Math.round(c.r/c.w), Math.round(c.g/c.w), Math.round(c.b/c.w)]);

  // Deduplicate near-identicals
  const uniq = [];
  for (const c of palette) {
    if (!uniq.some((u) => colorDistance(u, c) < 26)) uniq.push(c);
  }
  while (uniq.length < 4) uniq.push(uniq[uniq.length - 1] || [180,170,160]);

  return { warm, sat, light, palette: uniq };
}

function buildTheme(agg, mood) {
  const palette = agg.palette;
  // Choose paper tint vs ink tint based on overall lightness
  const isDark = agg.light < 0.42;
  // Build a soft background tint from the dominant color, biased toward paper
  const dom = palette[0];
  const accent = palette[1] || palette[0];
  const accent2 = palette[2] || palette[0];

  const bg = isDark
    ? mixHex(rgbToHex(...dom), "#0d0b0a", 0.45)
    : mixHex(rgbToHex(...dom), "#f6f3ee", 0.78);

  const fg = isDark ? "#f4efe7" : "#14110f";
  const fgMute = isDark ? "rgba(244,239,231,0.66)" : "rgba(20,17,15,0.62)";

  // Diagonal gradient using two palette colors at low alpha
  const grad = `
    linear-gradient(135deg,
      ${rgbaFromRGB(palette[0], isDark ? 0.55 : 0.28)} 0%,
      ${rgbaFromRGB(palette[1] || palette[0], isDark ? 0.35 : 0.18)} 45%,
      ${rgbaFromRGB(palette[2] || palette[0], isDark ? 0.55 : 0.10)} 100%)
  `;

  return {
    bg, fg, fgMute,
    grad,
    accent: rgbToHex(...accent),
    accent2: rgbToHex(...accent2),
    serif: mood.pairing.serif,
    sans: mood.pairing.sans,
    isDark,
  };
}

function rgbaFromRGB([r,g,b], a) {
  return `rgba(${r|0}, ${g|0}, ${b|0}, ${a})`;
}

function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const m = a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
  return rgbToHex(...m);
}

/* =============================================================
   Compose album
   ============================================================= */

composeBtn.addEventListener("click", composeAlbum);
backBtn.addEventListener("click", () => {
  albumEl.hidden = true;
  introEl.hidden = false;
  window.scrollTo({ top: 0, behavior: "instant" });
  revealIO?.disconnect();
  window.removeEventListener("scroll", onScroll);
  parallaxNodes = [];
  albumChapters.innerHTML = "";
  albumCover.innerHTML = "";
  albumCover.style.backgroundImage = "";
});

async function composeAlbum() {
  const filled = state.months.filter((m) => m.photos.length > 0);
  if (filled.length === 0) return;

  composeBtn.disabled = true;
  composeBtn.querySelector(".btn__arrow").textContent = "…";

  // Analyze every photo that hasn't been analyzed yet
  for (const month of filled) {
    for (const p of month.photos) {
      if (!p.analysis) {
        try { p.analysis = await analyzePhoto(p); }
        catch { p.analysis = { palette: [[180,170,160]], paletteHex: ["#b4aaa0"], avgRGB: [180,170,160], warm: 0.5, light: 0.5, sat: 0.3 }; }
      }
    }
    month.agg = aggregateMonth(month.photos);
    month.mood = pickMood(month.agg);
    month.theme = buildTheme(month.agg, month.mood);
  }

  renderAlbum(filled);

  // Show album
  introEl.hidden = true;
  albumEl.hidden = false;
  window.scrollTo({ top: 0, behavior: "instant" });

  // Hook up scroll effects after layout settles
  requestAnimationFrame(() => requestAnimationFrame(initScrollEffects));

  composeBtn.disabled = false;
  composeBtn.querySelector(".btn__arrow").textContent = "→";
}

function renderAlbum(filled) {
  // ---- Cover ----
  // Take a unified palette from across all months (top color of each month)
  const coverPalette = filled.map((m) => m.theme.accent).slice(0, 8);
  const coverGrad = `
    linear-gradient(180deg,
      rgba(20,17,15,0) 0%,
      rgba(20,17,15,0.05) 60%,
      rgba(20,17,15,0.12) 100%),
    linear-gradient(135deg,
      ${filled[0].theme.accent}22 0%,
      ${filled[Math.floor(filled.length/2)].theme.accent}1a 50%,
      ${filled[filled.length-1].theme.accent}22 100%)
  `;
  const totalPhotos = filled.reduce((s, m) => s + m.photos.length, 0);
  const yearLabel = inferYearLabel(filled);

  albumCover.style.backgroundImage = coverGrad;
  albumCover.innerHTML = `
    <p class="cover__pretitle reveal">An album in ${filled.length} chapter${filled.length === 1 ? "" : "s"}</p>
    <div>
      <h1 class="cover__title reveal reveal--slow">${yearLabel}</h1>
      <p class="cover__sub reveal reveal--late">
        A year read through its own light. Each month is themed only by the
        photographs inside it &mdash; the warmth in their corners, the cool
        in their shadows, the colors most repeated across the roll.
      </p>
      <div class="cover__swatches reveal reveal--later" aria-hidden="true">
        ${coverPalette.map((c) => `<span class="cover__swatch" style="background:${c}"></span>`).join("")}
      </div>
    </div>
    <dl class="cover__meta reveal reveal--later">
      <div class="cover__metaitem"><dt>Chapters</dt><dd>${String(filled.length).padStart(2,"0")}</dd></div>
      <div class="cover__metaitem"><dt>Frames</dt><dd>${totalPhotos}</dd></div>
      <div class="cover__metaitem"><dt>Edition</dt><dd>I &middot; of one</dd></div>
    </dl>
  `;

  // ---- Chapters ----
  albumChapters.innerHTML = "";
  filled.forEach((month, i) => {
    const sec = document.createElement("section");
    sec.className = "chapter";
    const t = month.theme;
    sec.style.setProperty("--bg", t.bg);
    sec.style.setProperty("--grad", t.grad);
    sec.style.setProperty("--fg", t.fg);
    sec.style.setProperty("--fg-mute", t.fgMute);
    sec.style.setProperty("--accent", t.accent);
    sec.style.setProperty("--c-serif", t.serif);
    sec.style.setProperty("--c-sans", t.sans);
    if (i > 0) sec.style.setProperty("--prevBg", filled[i-1].theme.bg);

    const photos = month.photos;
    const hero = photos[0];
    const rest = photos.slice(1);

    const palette = month.agg.palette.slice(0, 6).map((rgb) => rgbToHex(...rgb));
    const stats = month.agg;
    const warmth = labelWarm(stats.warm);
    const lightLabel = labelLight(stats.light);
    const satLabel = labelSat(stats.sat);

    sec.innerHTML = `
      <header class="chapter__head">
        <p class="chapter__index reveal">Chapter ${String(i + 1).padStart(2, "0")} &middot; ${String(MONTHS.indexOf(month.name)+1).padStart(2,"0")}/12</p>
        <h2 class="chapter__title reveal reveal--slow">${month.name}</h2>
        <p class="chapter__mood reveal reveal--late">${month.mood.label}</p>
        <div class="chapter__rule reveal reveal--late" aria-hidden="true"></div>
      </header>

      <figure class="chapter__hero reveal reveal--slow" data-parallax>
        <img src="${hero.url}" alt="" loading="lazy" />
      </figure>

      <div class="chapter__caption reveal">
        <span>${month.name} &middot; ${photos.length} frame${photos.length === 1 ? "" : "s"}</span>
        <span>${month.mood.label}</span>
      </div>

      ${rest.length ? `
        <div class="chapter__grid">
          ${rest.map((p) => `
            <figure class="reveal">
              <img src="${p.url}" alt="" loading="lazy" />
            </figure>
          `).join("")}
        </div>
      ` : ""}

      <blockquote class="chapter__quote reveal reveal--late">
        &ldquo;${month.mood.quote}&rdquo;
      </blockquote>

      <div class="chapter__stats reveal">
        <div>Warmth<strong>${warmth}</strong></div>
        <div>Light<strong>${lightLabel}</strong></div>
        <div>Saturation<strong>${satLabel}</strong></div>
      </div>

      <div class="chapter__palette reveal" aria-label="Palette">
        ${palette.map((c) => `<span style="background:${c}"></span>`).join("")}
      </div>
    `;

    albumChapters.appendChild(sec);
  });
}

function inferYearLabel(filled) {
  // Use the most common year from photo lastModified, otherwise current
  const years = {};
  filled.forEach((m) => m.photos.forEach((p) => {
    const d = p.file.lastModified ? new Date(p.file.lastModified) : null;
    if (d && !isNaN(d)) {
      const y = d.getFullYear();
      years[y] = (years[y] || 0) + 1;
    }
  }));
  let bestY = new Date().getFullYear(), bestN = 0;
  for (const [y, n] of Object.entries(years)) {
    if (n > bestN) { bestN = n; bestY = +y; }
  }
  return String(bestY);
}

function labelWarm(v) {
  if (v > 0.66) return "Warm";
  if (v < 0.42) return "Cool";
  return "Neutral";
}
function labelLight(v) {
  if (v > 0.66) return "Bright";
  if (v < 0.36) return "Dark";
  return "Mid";
}
function labelSat(v) {
  if (v > 0.55) return "Vivid";
  if (v < 0.22) return "Muted";
  return "Balanced";
}

/* =============================================================
   Scroll effects: reveal, parallax, page-flip, progress
   ============================================================= */

let revealIO;
let parallaxNodes = [];

function initScrollEffects() {
  revealIO?.disconnect();

  revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        revealIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  albumEl.querySelectorAll(".reveal").forEach((el) => revealIO.observe(el));

  parallaxNodes = [...albumEl.querySelectorAll("[data-parallax] img")];
  window.removeEventListener("scroll", onScroll);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

let scrollTicking = false;
function onScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    // Parallax on hero images
    const vh = window.innerHeight;
    parallaxNodes.forEach((img) => {
      const rect = img.parentElement.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > vh + 100) return;
      const center = rect.top + rect.height / 2;
      const offset = (center - vh / 2) / vh; // -~1..~1
      const ty = Math.max(-7, Math.min(7, offset * 6)); // %
      img.style.transform = `translateY(${(-4 + ty).toFixed(2)}%)`;
    });

    // Progress bar
    const total = (document.documentElement.scrollHeight - window.innerHeight) || 1;
    const p = Math.max(0, Math.min(1, window.scrollY / total));
    if (albumProgressFill) albumProgressFill.style.width = `${(p * 100).toFixed(1)}%`;

    scrollTicking = false;
  });
}

/* =============================================================
   Init
   ============================================================= */

renderMonths();
