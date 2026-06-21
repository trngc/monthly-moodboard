/* =============================================================
   MoodAlbum — three-step flow (bento → detail → calendar pager)
   ============================================================= */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

/* Bento grid placement — one area per month plus the wordmark "text" cell. */
const MONTH_SIZE = {
  jan: "lg",  feb: "wide", mar: "wide",
  apr: "sm",  may: "wide", jun: "tall",
  jul: "wide",aug: "wide", sep: "lg",
  oct: "sm",  nov: "wide", dec: "wide",
};

/* Restrained muted card themes — paired down for a white-page UI. */
const MONTH_THEMES = [
  { bg: "#1a1714", fg: "#f3f1ee", accent: "#7d6d57" }, // Jan — ink
  { bg: "#f3e6e7", fg: "#1a1714", accent: "#7d2d2c" }, // Feb — dusty rose
  { bg: "#e2eaf0", fg: "#1a1714", accent: "#3a536c" }, // Mar — dusty blue
  { bg: "#efe9da", fg: "#1a1714", accent: "#8a6f4f" }, // Apr — cream
  { bg: "#dde3d6", fg: "#1a1714", accent: "#5a6a4a" }, // May — sage
  { bg: "#e3ecf2", fg: "#1a1714", accent: "#3a536c" }, // Jun — pale blue
  { bg: "#eee5d2", fg: "#1a1714", accent: "#a07a44" }, // Jul — warm beige
  { bg: "#e8d2c4", fg: "#1a1714", accent: "#5e2f1e" }, // Aug — clay
  { bg: "#ecd6b2", fg: "#1a1714", accent: "#7d5b27" }, // Sep — muted gold
  { bg: "#d8b8b6", fg: "#1a1714", accent: "#7d2d2c" }, // Oct — soft wine
  { bg: "#dfd3c8", fg: "#1a1714", accent: "#7d6553" }, // Nov — warm taupe
  { bg: "#222", fg: "#f0eee9", accent: "#7d8772" },    // Dec — black
];

/* Placeholder paths — replace files in /placeholders/ to swap any of these.
   See /placeholders/README.md. */
const PLACEHOLDER_PHOTOS = MONTH_SHORT.map((_, i) =>
  `placeholders/photo-${String(i + 1).padStart(2, "0")}.jpg`
);
const PLACEHOLDER_BG = "placeholders/calendar-bg.jpg"; // fallback if a rotated bg is missing

/* Five calendar backgrounds, rotated across the 12 months:
   Jan→01, Feb→02 … May→05, Jun→01, Jul→02 … cycling every 5 months. */
const PLACEHOLDER_BGS = [1, 2, 3, 4, 5].map((n) =>
  `placeholders/calendar-bg-0${n}.jpg`
);
function bgForMonth(monthIdx) {
  return PLACEHOLDER_BGS[monthIdx % PLACEHOLDER_BGS.length];
}

/* Stickers auto-scattered onto each calendar — Unicode emoji, no external assets. */
const STICKER_SET = [
  "✨", "❀", "✿", "♡", "✦", "☁", "☀", "❉", "✩", "♢", "✼", "❋",
];

/* Lightweight notes vocab for randomized handwritten captions. */
const NOTE_WORDS = [
  "soft day", "long walk", "drinks", "trip", "letter day",
  "matinee", "garden", "tea", "studio", "open road",
  "blue hour", "fresh air", "early call", "after dusk", "slow morning",
];

/* =============================================================
   State
   ============================================================= */

const state = {
  /* 12 entries, one per month. Each photo: {id, file, url, analysis, day, note} */
  months: MONTHS.map((name) => ({ name, photos: [] })),
  /* Which view is showing: "intro" | "detail" | "album" */
  view: "intro",
  /* Index of the month currently focused in detail / album */
  activeMonth: 0,
  /* Year used by the calendar grid */
  year: new Date().getFullYear(),
};

let nextPhotoId = 1;

/* =============================================================
   DOM refs
   ============================================================= */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const introEl   = $("#intro");
const detailEl  = $("#detail");
const albumEl   = $("#album");

const monthList  = $("#monthList");
const composeBtn = $("#composeBtn");
const counterPhotos = $("#counterPhotos");
const counterMonths = $("#counterMonths");
const globalInput = $("#globalInput");

