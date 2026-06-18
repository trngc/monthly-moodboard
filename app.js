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
const boardsEl = $("#boards");
const albumYearEl = $("#albumYear");

/* =============================================================
   Intro: bento month grid
   ============================================================= */

const MONTH_SHORT = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
// Size class per month (matches the grid-template-areas layout)
const MONTH_SIZE = {
  jan: "lg",  feb: "wide", mar: "wide",
  apr: "sm",  may: "wide", jun: "tall",
  jul: "wide",aug: "wide", sep: "lg",
  oct: "sm",  nov: "wide", dec: "wide",
};
// Refined muted editorial palette — wine, dusty blue, warm beige, brown,
// cream — with two darks for rhythm. Each entry: card background, ink
// foreground, and a subtle accent.
const MONTH_THEMES = [
  { bg: "#1d1a17", fg: "#efe7d8", accent: "#7d6d57" }, // Jan — charcoal ink
  { bg: "#d8b8b6", fg: "#3a1f1d", accent: "#7d2d2c" }, // Feb — dusty rose
  { bg: "#b8c8d4", fg: "#1d2a36", accent: "#3a536c" }, // Mar — dusty blue
  { bg: "#efe5d0", fg: "#3a2f24", accent: "#8a6f4f" }, // Apr — cream paper
  { bg: "#a4b094", fg: "#1f2a1d", accent: "#5a6a4a" }, // May — sage muted
  { bg: "#c4d2dc", fg: "#1d2a36", accent: "#3a536c" }, // Jun — pale blue
  { bg: "#e8dcc4", fg: "#3a2f24", accent: "#a07a44" }, // Jul — warm beige
  { bg: "#c2745a", fg: "#1d100c", accent: "#5e2f1e" }, // Aug — terracotta
  { bg: "#c89856", fg: "#241a0e", accent: "#7d5b27" }, // Sep — muted gold
  { bg: "#8a2c2e", fg: "#f0d9d0", accent: "#d6b0a4" }, // Oct — wine red
  { bg: "#59413a", fg: "#ede1d3", accent: "#bda58a" }, // Nov — warm brown
  { bg: "#34372e", fg: "#e3e0d4", accent: "#7d8772" }, // Dec — deep olive
];

// Per-mood editorial vocabulary used by the bento label and the album page.
const MOOD_VOICE = {
  "warm-golden":     { caption: "GOLDEN HOURS",  accent: "warm hours" },
  "moody-editorial": { caption: "TONE STUDY",    accent: "low light" },
  "cool-minimal":    { caption: "QUIET LIGHT",   accent: "white space" },
  "soft-dreamy":     { caption: "SOFT FOCUS",    accent: "soft hush" },
  "bold-vivid":      { caption: "COLOR STORY",   accent: "loud color" },
  "earthy-natural":  { caption: "FIELD NOTES",   accent: "linen days" },
  "crisp-bright":    { caption: "BRIGHT SIDE",   accent: "fresh air" },
  "twilight-smoke":  { caption: "BLUE HOUR",     accent: "after dusk" },
};
// Short editorial phrases used in postcard / pinned-note motifs.
const MOOD_NOTES = {
  "warm-golden":     ["wish you were here", "kept all the light", "long, slow afternoons"],
  "moody-editorial": ["after the rain", "studio quiet", "the camera on the table"],
  "cool-minimal":    ["clean morning", "open windows", "off the grid for a while"],
  "soft-dreamy":     ["a soft week", "petals on the table", "we kept whispering"],
  "bold-vivid":      ["all the saturation", "we wore color", "louder than expected"],
  "earthy-natural":  ["bread, tea, a long walk", "in the garden again", "linen, stone, soft rain"],
  "crisp-bright":    ["icy walks, hot coffee", "early light kept calling", "lemons in the bowl"],
  "twilight-smoke":  ["the blue hour", "stayed up too late", "ash, smoke, soft thunder"],
};
// Per-mood "wishlist" rows for the wishlist motif card.
const MOOD_WISHLIST = {
  "warm-golden":     ["golden hour walk", "iced espresso", "linen shirt", "open windows"],
  "moody-editorial": ["new film stock", "low desk light", "long lens", "single malt"],
  "cool-minimal":    ["cold morning swim", "white linen", "open notebook", "early train"],
  "soft-dreamy":     ["fresh peonies", "slow Sunday", "love letter", "honeyed milk"],
  "bold-vivid":      ["red lipstick", "loud playlist", "matinee tickets", "neon sign"],
  "earthy-natural":  ["rye bread", "wool blanket", "trail map", "iron kettle"],
  "crisp-bright":    ["lemon water", "early run", "white sneakers", "iced citrus"],
  "twilight-smoke":  ["taper candle", "dark vinyl", "amber perfume", "slow gin"],
};

