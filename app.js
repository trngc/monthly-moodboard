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
// 12 hand-picked card themes — playful, varied, with a couple of dark
// accents for visual rhythm. Background, text color, and accent dot.
const MONTH_THEMES = [
  { bg: "#0c1e3e", fg: "#f5f3ee", accent: "#5b91ff" }, // Jan — deep navy
  { bg: "#fbe7eb", fg: "#1a1714", accent: "#e25677" }, // Feb — pale rose
  { bg: "#dbf1bd", fg: "#1a1714", accent: "#5fa84a" }, // Mar — fresh lime
  { bg: "#f0e5d2", fg: "#1a1714", accent: "#a8804a" }, // Apr — cream
  { bg: "#ffd1be", fg: "#1a1714", accent: "#e8543b" }, // May — coral
  { bg: "#bee3ff", fg: "#0a2540", accent: "#1a76d2" }, // Jun — sky
  { bg: "#ffec5c", fg: "#1a1714", accent: "#c79100" }, // Jul — bright yellow
  { bg: "#f1ead6", fg: "#1a1714", accent: "#9c7e34" }, // Aug — ivory
  { bg: "#ff7d3b", fg: "#1a1714", accent: "#7a2c0a" }, // Sep — pumpkin
  { bg: "#892029", fg: "#ffe9da", accent: "#ffb0a3" }, // Oct — maroon
  { bg: "#ffd9b8", fg: "#1a1714", accent: "#c66e30" }, // Nov — peach
  { bg: "#0d0d10", fg: "#f5f3ee", accent: "#9b9bb0" }, // Dec — black
];

function renderMonths() {
  monthList.innerHTML = "";
  state.months.forEach((m, idx) => {
    const short = MONTH_SHORT[idx];
    const sizeClass = MONTH_SIZE[short];
    const t = MONTH_THEMES[idx];
    const li = document.createElement("li");
    li.style.display = "contents"; // pass through grid placement to the card
    monthList.appendChild(li);

    const card = document.createElement("button");
    card.type = "button";
    card.className = `bento__card bento__card--${short} bento__card--${sizeClass}`;
    card.dataset.month = idx;
    card.style.setProperty("--card-bg", t.bg);
    card.style.setProperty("--card-fg", t.fg);
    card.style.setProperty("--card-accent", t.accent);
    card.setAttribute("aria-label", `${m.name}: ${m.photos.length} photo${m.photos.length === 1 ? "" : "s"}. Tap to add photos.`);

    card.innerHTML = `
      <div class="bento__photos" data-photos="0"></div>
      <div class="bento__head">
        <span>${String(idx + 1).padStart(2, "0")} &middot; ${short.toUpperCase()}</span>
        <span class="bento__plus" aria-hidden="true">+</span>
      </div>
      <div class="bento__body">
        <span class="bento__name">${m.name}</span>
        <span class="bento__count">${m.photos.length === 0 ? "Add photos" : `${m.photos.length} photo${m.photos.length === 1 ? "" : "s"}`}</span>
      </div>
      <input type="file" accept="image/*" multiple hidden data-input="${idx}" />
      <button type="button" class="bento__clear" aria-label="Clear ${m.name}" tabindex="-1">&times;</button>
    `;

    li.appendChild(card);

    // Update photos collage
    paintBentoPhotos(card, m.photos);
    card.classList.toggle("has-photos", m.photos.length > 0);

    const input = card.querySelector(`[data-input="${idx}"]`);
    const clearBtn = card.querySelector(".bento__clear");

    // Tap card → open file picker (skip if click came from the clear button)
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
      // Clear cached analysis too so re-uploaded photos re-analyze cleanly
      renderMonths();
    });

    // Drop directly on the card → push into this month
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
  // After layout, place decorations using actual cell positions
  requestAnimationFrame(() => {
    boardsEl.querySelectorAll(".board").forEach((b) => decorateBoard(b));
  });
}