const detailBack    = $("#detailBack");
const detailTitle   = $("#detailTitle");
const detailIndex   = $("#detailIndex");
const detailYearLab = $("#detailYearLabel");
const detailCount   = $("#detailCount");
const detailTrack   = $("#detailTrack");
const detailDots    = $("#detailDots");
const detailUpload  = $("#detailUpload");
const continueBtn   = $("#continueBtn");

const albumBack    = $("#albumBack");
const albumMonth   = $("#albumMonth");
const albumYear    = $("#albumYear");
const albumExport  = $("#albumExport");
const pager        = $("#pager");
const pagerLabel   = $("#pagerLabel");
const prevMonthBtn = $("#prevMonth");
const nextMonthBtn = $("#nextMonth");

const workCanvas = $("#workCanvas");

/* =============================================================
   View navigation
   ============================================================= */

function showView(name) {
  state.view = name;
  introEl.hidden  = name !== "intro";
  detailEl.hidden = name !== "detail";
  albumEl.hidden  = name !== "album";
  window.scrollTo({ top: 0, behavior: "instant" });
}

function openDetail(monthIdx) {
  state.activeMonth = monthIdx;
  ensureSeeded(monthIdx);
  renderDetail();
  showView("detail");
}

function openAlbum(monthIdx) {
  state.activeMonth = monthIdx;
  // Ensure every month has at least its placeholder seeds so the
  // horizontal swipe always shows a composed calendar, not an empty page.
  for (let i = 0; i < MONTHS.length; i++) ensureSeeded(i);
  renderAlbum();
  showView("album");
  requestAnimationFrame(() => scrollPagerTo(monthIdx, false));
  // Bento counts may have changed as a side effect — refresh quietly.
  renderMonths();
}

function backToIntro() {
  showView("intro");
}

/* =============================================================
   Seeded placeholders — load all 12 at startup, share among detail
   carousels lazily so the demo feels populated immediately.
   ============================================================= */

const placeholderPool = []; // array of {url, blob} for each photo-NN.jpg

async function loadPlaceholders() {
  await Promise.all(PLACEHOLDER_PHOTOS.map(async (path, i) => {
    try {
      const resp = await fetch(path, { cache: "force-cache" });
      if (!resp.ok) return;
      const blob = await resp.blob();
      if (!blob || !blob.type.startsWith("image/")) return;
      placeholderPool[i] = { url: URL.createObjectURL(blob), blob, idx: i };
    } catch (e) { /* offline — skip */ }
  }));
}

/* Seed a month with a few placeholder photos if it's empty.
   Each photo lands on a distinct (week, weekday) cell so polaroids
   never stack vertically into a single calendar column. */
function ensureSeeded(monthIdx) {
  const month = state.months[monthIdx];
  if (month.photos.length > 0) return;
  const daysInMonth = new Date(state.year, monthIdx + 1, 0).getDate();
  const firstDay = (new Date(state.year, monthIdx, 1).getDay() + 6) % 7; // Mon=0..Sun=6

  // Rotate the (week, weekday) targets per month so different months
  // have different polaroid layouts, but no two photos in the same month
  // share a weekday or a week.
  const baseTargets = [
    { week: 0, wd: 0 }, // Mon, week 1
    { week: 1, wd: 2 }, // Wed, week 2
    { week: 2, wd: 4 }, // Fri, week 3
    { week: 3, wd: 6 }, // Sun, week 4
  ];
  const rot = monthIdx % 4;
  const targets = baseTargets.map((t, i) => baseTargets[(i + rot) % baseTargets.length]);

  const dayPlan = targets.map(({ week, wd }) => {
    let day = (week * 7 + wd + 1) - firstDay;
    if (day < 1) day += 7;
    while (day > daysInMonth) day -= 7;
    return Math.max(1, Math.min(daysInMonth, day));
  });

  const offsets = [0, 4, 8, 11];
  offsets.forEach((off, i) => {
    // June (month 06) only: start with just the last 2 default photos —
    // drop the first two, keep the latter two (their days/notes unchanged).
    if (monthIdx === 5 && i < 2) return;
    const slot = placeholderPool[(monthIdx + off) % Math.max(1, placeholderPool.length)];
    if (!slot) return;
    const file = new File([slot.blob], `placeholder-${monthIdx}-${i}.jpg`, {
      type: slot.blob.type,
      lastModified: Date.UTC(state.year, monthIdx, dayPlan[i] || 1),
    });
    const url = URL.createObjectURL(slot.blob);
    month.photos.push({
      id: nextPhotoId++,
      file,
      url,
      analysis: null,
      day: dayPlan[i],
      note: pickRandom(NOTE_WORDS, monthIdx * 7 + i),
    });
  });
}