// Seed photos: we look for /seed/<short>.jpg per month. Users can replace
// any of these with their own photos by dropping files into /seed/.
const SEED_BASE = "seed/";

function renderMonths() {
  monthList.innerHTML = "";

  // ---- Text-only top-left cell — direct grid item ----
  const textCell = document.createElement("div");
  textCell.className = "bento__text";
  textCell.setAttribute("role", "listitem");
  textCell.innerHTML = `
    <span class="bento__logo" aria-hidden="true"></span>
    <span class="bento__line">MoodAlbum<span>a year in photos.</span></span>
  `;
  monthList.appendChild(textCell);

  // ---- 12 month cards ----
  state.months.forEach((m, idx) => {
    const short = MONTH_SHORT[idx];
    const t = MONTH_THEMES[idx];

    const card = document.createElement("button");
    card.type = "button";
    card.className = `bento__card bento__card--${short}`;
    card.setAttribute("role", "listitem");
    card.dataset.month = idx;
    card.style.setProperty("--card-bg", t.bg);
    card.style.setProperty("--card-fg", t.fg);
    card.style.setProperty("--card-accent", t.accent);
    card.setAttribute(
      "aria-label",
      `${m.name}: ${m.photos.length} photo${m.photos.length === 1 ? "" : "s"}. Tap to add photos.`
    );

    // Editorial caption — uses the mood voice once analysis is ready, falls
    // back to the month name on first paint while seeds are still loading.
    const moodKey = m.mood?.id || null;
    const caption = (moodKey && MOOD_VOICE[moodKey]?.caption) || m.name.toUpperCase();
    card.innerHTML = `
      <div class="bento__photos" data-photos="0"></div>
      <span class="bento__abbr">${short.toUpperCase()}</span>
      <span class="bento__caption">${escapeHtml(caption)}</span>
      <span class="bento__add-icon" aria-hidden="true">+</span>
      <span class="bento__add-label">Add photos</span>
      <span class="bento__count-badge" aria-hidden="true">${m.photos.length}</span>
      <input type="file" accept="image/*" multiple hidden data-input="${idx}" />
      <button type="button" class="bento__clear" aria-label="Clear ${m.name}" tabindex="-1">&times;</button>
    `;
    monthList.appendChild(card);

    paintBentoPhotos(card, m.photos);
    card.classList.toggle("has-photos", m.photos.length > 0);

    const input = card.querySelector(`[data-input="${idx}"]`);
    const clearBtn = card.querySelector(".bento__clear");

    card.addEventListener("click", (e) => {
      if (e.target.closest(".bento__clear")) return;
      input.click();
    });
    input.addEventListener("change", (e) => {
      handleFiles([...e.target.files], idx);
      input.value = "";
    });
    input.addEventListener("click", (e) => e.stopPropagation());
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      state.months[idx].photos.forEach((p) => URL.revokeObjectURL(p.url));
      state.months[idx].photos = [];
      renderMonths();
    });

    card.addEventListener("dragenter", (e) => { e.preventDefault(); card.classList.add("is-drag"); });
    card.addEventListener("dragover", (e) => { e.preventDefault(); });
    card.addEventListener("dragleave", (e) => {
      if (!card.contains(e.relatedTarget)) card.classList.remove("is-drag");
    });
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove("is-drag");
      const files = [...(e.dataTransfer?.files || [])].filter(isImage);
      if (files.length) handleFiles(files, idx);
    });
  });
  refreshCounters();
}

function paintBentoPhotos(card, photos) {
  const photosEl = card.querySelector(".bento__photos");
  photosEl.innerHTML = "";
  if (photos.length === 0) {
    photosEl.dataset.photos = "0";
    return;
  }
  const slots = Math.min(photos.length, 4);
  photosEl.dataset.photos = photos.length >= 9 ? "9+" : String(photos.length);
  for (let i = 0; i < slots; i++) {
    const img = document.createElement("img");
    img.src = photos[i].url;
    img.alt = "";
    photosEl.appendChild(img);
  }
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
  boardsEl.innerHTML = "";
});