function buildBoard(month, idx, total) {
  const sec = document.createElement("section");
  sec.className = "board reveal";
  sec.dataset.monthIdx = MONTHS.indexOf(month.name);
  const t = month.theme;
  sec.style.setProperty("--bg", t.bg);
  sec.style.setProperty("--grad", t.grad);
  sec.style.setProperty("--accent", t.accent);
  sec.style.setProperty("--accent2", t.accent2);

  const monthIdx = MONTHS.indexOf(month.name);
  const year = state.year;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  // Mon = 0 ... Sun = 6
  const firstDay = (new Date(year, monthIdx, 1).getDay() + 6) % 7;

  const moodKey = month.mood.id;
  const decor = MOOD_DECOR[moodKey] || MOOD_DECOR["warm-golden"];

  // Seeded RNG so re-renders are stable per month
  const rng = rngFromSeed(monthIdx * 1009 + (year % 100) * 31 + 7);

  // Pick which dates get hand-written event labels
  const eventCount = Math.min(daysInMonth, 4 + Math.floor(rng() * 3)); // 4–6
  const eventDates = pickN(
    Array.from({ length: daysInMonth }, (_, i) => i + 1),
    eventCount,
    rng,
  );
  const events = eventDates.map((d) => ({ d, text: pick(decor.events, rng) }));

  // Pick which dates get a hand-drawn circle
  const circleDates = pickN(
    Array.from({ length: daysInMonth }, (_, i) => i + 1),
    1 + Math.floor(rng() * 3), // 1-3
    rng,
  );

  // Build calendar grid HTML
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const cellsHtml = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDay + 1;
    const blank = dayNum < 1 || dayNum > daysInMonth;
    const ev = events.find((e) => e.d === dayNum);
    const circled = circleDates.includes(dayNum);
    cellsHtml.push(`
      <div class="cal__cell ${blank ? "cal__cell--blank" : ""}" data-day="${blank ? "" : dayNum}">
        ${blank ? "" : `<span class="cal__num">${dayNum}</span>`}
        ${ev ? `<span class="cal__note">${escapeHtml(ev.text)}</span>` : ""}
        ${circled ? handCircleSVG(rng, t.accent) : ""}
      </div>
    `);
  }

  sec.innerHTML = `
    <div class="board__head">
      <span class="board__chapter">${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>
      <span class="board__head-spacer"></span>
      <button class="board__export" type="button" data-export>Save PNG</button>
    </div>

    <div class="board__capture" data-capture>
      <div class="paper">
        <div class="paper__top">
          <span class="paper__icon" aria-hidden="true">‹</span>
          <span class="paper__crumb">${year}</span>
          <span class="paper__top-spacer"></span>
          <span class="paper__icon" aria-hidden="true">▤</span>
          <span class="paper__icon" aria-hidden="true">⌕</span>
          <span class="paper__icon" aria-hidden="true">+</span>
        </div>
        <h2 class="paper__title">${month.name} <em>moodboard</em></h2>
        <p class="paper__mood">${month.mood.label.toLowerCase()}</p>

        <div class="cal" data-cal>
          <div class="cal__weekdays">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
          <div class="cal__grid">
            ${cellsHtml.join("")}
          </div>
        </div>
      </div>

      <div class="board__decor" data-decor></div>
    </div>
  `;

  // Wire up export button
  const exportBtn = sec.querySelector("[data-export]");
  exportBtn.addEventListener("click", () => exportBoardAsPNG(sec, month));

  // Stash data for decorate pass
  sec.__decorData = { month, decor, rng, monthIdx, year };

  return sec;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---- Decoration placement (post-layout, uses real cell rects) ---- */