function pickRandom(arr, seed) {
  let h = (seed * 9301 + 49297) >>> 0;
  return arr[h % arr.length];
}

/* =============================================================
   File handling
   ============================================================= */

function isImage(f) { return f && f.type && f.type.startsWith("image/"); }

function addPhotosToMonth(files, monthIdx) {
  files = files.filter(isImage);
  if (!files.length) return;
  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    state.months[monthIdx].photos.push({
      id: nextPhotoId++,
      file,
      url,
      analysis: null,
      day: null,
      note: "",
    });
  });
}

/* =============================================================
   Step 1 — Bento landing
   ============================================================= */

function renderMonths() {
  monthList.innerHTML = "";

  // Top-left text-only wordmark cell
  const textCell = document.createElement("div");
  textCell.className = "bento__text";
  textCell.setAttribute("role", "listitem");
  textCell.innerHTML = `
    <span class="bento__logo" aria-hidden="true"></span>
    <span class="bento__line">MoodAlbum<span>a year in photos.</span></span>
  `;
  monthList.appendChild(textCell);

  // 12 month cards
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
      `${m.name}: ${m.photos.length} photo${m.photos.length === 1 ? "" : "s"}. Tap to open month.`
    );
    card.innerHTML = `
      <div class="bento__photos" data-photos="0"></div>
      <span class="bento__abbr">${short.toUpperCase()}</span>
      <span class="bento__add-icon" aria-hidden="true">+</span>
      <span class="bento__add-label">Add photos</span>
    `;
    monthList.appendChild(card);

    paintBentoPhotos(card, m.photos);
    card.classList.toggle("has-photos", m.photos.length > 0);

    card.addEventListener("click", () => openDetail(idx));
  });

  refreshCounters();
}

function paintBentoPhotos(card, photos) {
  const el = card.querySelector(".bento__photos");
  el.innerHTML = "";
  if (photos.length === 0) { el.dataset.photos = "0"; return; }
  // Single hero photo — the month's first/main image fills the whole card.
  el.dataset.photos = "1";
  const img = document.createElement("img");
  img.src = photos[0].url;
  img.alt = "";
  el.appendChild(img);
}

function refreshCounters() {
  const nPhotos = state.months.reduce((s, m) => s + m.photos.length, 0);
  const nMonths = state.months.filter((m) => m.photos.length > 0).length;
  counterPhotos.textContent = nPhotos;
  counterMonths.textContent = nMonths;
  composeBtn.disabled = nMonths === 0;
}

composeBtn.addEventListener("click", () => {
  const first = state.months.findIndex((m) => m.photos.length > 0);
  if (first === -1) return;
  openAlbum(first);
});

/* =============================================================
   Step 2 — Month detail (horizontal carousel + day/note inputs)
   ============================================================= */

detailBack.addEventListener("click", backToIntro);

continueBtn.addEventListener("click", () => {
  openAlbum(state.activeMonth);
});

detailUpload.addEventListener("change", (e) => {
  addPhotosToMonth([...e.target.files], state.activeMonth);
  e.target.value = "";
  renderDetail();
  renderMonths(); // keep bento previews in sync
});