async function composeAlbum() {
  const filled = state.months.filter((m) => m.photos.length > 0);
  if (filled.length === 0) return;

  composeBtn.disabled = true;
  composeBtn.querySelector(".btn__arrow").textContent = "…";

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

  state.year = +inferYearLabel(filled);
  albumYearEl.textContent = state.year;

  renderBoards(filled);

  introEl.hidden = true;
  albumEl.hidden = false;
  window.scrollTo({ top: 0, behavior: "instant" });

  requestAnimationFrame(() => requestAnimationFrame(initScrollEffects));

  composeBtn.disabled = false;
  composeBtn.querySelector(".btn__arrow").textContent = "→";
}

/* =============================================================
   Scrapbook moodboard rendering
   ============================================================= */

// Per-mood vocabularies for stickers, free notes, and date events
const MOOD_DECOR = {
  "warm-golden": {
    stickers: ["☀️", "🌻", "🍊", "🥭", "🌅", "✨", "🐚", "🍯"],
    scribbles: ["golden hour", "sun day", "honey light", "endless"],
    events:    ["beach", "sunset", "patio", "drinks", "trip", "walk"],
  },
  "moody-editorial": {
    stickers: ["🖤", "📷", "🌙", "✒️", "☕", "🎞️", "♣"],
    scribbles: ["lights low", "ink + film", "after hours", "tone study"],
    events:    ["studio", "shoot", "edit", "late", "review"],
  },
  "cool-minimal": {
    stickers: ["❄️", "🪞", "🩵", "✦", "🌫️", "🪟", "💧"],
    scribbles: ["clean light", "white noise", "off-grid", "snow day"],
    events:    ["walk", "swim", "flight", "deep", "off"],
  },
  "soft-dreamy": {
    stickers: ["🌸", "🎀", "🪷", "☁️", "🌷", "💌", "🩰", "🍡"],
    scribbles: ["dolce vita", "soft mood", "love letter", "soft pink"],
    events:    ["picnic", "tea", "garden", "date", "letter", "matinee"],
  },
  "bold-vivid": {
    stickers: ["🍒", "💥", "⚡", "🎯", "🌶️", "🌈", "🎨"],
    scribbles: ["loud day", "neon", "max color", "saturate", "yes!!"],
    events:    ["show", "party", "race", "launch", "demo", "open"],
  },
  "earthy-natural": {
    stickers: ["🌿", "🍄", "🪵", "🌾", "🪶", "🍂", "🌰", "🐚"],
    scribbles: ["stone & linen", "in the woods", "slow morning", "tea time"],
    events:    ["hike", "market", "trail", "pottery", "tea", "soup"],
  },
  "crisp-bright": {
    stickers: ["🍋", "⭐", "💎", "🦢", "✩", "🥶"],
    scribbles: ["icy walk", "fresh air", "early light", "lemon mood"],
    events:    ["run", "swim", "ski", "fresh", "early", "open"],
  },
  "twilight-smoke": {
    stickers: ["🌑", "🥀", "☁", "⌛", "🔮", "🕯️", "🌫️"],
    scribbles: ["after dusk", "blue hour", "in transit", "nightfall"],
    events:    ["red-eye", "drive", "blue hr", "drinks", "show", "late"],
  },
};