function decorateBoard(boardEl) {
  const data = boardEl.__decorData;
  if (!data) return;
  const { month, decor, monthIdx, year } = data;
  const rng = rngFromSeed(monthIdx * 9013 + (year % 100) * 41 + 19);

  const capture = boardEl.querySelector("[data-capture]");
  const decorEl = boardEl.querySelector("[data-decor]");
  decorEl.innerHTML = "";

  const capRect = capture.getBoundingClientRect();
  const W = capRect.width;
  const H = Math.max(capRect.height, capture.offsetHeight);

  // Reference rects (relative to capture origin)
  const localRect = (sel) => {
    const el = boardEl.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - capRect.left, y: r.top - capRect.top, w: r.width, h: r.height };
  };
  const paperRect = localRect(".paper");
  const titleRect = localRect(".paper__title");
  const moodRect = localRect(".paper__mood");
  const wkRect = localRect(".cal__weekdays");
  const gridRect = localRect(".cal__grid");

  // Forbidden zone for stickers: from paper top through the weekday header,
  // so emoji never lands on the title, mood subtitle, or weekday labels.
  const titleZone = (paperRect && wkRect)
    ? {
        x: paperRect.x - 8,
        y: paperRect.y,
        w: paperRect.w + 16,
        h: (wkRect.y + wkRect.h) - paperRect.y + 4,
      }
    : null;

  // Polaroid top must clear the weekday row
  const minPolaroidY = wkRect ? wkRect.y + wkRect.h + 4 : 140;
  // Polaroid bottom must stay within capture (or extend slightly past)
  const maxPolaroidBottom = H - 10;

  // ---- Polaroids ----
  const cells = [...boardEl.querySelectorAll(".cal__cell:not(.cal__cell--blank)")];
  const cellRects = cells.map((c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left - capRect.left, y: r.top - capRect.top, w: r.width, h: r.height };
  });
  const order = [...cellRects.keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const placed = [];
  const photos = month.photos;

  // Smaller polaroids when there are many photos
  const photoCount = photos.length;
  const widthScale = photoCount >= 8 ? 0.22 : photoCount >= 5 ? 0.26 : 0.30;
  const baseW = Math.max(80, Math.min(130, W * widthScale));

  // Caption queue: alternate between event vocab and "mmm dd" labels, all distinct
  const eventPool = [...decor.events];
  const eventQueue = [];
  while (eventPool.length) eventQueue.push(eventPool.splice(Math.floor(rng() * eventPool.length), 1)[0]);

  photos.forEach((photo, i) => {
    let chosenRect = null;
    for (let attempt = 0; attempt < Math.min(10, order.length); attempt++) {
      const idx = order[(i * 7 + attempt) % order.length];
      const cr = cellRects[idx];
      if (!cr) continue;
      const sizeJitter = 0.9 + rng() * 0.22;
      const w = baseW * sizeJitter;
      const h = w * 1.18;
      const cx = cr.x + cr.w / 2 + (rng() - 0.5) * cr.w * 0.5;
      const cy = cr.y + cr.h / 2 + (rng() - 0.5) * cr.h * 0.4;
      let rx = cx - w/2;
      let ry = cy - h/2;
      // Clamp so polaroid does not cover the weekday header or month title
      ry = Math.max(minPolaroidY, ry);
      ry = Math.min(maxPolaroidBottom - h, ry);
      // Keep mostly within capture horizontally (allow ~15% overflow)
      rx = Math.max(-w * 0.15, Math.min(W - w * 0.85, rx));
      const rect = { x: rx, y: ry, w, h };
      let overlap = 0;
      for (const p of placed) overlap += rectOverlap(rect, p);
      if (chosenRect == null || overlap < chosenRect._overlap) {
        chosenRect = { ...rect, _overlap: overlap };
      }
      if (overlap === 0) break;
    }
    if (!chosenRect) return;
    placed.push(chosenRect);

    const tilt = (rng() - 0.5) * 16; // -8..+8
    const useDate = rng() < 0.45;
    const day = 1 + Math.floor(rng() * 27);
    const cap = useDate
      ? `${month.name.slice(0, 3).toLowerCase()} ${day}`
      : (eventQueue[i % eventQueue.length] || pick(decor.events, rng));

    const clipKind = ["top", "tl", "tr"][Math.floor(rng() * 3)];
    const clipSVG = rng() < 0.55 ? paperclipSVG() : binderClipSVG();

    const fig = document.createElement("figure");
    fig.className = "polaroid";
    fig.style.left = `${chosenRect.x}px`;
    fig.style.top  = `${chosenRect.y}px`;
    fig.style.width  = `${chosenRect.w}px`;
    fig.style.transform = `rotate(${tilt.toFixed(2)}deg)`;
    fig.style.zIndex = 10 + i;
    const photoH = chosenRect.h - 36;
    fig.innerHTML = `
      <span class="clip clip--${clipKind}">${clipSVG}</span>
      <img src="${photo.url}" alt="" style="height:${photoH}px" />
      <figcaption>${escapeHtml(cap)}</figcaption>
    `;
    decorEl.appendChild(fig);
  });

  // ---- Stickers ----
  // Pick distinct emoji where possible
  const stickerPool = [...decor.stickers];
  for (let i = stickerPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [stickerPool[i], stickerPool[j]] = [stickerPool[j], stickerPool[i]];
  }
  const stickerCount = Math.min(stickerPool.length, 6 + Math.floor(rng() * 3));
  let placedStickers = 0;
  for (let attempts = 0; attempts < stickerCount * 5 && placedStickers < stickerCount; attempts++) {
    const emoji = stickerPool[placedStickers % stickerPool.length];
    const size = 22 + Math.floor(rng() * 14);
    const x = -8 + rng() * (W - size + 16);
    // Allow stickers anywhere from the date-grid area downwards
    const stickerYStart = (gridRect ? gridRect.y : 140);
    const yMax = H - size - 8;
    const y = stickerYStart + rng() * (yMax - stickerYStart);
    const sx = x, sy = y, sw = size, sh = size;
    if (titleZone && rectOverlap({x:sx,y:sy,w:sw,h:sh}, titleZone) > 0) continue;
    // Discourage overlap with already-placed polaroids (allow some)
    let polOverlap = 0;
    for (const p of placed) polOverlap += rectOverlap({x:sx,y:sy,w:sw,h:sh}, p);
    if (polOverlap > sw * sh * 0.4) continue;
    const tilt = (rng() - 0.5) * 30;
    const span = document.createElement("span");
    span.className = "sticker";
    span.textContent = emoji;
    span.style.left = `${sx}px`;
    span.style.top  = `${sy}px`;
    span.style.fontSize = `${size}px`;
    span.style.transform = `rotate(${tilt.toFixed(1)}deg)`;
    span.style.zIndex = 6;
    decorEl.appendChild(span);
    placedStickers++;
  }

  // ---- Free handwritten scribbles (distinct text + distinct slots) ----
  const scribbleCount = 1 + Math.floor(rng() * 2);
  const scribbleTexts = pickN(decor.scribbles, Math.min(scribbleCount, decor.scribbles.length), rng);
  const baseY = paperRect ? paperRect.y + paperRect.h + 12 : H - 110;
  const slotW = (W - 32) / Math.max(1, scribbleTexts.length);
  scribbleTexts.forEach((text, i) => {
    const x = 16 + i * slotW + rng() * (slotW * 0.35);
    const y = baseY + (i % 2) * 26 + rng() * 16;
    const tilt = (rng() - 0.5) * 14;
    const el = document.createElement("p");
    el.className = "scribble " + (rng() < 0.5 ? "scribble--accent" : "");
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.transform = `rotate(${tilt.toFixed(1)}deg)`;
    el.style.zIndex = 7;
    decorEl.appendChild(el);
  });
}