function renderDetail() {
  const idx = state.activeMonth;
  const m = state.months[idx];
  detailTitle.textContent = m.name;
  detailIndex.textContent = String(idx + 1).padStart(2, "0");
  detailYearLab.textContent = state.year;
  detailCount.textContent = `${m.photos.length} photo${m.photos.length === 1 ? "" : "s"}`;

  const daysInMonth = new Date(state.year, idx + 1, 0).getDate();

  detailTrack.innerHTML = "";
  m.photos.forEach((p, i) => {
    const card = document.createElement("article");
    card.className = "pcard";
    card.dataset.photoId = p.id;
    card.innerHTML = `
      <div class="pcard__photo">
        <img src="${p.url}" alt="" />
        <button class="pcard__remove" type="button" aria-label="Remove photo">&times;</button>
      </div>
      <div class="pcard__meta">
        <span class="pcard__label">Day</span>
        <input class="pcard__day" type="number" min="1" max="${daysInMonth}" inputmode="numeric"
               value="${p.day ?? ""}" placeholder="—" />
        <span class="pcard__label">Note</span>
        <input class="pcard__note" type="text" maxlength="40"
               value="${escapeAttr(p.note || "")}" placeholder="optional caption" />
      </div>
    `;
    detailTrack.appendChild(card);

    card.querySelector(".pcard__day").addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      p.day = Number.isFinite(v) && v >= 1 && v <= daysInMonth ? v : null;
    });
    card.querySelector(".pcard__note").addEventListener("input", (e) => {
      p.note = e.target.value;
    });
    card.querySelector(".pcard__remove").addEventListener("click", () => {
      m.photos = m.photos.filter((q) => q.id !== p.id);
      URL.revokeObjectURL(p.url);
      renderDetail();
      renderMonths();
    });
  });

  // Add-photo tile at the end of the carousel
  const addTile = document.createElement("button");
  addTile.type = "button";
  addTile.className = "pcard--add";
  addTile.innerHTML = `
    <div>
      <span class="pcard__plus" aria-hidden="true">+</span>
      <span class="pcard__add-label">Add photo</span>
    </div>
  `;
  addTile.addEventListener("click", () => detailUpload.click());
  detailTrack.appendChild(addTile);

  // Dots indicator
  detailDots.innerHTML = "";
  const total = m.photos.length + 1; // includes add tile
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("span");
    if (i === 0) dot.classList.add("is-active");
    detailDots.appendChild(dot);
  }

  // Update active dot on scroll
  detailTrack.onscroll = () => {
    const cards = $$(".pcard, .pcard--add", detailTrack);
    let active = 0;
    let best = Infinity;
    const mid = detailTrack.scrollLeft + detailTrack.clientWidth / 2;
    cards.forEach((c, i) => {
      const cm = c.offsetLeft + c.offsetWidth / 2;
      const d = Math.abs(mid - cm);
      if (d < best) { best = d; active = i; }
    });
    $$("span", detailDots).forEach((d, i) => d.classList.toggle("is-active", i === active));
  };
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* =============================================================
   Step 3 — Calendar pager (one calendar per month, horizontal swipe)
   ============================================================= */

albumBack.addEventListener("click", () => {
  showView("detail");
  renderDetail();
});

prevMonthBtn.addEventListener("click", () => {
  scrollPagerTo(Math.max(0, state.activeMonth - 1), true);
});
nextMonthBtn.addEventListener("click", () => {
  scrollPagerTo(Math.min(MONTHS.length - 1, state.activeMonth + 1), true);
});

pager.addEventListener("scroll", () => {
  const w = pager.clientWidth || 1;
  const idx = Math.round(pager.scrollLeft / w);
  if (idx !== state.activeMonth) {
    state.activeMonth = idx;
    updateAlbumHeader();
  }
}, { passive: true });

function scrollPagerTo(idx, smooth) {
  const w = pager.clientWidth;
  pager.scrollTo({ left: idx * w, behavior: smooth ? "smooth" : "instant" });
  state.activeMonth = idx;
  updateAlbumHeader();
}

function updateAlbumHeader() {
  const idx = state.activeMonth;
  albumMonth.textContent = MONTHS[idx];
  albumYear.textContent = state.year;
  pagerLabel.textContent = `${String(idx + 1).padStart(2,"0")} / 12`;
}

function renderAlbum() {
  pager.innerHTML = "";
  state.months.forEach((m, idx) => {
    pager.appendChild(buildCalPage(m, idx));
  });
  updateAlbumHeader();
  // Ensure decor placement uses real cell rects after layout
  requestAnimationFrame(() => {
    pager.querySelectorAll(".cal-page").forEach(decoratePage);
  });
}