function rngFromSeed(seed) {
  // mulberry32
  let s = (seed | 0) || 1;
  return function rng() {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function pickN(arr, n, rng) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function renderBoards(filled) {
  boardsEl.innerHTML = "";
  filled.forEach((month, idx) => {
    const board = buildBoard(month, idx, filled.length);
    boardsEl.appendChild(board);
  });
}

function buildBoard(month, idx, total) {
  const sec = document.createElement("section");
  sec.className = "board reveal";
  sec.dataset.monthIdx = MONTHS.indexOf(month.name);

  const t = month.theme;
  // Theme custom properties for the editorial page styling.
  sec.style.setProperty("--bg",       t.bg);
  sec.style.setProperty("--ink",      t.fg);
  sec.style.setProperty("--accent",   t.accent);
  sec.style.setProperty("--accent-2", t.accent2 || t.accent);
  sec.style.setProperty("--c-serif",  t.serif);
  sec.style.setProperty("--c-sans",   t.sans);

  const moodKey = month.mood.id;
  const voice   = MOOD_VOICE[moodKey]    || MOOD_VOICE["warm-golden"];
  const notes   = MOOD_NOTES[moodKey]    || MOOD_NOTES["warm-golden"];
  const wishes  = MOOD_WISHLIST[moodKey] || MOOD_WISHLIST["warm-golden"];

  // Stable seeded RNG so re-renders of the same month are identical.
  const monthIdx = MONTHS.indexOf(month.name);
  const rng = rngFromSeed(monthIdx * 1009 + (state.year % 100) * 31 + 7);

  const photos = month.photos;
  const hero  = photos[0];
  const grid  = photos.slice(1, 4);
  const fillerCount = Math.max(0, 3 - grid.length);
  for (let i = 0; i < fillerCount; i++) grid.push(photos[i % photos.length]);
  const heroCap = pick(notes, rng);

  // Rotate motif: postcard / wishlist / pinned-note across chapters
  const motifKind = ["postcard", "wishlist", "note"][idx % 3];
  const motifHtml = renderMotif(motifKind, month, idx, voice, notes, wishes, rng);

  const palette = (month.agg?.palette || []).slice(0, 6).map((rgb) => rgbToHex(...rgb));

  const captionMain = `${voice.caption} \u00B7 ${String(idx + 1).padStart(2,"0")}/${String(total).padStart(2,"0")}`;
  const heroAlt = `${month.name} hero photo`;

  sec.innerHTML = `
    <div class="board__head">
      <span class="board__chapter">${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>
      <span class="board__head-spacer"></span>
      <button class="board__export" type="button" data-export>Save PNG</button>
    </div>

    <article class="board__capture" data-capture>
      <header class="page-head">
        <p class="page-caption">${escapeHtml(captionMain)}</p>
        <h2 class="page-title">${escapeHtml(month.name)}</h2>
        <p class="page-accent">${escapeHtml(voice.accent)}</p>
        <hr class="page-rule" />
      </header>

      <figure class="page-hero">
        <img src="${hero.url}" alt="${escapeHtml(heroAlt)}" />
        <figcaption class="page-hero__cap">${escapeHtml(heroCap)}</figcaption>
      </figure>

      <p class="page-lede">${escapeHtml(buildLede(month, voice))}</p>

      ${grid.length ? `
        <div class="page-strip">
          ${grid.map((p) => `<figure><img src="${p.url}" alt="" /></figure>`).join("")}
        </div>
      ` : ""}

      ${motifHtml}

      <div class="page-palette" aria-label="Palette">
        ${palette.map((c) => `<span style="background:${c}"></span>`).join("")}
      </div>

      <footer class="page-foot">
        <span class="page-foot__rule"></span>
        <span class="page-foot__center">Volume ${String(idx + 1).padStart(2, "0")} \u00B7 ${escapeHtml(month.mood.label)}</span>
        <span class="page-foot__rule"></span>
      </footer>
    </article>
  `;

  sec.querySelector("[data-export]").addEventListener("click", () => exportBoardAsPNG(sec, month));
  return sec;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---- Lede builder: a short italic intro pulled from mood + month ---- */
function buildLede(month, voice) {
  const v = voice.accent.toLowerCase();
  const m = month.name;
  // Short, generic editorial prose — composed per month so it never repeats
  // verbatim across chapters.
  const templates = [
    `${m} kept ${v} on every windowsill.`,
    `A small chapter of ${v} \u2014 ${m}, mostly quiet.`,
    `Notes from ${m}: ${v}, light, and slow afternoons.`,
    `${m} read like a single long paragraph of ${v}.`,
  ];
  return templates[(month.name.length + v.length) % templates.length];
}

/* ---- Motif builders: postcard / wishlist / pinned-note ---- */
function renderMotif(kind, month, idx, voice, notes, wishes, rng) {
  if (kind === "postcard") {
    const hand = pick(notes, rng);
    return `
      <aside class="motif motif--postcard" aria-hidden="true">
        <div class="postcard__msg">
          <p class="postcard__hand">${escapeHtml(hand)}</p>
          <span class="postcard__msg-line"></span>
          <span class="postcard__msg-line"></span>
          <span class="postcard__msg-line"></span>
        </div>
        <div class="postcard__address">
          <span class="postcard__stamp">${String(idx + 1).padStart(2,"0")}</span>
          <div class="postcard__lines">
            <span></span><span></span><span></span>
          </div>
        </div>
      </aside>
    `;
  }
  if (kind === "wishlist") {
    return `
      <aside class="motif motif--wishlist" aria-hidden="true">
        <p class="wishlist__head">WISHLIST \u00B7 ${escapeHtml(month.name)}</p>
        <h3 class="wishlist__title">${escapeHtml(voice.accent)}</h3>
        <ol class="wishlist__list">
          ${wishes.slice(0, 4).map((w, i) => `
            <li data-num="${String(i + 1).padStart(2, "0")}">${escapeHtml(w)}</li>
          `).join("")}
        </ol>
      </aside>
    `;
  }
  // note
  const text = pick(notes, rng);
  return `
    <aside class="motif motif--note" aria-hidden="true">
      <p class="note__hand">${escapeHtml(text)}</p>
      <p class="note__sub">${escapeHtml(voice.caption)}</p>
    </aside>
  `;
}

/* =============================================================
   PNG export — html2canvas
   ============================================================= */

async function exportBoardAsPNG(boardEl, month) {
  const node = boardEl.querySelector("[data-capture]");
  const btn = boardEl.querySelector("[data-export]");
  if (!node || !window.html2canvas) {
    alert("Export library is still loading. Try again in a moment.");
    return;
  }
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const canvas = await window.html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      // Ensure web fonts already loaded in this document are honored
      onclone: (cloneDoc) => {
        // Belt-and-braces: re-link the original Google Fonts stylesheet inside the clone
        const orig = document.querySelector('link[href*="fonts.googleapis.com"]');
        if (orig && !cloneDoc.querySelector('link[href*="fonts.googleapis.com"]')) {
          const l = cloneDoc.createElement("link");
          l.rel = "stylesheet";
          l.href = orig.href;
          cloneDoc.head.appendChild(l);
        }
      },
    });
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    const safeMood = month.mood.id.replace(/[^a-z0-9]+/gi, "-");
    a.download = `moodalbum-${month.name.toLowerCase()}-${safeMood}.png`;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error("PNG export failed:", e);
    alert("Sorry, couldn't render that board to PNG. Check the console for details.");
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function inferYearLabel(filled) {
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

/* =============================================================
   Scroll reveal (boards only)
   ============================================================= */

let revealIO;
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
}

/* =============================================================
   Seed loader — pre-populate every month with a starter photo so
   the app opens already showing a complete album. Users can drop
   replacements into /seed/<short>.jpg in the repo, or tap any
   card and pick their own. Missing files are silently skipped.
   ============================================================= */

async function loadSeedPhotos() {
  const tasks = MONTH_SHORT.map(async (short, idx) => {
    if (state.months[idx].photos.length > 0) return;
    const url = `${SEED_BASE}${short}.jpg`;
    try {
      const resp = await fetch(url, { cache: "force-cache" });
      if (!resp.ok) return;
      const blob = await resp.blob();
      if (!blob || !blob.type.startsWith("image/")) return;
      const file = new File([blob], `${short}.jpg`, { type: blob.type, lastModified: Date.UTC(2026, idx, 12) });
      const objUrl = URL.createObjectURL(blob);
      state.months[idx].photos.push({
        id: nextPhotoId++,
        file,
        url: objUrl,
        analysis: null,
        isSeed: true,
      });
    } catch (e) { /* offline / 404 — skip */ }
  });
  await Promise.all(tasks);
  renderMonths();

  // Pre-analyze each seeded month so the bento caption can show the
  // detected mood voice (and so Compose is instant when tapped).
  for (const month of state.months) {
    if (month.photos.length === 0) continue;
    for (const p of month.photos) {
      if (!p.analysis) {
        try { p.analysis = await analyzePhoto(p); } catch { /* keep going */ }
      }
    }
    if (month.photos.every((p) => p.analysis)) {
      month.agg = aggregateMonth(month.photos);
      month.mood = pickMood(month.agg);
      month.theme = buildTheme(month.agg, month.mood);
    }
  }
  renderMonths();
}

/* =============================================================
   Init
   ============================================================= */

renderMonths();
loadSeedPhotos();
