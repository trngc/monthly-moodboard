/*
 * End-to-end exercise of MoodAlbum:
 *  - opens the app in a phone-shaped viewport
 *  - uploads sample photos to January, June, November
 *  - generates the album
 *  - scrolls smoothly through every chapter while recording video
 *  - takes detailed screenshots along the way
 *
 * Run after `python3 -m http.server 8080` is up in /workspace.
 */
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

const ROOT = path.join(__dirname, "..");
const SAMPLES = path.join(__dirname, "samples");
const SHOTS = path.join(ROOT, "screenshots");
const VIDEOS = path.join(ROOT, "videos");

fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });

const PORT = process.env.PORT || 8080;
const URL = `http://localhost:${PORT}/`;

const phone = devices["iPhone 13 Pro"];

async function uploadFor(page, monthIndex, files) {
  await page.evaluate(({ idx, names }) => {
    const liList = document.querySelectorAll("#months .month");
    const li = liList[idx];
    li.scrollIntoView({ block: "center" });
    window.__lastTargetIdx = idx;
  }, { idx: monthIndex, names: files.map((f) => path.basename(f)) });

  // expose the file input via a single fileChooser interaction
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.evaluate((idx) => {
      const li = document.querySelectorAll("#months .month")[idx];
      li.querySelector("[data-drop]").click();
    }, monthIndex),
  ]);
  await chooser.setFiles(files);
  // small wait for thumbs to render
  await page.waitForTimeout(250);
}

async function smoothScroll(page, fromY, toY, durationMs) {
  await page.evaluate(
    async ({ fromY, toY, durationMs }) => {
      return new Promise((resolve) => {
        const start = performance.now();
        function step(t) {
          const k = Math.min(1, (t - start) / durationMs);
          const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          window.scrollTo(0, fromY + (toY - fromY) * ease);
          if (k < 1) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      });
    },
    { fromY, toY, durationMs }
  );
}

(async () => {
  const browser = await chromium.launch();

  /* ---------- PHONE (vertical) — main recording ---------- */
  {
    const ctx = await browser.newContext({
      ...phone,
      recordVideo: { dir: VIDEOS, size: { width: 390, height: 844 } },
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    await page.screenshot({
      path: path.join(SHOTS, "01-intro-phone.png"),
      fullPage: false,
    });

    await page.screenshot({
      path: path.join(SHOTS, "02-intro-phone-full.png"),
      fullPage: true,
    });

    // Upload to Jan, Jun, Nov
    const jan = [1, 2, 3, 4].map((n) => path.join(SAMPLES, `jan-${n}.jpg`));
    const jun = [1, 2, 3, 4].map((n) => path.join(SAMPLES, `jun-${n}.jpg`));
    const nov = [1, 2, 3, 4].map((n) => path.join(SAMPLES, `nov-${n}.jpg`));
    await uploadFor(page, 0, jan);
    await uploadFor(page, 5, jun);
    await uploadFor(page, 10, nov);

    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SHOTS, "03-composer-filled-phone.png"),
      fullPage: true,
    });

    // Generate
    await page.locator("#generateBtn").click();
    await page.waitForFunction(
      () => document.getElementById("loader").hidden === true,
      null,
      { timeout: 30000 }
    );
    await page.waitForTimeout(700);

    // First chapter view
    await page.screenshot({
      path: path.join(SHOTS, "04-chapter1-phone.png"),
      fullPage: false,
    });

    // Smooth scroll through everything for the video
    const totalH = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    const vh = await page.evaluate(() => window.innerHeight);
    const target = totalH - vh;
    await smoothScroll(page, 0, target, 9000);
    await page.waitForTimeout(600);

    // Capture a full-page snapshot at the end
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SHOTS, "05-album-fullpage-phone.png"),
      fullPage: true,
    });

    const video = page.video();
    await ctx.close();
    if (video) {
      const src = await video.path();
      const dst = path.join(VIDEOS, "moodalbum-phone.webm");
      try {
        fs.renameSync(src, dst);
      } catch {
        fs.copyFileSync(src, dst);
      }
      console.log("video:", dst);
    }
  }

  /* ---------- DESKTOP — beauty screenshots ---------- */
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    await page.screenshot({
      path: path.join(SHOTS, "10-intro-desktop.png"),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(SHOTS, "11-intro-desktop-full.png"),
      fullPage: true,
    });

    const jan = [1, 2, 3, 4].map((n) => path.join(SAMPLES, `jan-${n}.jpg`));
    const jun = [1, 2, 3, 4].map((n) => path.join(SAMPLES, `jun-${n}.jpg`));
    const nov = [1, 2, 3, 4].map((n) => path.join(SAMPLES, `nov-${n}.jpg`));
    await uploadFor(page, 0, jan);
    await uploadFor(page, 5, jun);
    await uploadFor(page, 10, nov);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SHOTS, "12-composer-filled-desktop.png"),
      fullPage: true,
    });

    await page.locator("#generateBtn").click();
    await page.waitForFunction(
      () => document.getElementById("loader").hidden === true,
      null,
      { timeout: 30000 }
    );
    await page.waitForTimeout(700);

    await page.screenshot({
      path: path.join(SHOTS, "13-chapter1-desktop.png"),
      fullPage: false,
    });
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(SHOTS, "14-chapter1-mid-desktop.png"),
      fullPage: false,
    });
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.3));
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(SHOTS, "15-chapter2-desktop.png"),
      fullPage: false,
    });
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.6));
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(SHOTS, "16-chapter3-desktop.png"),
      fullPage: false,
    });

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(SHOTS, "17-album-fullpage-desktop.png"),
      fullPage: true,
    });

    // Pull metrics from the page for the report
    const moods = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".chapter")).map((c) => ({
        month: c.querySelector(".chapter__month")?.textContent?.trim(),
        mood: c.querySelector(".chapter__mood")?.innerText?.trim(),
        bg: getComputedStyle(c).getPropertyValue("--chapter-bg").trim(),
        dark: c.classList.contains("chapter--dark"),
      }))
    );
    fs.writeFileSync(
      path.join(ROOT, "screenshots", "moods.json"),
      JSON.stringify(moods, null, 2)
    );
    console.log("MOODS:", JSON.stringify(moods, null, 2));

    await ctx.close();
  }

  await browser.close();
  console.log("done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