function buildCalPage(month, idx) {
  const page = document.createElement("section");
  page.className = "cal-page";
  page.dataset.monthIdx = idx;

  const daysInMonth = new Date(state.year, idx + 1, 0).getDate();
  // Mon = 0 ... Sun = 6
  const firstDay = (new Date(state.year, idx, 1).getDay() + 6) % 7;

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const cellsHtml = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDay + 1;
    const blank = dayNum < 1 || dayNum > daysInMonth;
    cellsHtml.push(`
      <div class="cal-cell ${blank ? "cal-cell--blank" : ""}" data-day="${blank ? "" : dayNum}">
        ${blank ? "" : `<span class="cal-num">${dayNum}</span>`}
      </div>
    `);
  }

  page.innerHTML = `
    <div class="cal-capture" data-capture>
      <img class="cal-bg" src="${bgForMonth(idx)}" alt=""
           onerror="this.onerror=null;this.src='${PLACEHOLDER_BG}'" />
      <div class="cal-bg__tint"></div>

      <div class="cal-card">
        <div class="cal-card__top">
          <span class="cal-card__icon" aria-hidden="true">‹</span>
          <span class="cal-card__crumb">${state.year}</span>
          <span class="cal-card__top-spacer"></span>
          <span class="cal-card__icon" aria-hidden="true">▤</span>
          <span class="cal-card__icon" aria-hidden="true">⌕</span>
          <span class="cal-card__icon" aria-hidden="true">+</span>
        </div>
        <h2 class="cal-card__title">${month.name} <em>moodboard</em></h2>
        <div class="cal-weekdays">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
        <div class="cal-grid">${cellsHtml.join("")}</div>
      </div>

      <div class="cal-decor" data-decor></div>
    </div>
  `;

  return page;
}

/* ---- Decoration placement (post-layout, uses real cell rects) ---- */

