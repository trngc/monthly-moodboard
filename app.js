/* ================================================================
   MoodAlbum — vanilla JS
   - month-by-month upload
   - client-side colour & mood analysis
   - themed chapter generation
   - scroll-reveal + parallax
   ================================================================ */

(() => {
  "use strict";

  /* ---------------- Constants ---------------- */

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  /** Font pairings keyed by mood id. */
  const FONT_PAIRS = {
    warm: {
      serif: '"DM Serif Display", "Playfair Display", Georgia, serif',
      sans: '"Manrope", "Inter", system-ui, sans-serif',
    },
    moody: {
      serif: '"Playfair Display", "Fraunces", Georgia, serif',
      sans: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
    cool: {
      serif: '"Cormorant Garamond", "Fraunces", Georgia, serif',
      sans: '"Work Sans", "Inter", system-ui, sans-serif',
    },
    soft: {
      serif: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
      sans: '"Manrope", "Inter", system-ui, sans-serif',
    },
    vibrant: {
      serif: '"DM Serif Display", "Fraunces", Georgia, serif',
      sans: '"Inter", "Manrope", system-ui, sans-serif',
    },
    earthy: {
      serif: '"Fraunces", "EB Garamond", Georgia, serif',
      sans: '"Work Sans", "Inter", system-ui, sans-serif',
    },
  };

  /** Variant layout pool used to vary the editorial grid. */
  const CELL_VARIANTS = [
    "v-portrait",
    "v-square",
    "v-half",
    "v-third",
    "v-tall",
    "v-wide",
  ];

  /* ---------------- State ---------------- */

  /**
   * monthsData[i] = { photos: [ { id, file, url, thumb } ] }
   */
  const monthsData = MONTHS.map(() => ({ photos: [] }));

  let activeMonthIdx = null; // for the hidden file picker
  let photoIdCounter = 0;

  /* ---------------- DOM refs ---------------- */

  const $months = document.getElementById("months");
  const $generate = document.getElementById("generateBtn");
  const $reset = document.getElementById("resetBtn");
  const $ctaMeta = document.getElementById("ctaMeta");
  const $intro = document.getElementById("intro");
  const $album = document.getElementById("album");
  const $picker = document.getElementById("filePicker");
  const $loader = document.getElementById("loader");
  const $loaderBar = document.getElementById("loaderBar");
  const $loaderSub = document.getElementById("loaderSub");
  const $introYear = document.getElementById("introYear");

  $introYear.textContent = romanise(new Date().getFullYear());

  /* ---------------- Build month list ---------------- */

  function buildMonths() {
    const frag = document.createDocumentFragment();
    MONTHS.forEach((name, i) => {
      const li = document.createElement("li");
      li.className = "month";
      li.dataset.idx = String(i);
      li.innerHTML = `
        <div class="month__head">
          <span class="month__num">${String(i + 1).padStart(2, "0")} · Month</span>
          <span class="month__count" data-count>—</span>
        </div>
        <h3 class="month__name">${name.slice(0, 3)}<em>${name.slice(3)}</em></h3>
        <div class="month__thumbs" data-thumbs hidden></div>
        <button type="button" class="month__drop" data-drop>
          <span class="month__drop-label">Drop or tap to add</span>
        </button>
      `;
      frag.appendChild(li);
    });
    $months.appendChild(frag);
  }

  buildMonths();

  /* ---------------- Upload wiring ---------------- */

  $months.addEventListener("click", (e) => {
    const drop = e.target.closest("[data-drop]");
    if (!drop) return;
    const idx = Number(drop.closest(".month").dataset.idx);
    activeMonthIdx = idx;
    $picker.value = "";
    $picker.click();
  });

  $months.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove]");
    if (!rm) return;
    e.stopPropagation();
    const monthEl = rm.closest(".month");
    const idx = Number(monthEl.dataset.idx);
    const pid = rm.dataset.remove;
    const m = monthsData[idx];
    const before = m.photos.length;
    m.photos = m.photos.filter((p) => {
      if (String(p.id) === pid) {
        URL.revokeObjectURL(p.url);
        return false;
      }
      return true;
    });
    if (m.photos.length !== before) renderMonth(idx);
    updateCTA();
  });

  $picker.addEventListener("change", () => {
    if (activeMonthIdx == null) return;
    const files = Array.from($picker.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    addPhotos(activeMonthIdx, files);
    activeMonthIdx = null;
  });

  // Drag-and-drop on each month, plus a global handler so dropping anywhere
  // on the intro shows the "drop here" affordance.
  $months.addEventListener("dragover", (e) => {
    const monthEl = e.target.closest(".month");
    if (!monthEl) return;
    e.preventDefault();
    monthEl.classList.add("is-drop");
  });
  $months.addEventListener("dragleave", (e) => {
    const monthEl = e.target.closest(".month");
    if (!monthEl) return;
    if (!monthEl.contains(e.relatedTarget)) monthEl.classList.remove("is-drop");
  });
  $months.addEventListener("drop", (e) => {
    const monthEl = e.target.closest(".month");
    if (!monthEl) return;
    e.preventDefault();
    monthEl.classList.remove("is-drop");
    const idx = Number(monthEl.dataset.idx);
    const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    addPhotos(idx, files);
  });

  // Prevent accidental drops outside from navigating away.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  function addPhotos(idx, files) {
    if (!files.length) return;
    files.forEach((file) => {
      const photo = {
        id: ++photoIdCounter,
        file,
        url: URL.createObjectURL(file),
      };
      monthsData[idx].photos.push(photo);
    });
    renderMonth(idx);
    updateCTA();
  }

  function renderMonth(idx) {
    const m = monthsData[idx];
    const li = $months.children[idx];
    const thumbs = li.querySelector("[data-thumbs]");
    const count = li.querySelector("[data-count]");
    const drop = li.querySelector(".month__drop-label");

    count.textContent =
      m.photos.length === 0
        ? "—"
        : m.photos.length === 1
          ? "1 photo"
          : `${m.photos.length} photos`;

    if (m.photos.length) {
      li.classList.add("has-photos");
      thumbs.hidden = false;
      thumbs.innerHTML = m.photos
        .slice(0, 8)
        .map(
          (p) => `
            <div class="month__thumb">
              <img src="${p.url}" alt="" loading="lazy" />
              <button type="button" class="month__thumb-remove" data-remove="${p.id}" aria-label="Remove photo">×</button>
            </div>
          `
        )
        .join("");
      drop.textContent = "Add more";
    } else {
      li.classList.remove("has-photos");
      thumbs.hidden = true;
      thumbs.innerHTML = "";
      drop.textContent = "Drop or tap to add";
    }
  }

  function updateCTA() {
    const populated = monthsData.filter((m) => m.photos.length > 0);
    const totalPhotos = populated.reduce((s, m) => s + m.photos.length, 0);
    const ok = populated.length >= 1;
    $generate.disabled = !ok;
    $generate.setAttribute("aria-disabled", String(!ok));
    if (!ok) {
      $ctaMeta.textContent = "add photos to begin";
    } else {
      $ctaMeta.textContent = `${populated.length} ${
        populated.length === 1 ? "chapter" : "chapters"
      } · ${totalPhotos} ${totalPhotos === 1 ? "photo" : "photos"}`;
    }
    $reset.hidden = totalPhotos === 0;
  }

  $reset.addEventListener("click", () => {
    monthsData.forEach((m, i) => {
      m.photos.forEach((p) => URL.revokeObjectURL(p.url));
      m.photos = [];
      renderMonth(i);
    });
    updateCTA();
  });

  /* ---------------- Compose flow ---------------- */

  $generate.addEventListener("click", async () => {
    const populated = monthsData
      .map((m, i) => ({ idx: i, name: MONTHS[i], photos: m.photos }))
      .filter((m) => m.photos.length > 0);
    if (!populated.length) return;

    showLoader(true);
    try {
      const chapters = [];
      let done = 0;
      const total = populated.reduce((s, m) => s + m.photos.length, 0);
      for (const month of populated) {
        setLoader(`reading ${month.name.toLowerCase()}…`, done, total);
        const analysed = [];
        for (const photo of month.photos) {
          // eslint-disable-next-line no-await-in-loop
          const a = await analysePhoto(photo);
          analysed.push(a);
          done += 1;
          setLoader(`reading ${month.name.toLowerCase()}…`, done, total);
        }
        const summary = summariseMonth(analysed);
        chapters.push({
          name: month.name,
          idx: month.idx,
          photos: month.photos,
          analysed,
          summary,
        });
      }
      setLoader("composing the issue…", total, total);
      await sleep(420);
      renderAlbum(chapters);
    } finally {
      showLoader(false);
    }
  });

  /* ---------------- Loader UI ---------------- */

  function showLoader(on) {
    $loader.hidden = !on;
    $loader.setAttribute("aria-hidden", String(!on));
    if (on) setLoader("sampling colour…", 0, 1);
  }

  function setLoader(sub, done, total) {
    $loaderSub.textContent = sub;
    const pct = total ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
    $loaderBar.style.right = `${100 - pct}%`;
  }

  /* ================================================================
     COLOUR & MOOD ANALYSIS
     ================================================================ */

  /**
   * Load a File into an HTMLImageElement (decoded).
   */
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Sample pixels of an image into a small canvas and return:
   * - palette: top-N quantised colours (sorted by frequency)
   * - average HSL (excluding near-black / near-white)
   * - tone metrics
   */
  async function analysePhoto(photo) {
    const img = await loadImage(photo.url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // sample to a small square — fast + cache-friendly
    const SAMPLE = 96;
    const ratio = Math.max(SAMPLE / w, SAMPLE / h);
    const sw = Math.max(8, Math.round(w * ratio));
    const sh = Math.max(8, Math.round(h * ratio));

    const c = document.createElement("canvas");
    c.width = sw;
    c.height = sh;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;

    // Quantise: bin by (R>>4, G>>4, B>>4)  → 16^3 buckets.
    const buckets = new Map();
    let sumH_x = 0,
      sumH_y = 0,
      sumS = 0,
      sumL = 0,
      countMid = 0,
      countAll = 0,
      darkPixels = 0,
      brightPixels = 0,
      satPixels = 0;

    const step = 4; // every pixel
    for (let i = 0; i < data.length; i += step * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 250) continue;
      countAll += 1;

      const [hh, ss, ll] = rgbToHsl(r, g, b);

      // global brightness/saturation buckets (whole image)
      if (ll < 0.15) darkPixels += 1;
      if (ll > 0.85) brightPixels += 1;
      if (ss > 0.5) satPixels += 1;

      // palette: skip very dark / very light / very dull pixels so the
      // dominant colours actually reflect content
      const usable = ll > 0.06 && ll < 0.96 && ss > 0.04;
      if (!usable) continue;

      const key =
        ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); // 12-bit key
      const ex = buckets.get(key);
      if (ex) {
        ex.count += 1;
        ex.r += r;
        ex.g += g;
        ex.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }

      // accumulate mean hue using vector average (cos/sin of hue degrees)
      // weight mid-saturation pixels more than greys.
      if (ss > 0.06) {
        const hueRad = hh * Math.PI * 2;
        sumH_x += Math.cos(hueRad) * ss;
        sumH_y += Math.sin(hueRad) * ss;
        sumS += ss;
        sumL += ll;
        countMid += 1;
      }
    }

    // Build palette: pick top buckets, merge similar ones
    const palette = Array.from(buckets.values())
      .map((b) => ({
        count: b.count,
        r: Math.round(b.r / b.count),
        g: Math.round(b.g / b.count),
        b: Math.round(b.b / b.count),
      }))
      .sort((a, b) => b.count - a.count);

    const top = mergeSimilar(palette, 28).slice(0, 6);

    const meanS = countMid ? sumS / countMid : 0;
    const meanL = countMid ? sumL / countMid : 0;
    const meanHueDeg =
      countMid && (sumH_x !== 0 || sumH_y !== 0)
        ? ((Math.atan2(sumH_y, sumH_x) * 180) / Math.PI + 360) % 360
        : 0;

    return {
      photo,
      width: w,
      height: h,
      palette: top,
      meanHue: meanHueDeg,
      meanSat: meanS,
      meanLight: meanL,
      darkRatio: countAll ? darkPixels / countAll : 0,
      brightRatio: countAll ? brightPixels / countAll : 0,
      satRatio: countAll ? satPixels / countAll : 0,
    };
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    const l = (max + min) / 2;
    const d = max - min;
    let s = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r:
          h = ((g - b) / d) % 6;
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h / 360, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 1) + 1) % 1;
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = hueToRgb(p, q, h + 1 / 3);
    const g = hueToRgb(p, q, h);
    const b = hueToRgb(p, q, h - 1 / 3);
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  /** Merge palette entries whose RGB distance is below threshold. */
  function mergeSimilar(list, threshold) {
    const out = [];
    for (const c of list) {
      const m = out.find((o) => {
        const dr = o.r - c.r;
        const dg = o.g - c.g;
        const db = o.b - c.b;
        return Math.sqrt(dr * dr + dg * dg + db * db) < threshold;
      });
      if (m) {
        const total = m.count + c.count;
        m.r = Math.round((m.r * m.count + c.r * c.count) / total);
        m.g = Math.round((m.g * m.count + c.g * c.count) / total);
        m.b = Math.round((m.b * m.count + c.b * c.count) / total);
        m.count = total;
      } else {
        out.push({ ...c });
      }
    }
    return out;
  }

  /* ---------------- Month summary & mood ---------------- */

  function summariseMonth(analysed) {
    // Aggregate palette by frequency * image weight, then merge.
    const all = [];
    analysed.forEach((p) => {
      const w = 1 / Math.max(1, p.palette.length);
      p.palette.forEach((c, i) => {
        all.push({
          r: c.r,
          g: c.g,
          b: c.b,
          count: c.count * w * (1 - i * 0.08),
        });
      });
    });
    const palette = mergeSimilar(
      all.sort((a, b) => b.count - a.count),
      32
    ).slice(0, 6);

    // Hue mean via vector average across photos.
    let hx = 0,
      hy = 0,
      ws = 0;
    let meanS = 0,
      meanL = 0,
      darkR = 0,
      brightR = 0,
      satR = 0;
    analysed.forEach((p) => {
      const w = Math.max(0.1, p.meanSat);
      const hueRad = (p.meanHue * Math.PI) / 180;
      hx += Math.cos(hueRad) * w;
      hy += Math.sin(hueRad) * w;
      ws += w;
      meanS += p.meanSat;
      meanL += p.meanLight;
      darkR += p.darkRatio;
      brightR += p.brightRatio;
      satR += p.satRatio;
    });
    const n = analysed.length;
    meanS /= n;
    meanL /= n;
    darkR /= n;
    brightR /= n;
    satR /= n;
    const meanHueDeg =
      ws > 0 ? ((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360 : 0;

    const mood = pickMood({
      hue: meanHueDeg,
      sat: meanS,
      light: meanL,
      darkR,
      brightR,
      satR,
    });

    return {
      palette,
      meanHue: meanHueDeg,
      meanSat: meanS,
      meanLight: meanL,
      darkRatio: darkR,
      brightRatio: brightR,
      satRatio: satR,
      mood,
    };
  }

  /**
   * Pick a mood id + display label from aggregated metrics.
   * The thresholds are tuned to behave well across very different image sets.
   */
  function pickMood(m) {
    const { hue, sat, light, darkR, brightR } = m;
    const warmHue = hue < 70 || hue > 320; // reds, oranges, yellows
    const coolHue = hue >= 170 && hue <= 260; // teals, blues
    const greenHue = hue >= 70 && hue < 170;

    if (darkR > 0.28 && light < 0.42) {
      return {
        id: "moody",
        label: "Moody",
        sub: "Editorial",
        adjective: "after-hours",
      };
    }
    if (sat < 0.18 && light > 0.55) {
      return {
        id: "cool",
        label: "Cool",
        sub: "Minimal",
        adjective: "quiet",
      };
    }
    if (sat < 0.22 && light < 0.5) {
      return {
        id: "moody",
        label: "Hushed",
        sub: "Editorial",
        adjective: "smoke",
      };
    }
    if (warmHue && light > 0.45 && sat > 0.28) {
      return {
        id: "warm",
        label: "Golden",
        sub: "Warm",
        adjective: "sunlit",
      };
    }
    if (warmHue && light < 0.5) {
      return {
        id: "earthy",
        label: "Ember",
        sub: "Earthy",
        adjective: "low-burn",
      };
    }
    if (greenHue && sat > 0.2) {
      return {
        id: "earthy",
        label: "Verdant",
        sub: "Botanical",
        adjective: "leaf-light",
      };
    }
    if (coolHue && light > 0.5) {
      return {
        id: "cool",
        label: "Glacial",
        sub: "Cool",
        adjective: "open-air",
      };
    }
    if (coolHue) {
      return {
        id: "moody",
        label: "Nocturne",
        sub: "Editorial",
        adjective: "after-dark",
      };
    }
    if (sat > 0.45 && brightR > 0.15) {
      return {
        id: "vibrant",
        label: "Vivid",
        sub: "Bold",
        adjective: "high-key",
      };
    }
    if (sat < 0.3 && light > 0.65) {
      return {
        id: "soft",
        label: "Dreamy",
        sub: "Soft",
        adjective: "powdered",
      };
    }
    return {
      id: "soft",
      label: "Soft",
      sub: "Dreamy",
      adjective: "diffused",
    };
  }

  /* ================================================================
     RENDER ALBUM
     ================================================================ */

  function renderAlbum(chapters) {
    $album.innerHTML = "";
    chapters.forEach((ch, i) => {
      $album.appendChild(buildChapter(ch, i, chapters.length));
    });
    $album.appendChild(buildFoot(chapters));
    $intro.hidden = true;
    $album.hidden = false;
    $album.classList.add("is-on");
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Re-init effects on the new content.
    requestAnimationFrame(() => {
      initReveal();
      initParallax();
    });
  }

  function buildChapter(ch, i, total) {
    const { palette, mood } = ch.summary;
    const theme = buildTheme(ch.summary);
    const section = document.createElement("section");
    section.className = `chapter ${theme.darkText ? "chapter--dark" : ""}`;
    section.style.setProperty("--chapter-bg", theme.bg);
    section.style.setProperty("--chapter-veil", theme.veil);
    section.style.setProperty("--ch-serif", theme.fonts.serif);
    section.style.setProperty("--ch-sans", theme.fonts.sans);
    section.dataset.idx = String(i);

    const monthNum = ch.idx + 1;
    const number = String(monthNum).padStart(2, "0");

    // Pick a hero photo — prefer the most saturated / brightest balanced one.
    const hero = pickHero(ch.analysed);
    const others = ch.photos.filter((p) => p.id !== hero.photo.id);
    const cells = layoutCells(others);

    section.innerHTML = `
      <header class="chapter__masthead">
        <div>
          <div class="chapter__meta reveal">
            <span>Chapter ${romanise(i + 1)} of ${romanise(total)}</span>
            <span class="dot"></span>
            <span>${number} · ${ch.name}</span>
          </div>
          <h2 class="chapter__month reveal delay-1">${ch.name}</h2>
        </div>
        <div>
          <p class="chapter__mood reveal delay-2">
            ${mood.label}<span style="opacity:.6"> / </span><em>${mood.sub}</em>
            <small>The light reads ${mood.adjective} — ${describeMetrics(ch.summary)}</small>
          </p>
          <div class="chapter__palette reveal delay-3">
            ${palette
              .slice(0, 6)
              .map(
                (c) =>
                  `<span style="background:rgb(${c.r},${c.g},${c.b})"></span>`
              )
              .join("")}
          </div>
        </div>
      </header>

      <figure class="chapter__hero reveal" data-parallax>
        <img src="${hero.photo.url}" alt="${ch.name} hero" />
        <figcaption class="chapter__caption">${ch.name} · 01</figcaption>
      </figure>

      ${
        cells.length
          ? `<div class="chapter__grid">
              ${cells
                .map(
                  (cell, idx) => `
                  <figure class="chapter__cell ${cell.variant} reveal ${
                    "delay-" + ((idx % 4) + 1)
                  }">
                    <img src="${cell.photo.url}" alt="${ch.name} ${idx + 2}" loading="lazy" />
                  </figure>
                `
                )
                .join("")}
            </div>`
          : `<hr class="chapter__rule reveal" />`
      }
    `;
    return section;
  }

  function describeMetrics(s) {
    const parts = [];
    if (s.meanSat < 0.2) parts.push("low saturation");
    else if (s.meanSat > 0.5) parts.push("rich saturation");
    else parts.push("balanced saturation");
    if (s.meanLight < 0.4) parts.push("deep tone");
    else if (s.meanLight > 0.7) parts.push("airy tone");
    else parts.push("mid-key tone");
    return parts.join(", ");
  }

  /** Build a theme (background gradient, text contrast, fonts) from summary. */
  function buildTheme(summary) {
    const sorted = summary.palette.slice().sort((a, b) => b.count - a.count);
    const a = sorted[0] || { r: 230, g: 220, b: 205 };
    const b = sorted[1] || a;
    const c = sorted[2] || b;

    // Decide darkness from mean luminance of top colors
    const lum = relLum(a);
    const dark = summary.darkRatio > 0.32 || summary.meanLight < 0.36;

    const bg = dark
      ? buildDarkBg(a, b, c)
      : buildLightBg(a, b, c, summary.meanLight);

    const veil = `rgba(${a.r},${a.g},${a.b},0.18)`;
    // Use light text only when the rendered background is genuinely dark.
    // (The dominant-colour luminance alone can be low — e.g. a warm sunset
    // sample — even while the background is washed light with paper.)
    const darkText = dark;
    const fonts = FONT_PAIRS[summary.mood.id] || FONT_PAIRS.soft;

    return { bg, veil, darkText, fonts };
  }

  function buildLightBg(a, b, c, meanLight) {
    // Wash the paper with the palette — keep it editorial, not loud.
    const tintA = mixWithPaper(a, 0.82);
    const tintB = mixWithPaper(b, 0.7);
    const tintC = mixWithPaper(c, 0.78);
    const baseLight = Math.min(0.95, Math.max(0.85, 0.88 + meanLight * 0.05));
    return `
      radial-gradient(120% 80% at 90% 0%, ${rgba(b, 0.55)}, transparent 60%),
      radial-gradient(90% 70% at 0% 100%, ${rgba(c, 0.45)}, transparent 60%),
      linear-gradient(180deg, ${rgb(tintA)} 0%, ${rgb(tintB)} 55%, ${rgb(tintC)} 100%),
      hsl(40, 18%, ${Math.round(baseLight * 100)}%)
    `;
  }

  function buildDarkBg(a, b, c) {
    // Crushed to the darks — moody, editorial.
    const darkA = darken(a, 0.78);
    const darkB = darken(b, 0.7);
    const darkC = darken(c, 0.82);
    return `
      radial-gradient(120% 80% at 80% 0%, ${rgba(a, 0.5)}, transparent 60%),
      radial-gradient(90% 70% at 10% 100%, ${rgba(b, 0.4)}, transparent 60%),
      linear-gradient(180deg, ${rgb(darkA)} 0%, ${rgb(darkB)} 55%, ${rgb(darkC)} 100%)
    `;
  }

  function mixWithPaper(c, t) {
    const paper = { r: 245, g: 241, b: 234 };
    return {
      r: Math.round(paper.r * t + c.r * (1 - t)),
      g: Math.round(paper.g * t + c.g * (1 - t)),
      b: Math.round(paper.b * t + c.b * (1 - t)),
    };
  }

  function darken(c, t) {
    const ink = { r: 22, g: 20, b: 16 };
    return {
      r: Math.round(ink.r * t + c.r * (1 - t)),
      g: Math.round(ink.g * t + c.g * (1 - t)),
      b: Math.round(ink.b * t + c.b * (1 - t)),
    };
  }

  function rgb(c) {
    return `rgb(${c.r},${c.g},${c.b})`;
  }
  function rgba(c, a) {
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }

  /** Relative luminance (sRGB). */
  function relLum({ r, g, b }) {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  /** Choose a hero photo: prefer mid-bright, well-saturated, well-balanced. */
  function pickHero(analysed) {
    let best = analysed[0];
    let bestScore = -Infinity;
    for (const a of analysed) {
      const s =
        a.meanSat * 1.4 +
        (1 - Math.abs(a.meanLight - 0.55)) * 1.0 +
        (a.brightRatio - a.darkRatio) * 0.4;
      if (s > bestScore) {
        bestScore = s;
        best = a;
      }
    }
    return best;
  }

  /**
   * Build a layout sequence of cells with editorial rhythm.
   * Each chunk's spans sum to 6, so desktop rows always fill cleanly;
   * partial trailing chunks are auto-completed.
   */
  function layoutCells(photos) {
    if (!photos.length) return [];

    // Each row chunk sums to 6 column-spans.
    const chunks = [
      ["v-portrait", "v-half"], // 3 + 3
      ["v-third", "v-third", "v-third"], // 2 + 2 + 2
      ["v-half", "v-half"], // 3 + 3
      ["v-wide"], // 6
      ["v-third", "v-third", "v-third"], // 2 + 2 + 2
    ];

    const fitTo = (n) => {
      // Tail-fit helpers that still sum to 6.
      if (n === 1) return ["v-wide"];
      if (n === 2) return ["v-half", "v-half"];
      if (n === 3) return ["v-third", "v-third", "v-third"];
      if (n === 4) return ["v-portrait", "v-third", "v-third", "v-half"]; // 3+2+2+3 (rows wrap)
      return null;
    };

    const cells = [];
    let i = 0;
    let ci = 0;
    while (i < photos.length) {
      const left = photos.length - i;
      let chunk = chunks[ci % chunks.length];
      if (left < chunk.length) {
        chunk = fitTo(left) || chunk.slice(0, left);
      }
      chunk.forEach((variant) => {
        if (i < photos.length) cells.push({ photo: photos[i++], variant });
      });
      ci += 1;
    }
    return cells;
  }

  function buildFoot(chapters) {
    const wrap = document.createElement("footer");
    wrap.className = "album__foot";
    wrap.innerHTML = `
      <p class="reveal">— Fin —</p>
      <h2 class="reveal delay-1">A year, told in light.</h2>
      <p class="reveal delay-2">${chapters.length} ${
        chapters.length === 1 ? "chapter" : "chapters"
      } · ${chapters.reduce((s, c) => s + c.photos.length, 0)} photographs</p>
      <button type="button" class="reveal delay-3" id="backBtn">Compose a new album</button>
    `;
    wrap.querySelector("#backBtn").addEventListener("click", () => {
      $album.hidden = true;
      $intro.hidden = false;
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    return wrap;
  }

  /* ================================================================
     SCROLL EFFECTS
     ================================================================ */

  let revealObs = null;
  function initReveal() {
    if (revealObs) revealObs.disconnect();
    revealObs = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (ent.isIntersecting) {
            ent.target.classList.add("is-in");
            revealObs.unobserve(ent.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    $album.querySelectorAll(".reveal").forEach((el) => revealObs.observe(el));
  }

  let parallaxTargets = [];
  let parallaxRaf = 0;
  function initParallax() {
    parallaxTargets = Array.from($album.querySelectorAll("[data-parallax]"));
    window.removeEventListener("scroll", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.removeEventListener("resize", onScroll);
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  function onScroll() {
    if (parallaxRaf) return;
    parallaxRaf = requestAnimationFrame(() => {
      parallaxRaf = 0;
      const vh = window.innerHeight;
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      // Hero parallax
      parallaxTargets.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const center = rect.top + rect.height / 2;
        const t = (center - vh / 2) / vh; // -1..1
        const img = el.querySelector("img");
        if (img) {
          const offset = reduce ? 0 : -t * 60; // px
          img.style.setProperty("--parallax", `${offset}px`);
        }
      });

      // Page-flip feel: chapter scaling/opacity as it leaves the viewport.
      const chapters = $album.querySelectorAll(".chapter");
      chapters.forEach((ch) => {
        if (reduce) {
          ch.style.transform = "";
          ch.style.filter = "";
          return;
        }
        const rect = ch.getBoundingClientRect();
        if (rect.bottom < -300 || rect.top > vh + 300) return;
        // progress: -1 when fully above, 0 when centered, +1 when fully below
        const p = (rect.top + rect.height / 2 - vh / 2) / vh;
        if (p < -0.4) {
          // chapter is scrolling away upward — slight scale + dim
          const k = Math.min(1, (-p - 0.4) / 0.9);
          const scale = 1 - k * 0.05;
          const blur = k * 1.2;
          ch.style.transform = `scale(${scale})`;
          ch.style.filter = `brightness(${1 - k * 0.25}) blur(${blur}px)`;
        } else {
          ch.style.transform = "";
          ch.style.filter = "";
        }
      });
    });
  }

  /* ---------------- Helpers ---------------- */

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function romanise(num) {
    const map = [
      ["M", 1000],
      ["CM", 900],
      ["D", 500],
      ["CD", 400],
      ["C", 100],
      ["XC", 90],
      ["L", 50],
      ["XL", 40],
      ["X", 10],
      ["IX", 9],
      ["V", 5],
      ["IV", 4],
      ["I", 1],
    ];
    let n = num;
    let out = "";
    for (const [r, v] of map) {
      while (n >= v) {
        out += r;
        n -= v;
      }
    }
    return out;
  }

  updateCTA();
})();