function rectOverlap(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

/* ---- Hand-drawn circle around a date (SVG, double-stroked) ---- */
function handCircleSVG(rng, color) {
  const w = 36, h = 32;
  const cx = w/2, cy = h/2;
  const rx = 13 + rng() * 2;
  const ry = 11 + rng() * 2;
  const r1 = (rng() - 0.5) * 10;
  const r2 = (rng() - 0.5) * 8;
  return `
    <svg class="cal__circle" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <g transform="translate(${(rng()-0.5)*2} ${(rng()-0.5)*2})">
        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
          fill="none" stroke="${color}" stroke-width="1.6"
          stroke-linecap="round" transform="rotate(${r1.toFixed(2)} ${cx} ${cy})"/>
        <ellipse cx="${cx + (rng()-0.5)*1.4}" cy="${cy + (rng()-0.5)*1.2}"
          rx="${(rx-0.7).toFixed(2)}" ry="${(ry-0.6).toFixed(2)}"
          fill="none" stroke="${color}" stroke-width="1.2" opacity="0.55"
          stroke-linecap="round" transform="rotate(${r2.toFixed(2)} ${cx} ${cy})"/>
      </g>
    </svg>
  `;
}

/* ---- SVG clip glyphs ---- */
function paperclipSVG() {
  return `
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <path d="M9 4 v16 a4 4 0 0 0 8 0 v-13 a3 3 0 0 0 -6 0 v11 a2 2 0 0 0 4 0 v-9"
        fill="none" stroke="#a9a9a9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}
function binderClipSVG() {
  return `
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <rect x="6" y="9" width="16" height="11" rx="1.2" fill="#1a1714" />
      <rect x="9" y="11" width="10" height="2" fill="#3b3733" />
      <path d="M9 9 l2 -4 h6 l2 4" fill="none" stroke="#1a1714" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
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
   Init
   ============================================================= */

renderMonths();