function decoratePage(pageEl) {
  const idx = +pageEl.dataset.monthIdx;
  const month = state.months[idx];
  const capture = pageEl.querySelector("[data-capture]");
  const decor = pageEl.querySelector("[data-decor]");
  if (!capture || !decor) return;
  decor.innerHTML = "";

  const capRect = capture.getBoundingClientRect();
  const W = capRect.width;
  const H = capRect.height;
  if (W < 10 || H < 10) return;

  const rng = rngFromSeed(idx * 1009 + (state.year % 100) * 31 + 7);

  // Polaroid base size scales with capture width
  const baseW = Math.max(78, Math.min(120, W * 0.24));

  month.photos.forEach((photo, i) => {
    let cx, cy;
    if (photo.day) {
      const cell = pageEl.querySelector(`.cal-cell[data-day="${photo.day}"]`);
      if (cell) {
        const r = cell.getBoundingClientRect();
        cx = r.left + r.width / 2 - capRect.left;
        cy = r.top  + r.height / 2 - capRect.top;
      } else {
        cx = 0.2 * W + 0.6 * W * rng();
        cy = 0.45 * H + 0.4 * H * rng();
      }
    } else {
      cx = 0.18 * W + 0.66 * W * rng();
      cy = 0.20 * H + 0.55 * H * rng();
    }
    const sizeJitter = 0.92 + rng() * 0.22;
    const w = baseW * sizeJitter;
    const h = w * 1.18;
    const tilt = (rng() - 0.5) * 16; // -8..+8
    const cap = photo.note && photo.note.trim()
      ? photo.note.trim()
      : (photo.day ? `${month.name.slice(0,3).toLowerCase()} ${photo.day}` : "");

    const x = cx - w / 2;
    const y = cy - h / 2;

    const fig = document.createElement("figure");
    fig.className = "polaroid draggable";
    fig.style.width  = `${w}px`;
    setTransform(fig, x, y, tilt);
    fig.dataset.x = x;
    fig.dataset.y = y;
    fig.dataset.r = tilt;
    fig.style.zIndex = 50 + i;
    const photoH = h - 33;

    const clipKind = ["top", "tl", "tr"][Math.floor(rng() * 3)];
    const clipSVG = rng() < 0.55 ? paperclipSVG() : binderClipSVG();

    fig.innerHTML = `
      <span class="clip clip--${clipKind}">${clipSVG}</span>
      <img src="${photo.url}" alt="" draggable="false" style="height:${photoH}px" />
      ${cap ? `<figcaption>${escapeHtml(cap)}</figcaption>` : ""}
      <button class="rot-handle" type="button" aria-label="Rotate" data-rot>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12a7 7 0 1 0 2.05-4.95M5 4v4h4" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;
    decor.appendChild(fig);
    attachDraggable(fig);
  });

  // ---- Auto-scattered stickers ----
  const stickerCount = 6 + Math.floor(rng() * 3);
  const placedPolaroidBoxes = [...decor.querySelectorAll(".polaroid")].map((el) => el.getBoundingClientRect());
  for (let i = 0; i < stickerCount; i++) {
    const emoji = STICKER_SET[(i + idx) % STICKER_SET.length];
    const size = 22 + Math.floor(rng() * 14);
    const x = 6 + rng() * (W - size - 12);
    const y = 60 + rng() * (H - size - 100);
    const tilt = (rng() - 0.5) * 30;
    const span = document.createElement("span");
    span.className = "sticker draggable";
    span.textContent = emoji;
    span.style.fontSize = `${size}px`;
    setTransform(span, x, y, tilt);
    span.dataset.x = x;
    span.dataset.y = y;
    span.dataset.r = tilt;
    span.style.zIndex = 40 + i;
    decor.appendChild(span);
    attachDraggable(span);
  }

  // Click empty space → deselect
  decor.addEventListener("pointerdown", (e) => {
    if (e.target === decor) deselectAll(pageEl);
  });
}

function setTransform(el, x, y, r) {
  el.style.left = "0";
  el.style.top  = "0";
  el.style.transform = `translate(${x}px, ${y}px) rotate(${(+r).toFixed(2)}deg)`;
}

function deselectAll(root) {
  root.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
}

/* ---- Drag + rotate (pointer events) ---- */

function attachDraggable(el) {
  el.addEventListener("pointerdown", (e) => {
    const isRot = e.target.closest("[data-rot]");
    if (isRot) {
      // Rotation drag
      startRotateDrag(el, e);
      return;
    }
    // Selection + move drag
    const page = el.closest(".cal-page");
    if (page) {
      deselectAll(page);
      el.classList.add("is-selected");
    }
    startMoveDrag(el, e);
  });
}

function startMoveDrag(el, ev) {
  ev.preventDefault();
  el.setPointerCapture?.(ev.pointerId);
  el.classList.add("is-dragging");
  const startX = ev.clientX;
  const startY = ev.clientY;
  const baseX = +el.dataset.x || 0;
  const baseY = +el.dataset.y || 0;
  const baseR = +el.dataset.r || 0;

  const onMove = (e) => {
    const nx = baseX + (e.clientX - startX);
    const ny = baseY + (e.clientY - startY);
    el.dataset.x = nx;
    el.dataset.y = ny;
    setTransform(el, nx, ny, baseR);
  };
  const onUp = (e) => {
    el.releasePointerCapture?.(e.pointerId);
    el.classList.remove("is-dragging");
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
  };
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
}

function startRotateDrag(el, ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const handle = ev.target.closest("[data-rot]") || ev.target;
  handle.setPointerCapture?.(ev.pointerId);
  el.classList.add("is-dragging");
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  const baseR = +el.dataset.r || 0;
  const baseAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;

  const onMove = (e) => {
    const ang = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    const nr = baseR + (ang - baseAngle);
    el.dataset.r = nr;
    setTransform(el, +el.dataset.x || 0, +el.dataset.y || 0, nr);
  };
  const onUp = (e) => {
    handle.releasePointerCapture?.(e.pointerId);
    el.classList.remove("is-dragging");
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onUp);
  };
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);
}

/* ---- SVG clip glyphs ---- */
function paperclipSVG() {
  return `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
    <path d="M9 4 v16 a4 4 0 0 0 8 0 v-13 a3 3 0 0 0 -6 0 v11 a2 2 0 0 0 4 0 v-9"
      fill="none" stroke="#a9a9a9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function binderClipSVG() {
  return `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
    <rect x="6" y="9" width="16" height="11" rx="1.2" fill="#1a1714" />
    <rect x="9" y="11" width="10" height="2" fill="#3b3733" />
    <path d="M9 9 l2 -4 h6 l2 4" fill="none" stroke="#1a1714" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function rngFromSeed(seed) {
  let s = (seed | 0) || 1;
  return function () {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =============================================================
   Image analysis (kept from previous versions, lightly trimmed)
   ============================================================= */

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
  let sumR=0,sumG=0,sumB=0,sumS=0,sumL=0,sumWC=0,sumWS=0,count=0;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
    if (a < 200) continue;
    sumR+=r; sumG+=g; sumB+=b;
    const { h, s, l } = rgbToHsl(r,g,b);
    sumS+=s; sumL+=l;
    const rad = ((h - 30) * Math.PI) / 180;
    sumWC += Math.cos(rad);
    sumWS += Math.sin(rad);
    const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5);
    const cur = buckets.get(key);
    if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.n += 1; }
    else buckets.set(key, { r, g, b, n: 1 });
    count++;
  }
  if (!count) return { palette: [[128,128,128]], paletteHex: ["#888"], avgRGB: [128,128,128], warm: 0.5, light: 0.5, sat: 0.5 };
  const warm = (sumWC / count + 1) / 2;
  const sat  = sumS / count;
  const light = sumL / count;
  const sorted = [...buckets.values()].sort((a,b) => b.n - a.n);
  const palette = [];
  for (const bk of sorted) {
    if (palette.length >= 5) break;
    const r = Math.round(bk.r / bk.n);
    const g = Math.round(bk.g / bk.n);
    const b = Math.round(bk.b / bk.n);
    if (!palette.some((p) => colorDistance(p, [r,g,b]) < 28)) palette.push([r,g,b]);
  }
  while (palette.length < 3) palette.push([Math.round(sumR/count), Math.round(sumG/count), Math.round(sumB/count)]);
  return {
    palette,
    paletteHex: palette.map(([r,g,b]) => rgbToHex(r,g,b)),
    avgRGB: [sumR/count, sumG/count, sumB/count],
    warm, sat, light,
  };
}

function colorDistance(a, b) {
  const dr = a[0]-b[0], dg = a[1]-b[1], db = a[2]-b[2];
  return Math.sqrt(dr*dr + dg*dg + db*db);
}
function rgbToHex(r,g,b) {
  return "#" + [r,g,b].map((v) => Math.max(0, Math.min(255, v|0)).toString(16).padStart(2,"0")).join("");
}
function rgbToHsl(r,g,b) {
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s; const l = (max+min)/2;
  if (max === min) { h=0; s=0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch (max) {
      case r: h = ((g-b)/d + (g<b ? 6 : 0)); break;
      case g: h = ((b-r)/d + 2); break;
      default: h = ((r-g)/d + 4);
    }
    h *= 60;
  }
  return { h, s, l };
}

/* =============================================================
   PNG export — current calendar page only
   ============================================================= */

albumExport.addEventListener("click", async () => {
  const page = pager.querySelectorAll(".cal-page")[state.activeMonth];
  if (!page) return;
  const node = page.querySelector("[data-capture]");
  if (!node || !window.html2canvas) {
    alert("Export library is still loading. Try again in a moment.");
    return;
  }
  const orig = albumExport.textContent;
  albumExport.disabled = true;
  albumExport.textContent = "Saving…";
  try {
    const canvas = await window.html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: (cloneDoc) => {
        const link = document.querySelector('link[href*="fonts.googleapis.com"]');
        if (link && !cloneDoc.querySelector('link[href*="fonts.googleapis.com"]')) {
          const l = cloneDoc.createElement("link");
          l.rel = "stylesheet";
          l.href = link.href;
          cloneDoc.head.appendChild(l);
        }
      },
    });
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    const m = state.months[state.activeMonth];
    a.download = `moodalbum-${m.name.toLowerCase()}.png`;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error("PNG export failed:", e);
    alert("Sorry, couldn't render that board to PNG.");
  } finally {
    albumExport.disabled = false;
    albumExport.textContent = orig;
  }
});

/* =============================================================
   Init
   ============================================================= */

renderMonths();
loadPlaceholders().then(() => {
  // Seed every month eagerly so each bento card shows its photo
  // (photo-01 → Jan … photo-12 → Dec) on first load, no tap required.
  for (let i = 0; i < MONTHS.length; i++) ensureSeeded(i);
  renderMonths();
});
