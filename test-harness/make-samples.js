/*
 * Generate sample photographs as JPEGs so the test script can upload them.
 * Each "month" gets photos with a distinctive tonal palette so MoodAlbum's
 * mood detector has to choose differently per month.
 *
 * We use the headless Chromium that's already installed (via Playwright) to
 * render a canvas to a JPEG file — this avoids needing image libraries
 * (sharp, jimp, etc) at install time.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT = path.join(__dirname, "samples");
fs.mkdirSync(OUT, { recursive: true });

const SETS = [
  // January — golden / warm sunset tones
  {
    month: "jan",
    photos: [
      {
        type: "gradient",
        colors: ["#3a1d10", "#a8501d", "#e89a3c", "#f4d27d"],
        accents: [
          { kind: "sun", x: 0.7, y: 0.32, r: 120, color: "#fff5cc" },
        ],
      },
      {
        type: "gradient",
        colors: ["#5b2510", "#c66a26", "#e8a85a"],
        accents: [{ kind: "horizon", color: "#8c3a18" }],
      },
      {
        type: "gradient",
        colors: ["#7a3015", "#cc7837", "#f1c172"],
        accents: [
          { kind: "speck", count: 30, color: "rgba(255,220,160,0.5)" },
        ],
      },
      {
        type: "gradient",
        colors: ["#2e1208", "#9b4519", "#e0913a", "#fbe6b0"],
        accents: [{ kind: "sun", x: 0.4, y: 0.45, r: 90, color: "#fff2c0" }],
      },
    ],
  },
  // June — moody / editorial dusk
  {
    month: "jun",
    photos: [
      {
        type: "gradient",
        colors: ["#0c0e12", "#1a1d24", "#2a2e3a", "#3a3f4f"],
        accents: [{ kind: "speck", count: 40, color: "rgba(180,180,200,0.18)" }],
      },
      {
        type: "gradient",
        colors: ["#070708", "#171821", "#262834"],
        accents: [
          { kind: "horizon", color: "#0a0a0c" },
        ],
      },
      {
        type: "gradient",
        colors: ["#0a0c10", "#1c1f2a", "#363b4a"],
        accents: [
          { kind: "sun", x: 0.65, y: 0.78, r: 80, color: "rgba(200,160,120,0.35)" },
        ],
      },
      {
        type: "gradient",
        colors: ["#0d0e12", "#202330", "#3a3f50"],
        accents: [],
      },
    ],
  },
  // November — cool / minimal grey-blue
  {
    month: "nov",
    photos: [
      {
        type: "gradient",
        colors: ["#cfd6dc", "#e6ebef", "#f3f5f7"],
        accents: [],
      },
      {
        type: "gradient",
        colors: ["#b9c3cb", "#d8dfe5", "#eef1f4"],
        accents: [{ kind: "horizon", color: "#a8b4be" }],
      },
      {
        type: "gradient",
        colors: ["#aebac3", "#cdd5dc", "#e7ecef"],
        accents: [
          { kind: "speck", count: 20, color: "rgba(255,255,255,0.25)" },
        ],
      },
      {
        type: "gradient",
        colors: ["#9eaab4", "#c5cdd4", "#e1e6ea"],
        accents: [],
      },
    ],
  },
];

const html = `<!doctype html><meta charset="utf-8"><title>gen</title>
<style>html,body{margin:0;background:#000}canvas{display:block}</style>
<canvas id="c" width="1200" height="800"></canvas>
<script>
window.draw = function(spec){
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  // base gradient (diagonal)
  const g = ctx.createLinearGradient(0,0,c.width,c.height);
  spec.colors.forEach((col,i)=>g.addColorStop(i/(spec.colors.length-1), col));
  ctx.fillStyle = g;
  ctx.fillRect(0,0,c.width,c.height);
  // accents
  (spec.accents||[]).forEach(a => {
    if (a.kind === 'sun') {
      const x = a.x*c.width, y = a.y*c.height, r = a.r;
      const rg = ctx.createRadialGradient(x,y,0,x,y,r*3);
      rg.addColorStop(0, a.color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0,0,c.width,c.height);
    } else if (a.kind === 'horizon') {
      ctx.fillStyle = a.color;
      ctx.fillRect(0, c.height*0.62, c.width, c.height*0.05);
    } else if (a.kind === 'speck') {
      ctx.fillStyle = a.color;
      for (let i=0;i<a.count;i++){
        const r = 2 + Math.random()*3;
        ctx.beginPath();
        ctx.arc(Math.random()*c.width, Math.random()*c.height*0.6, r, 0, Math.PI*2);
        ctx.fill();
      }
    }
  });
  // film grain
  const id = ctx.getImageData(0,0,c.width,c.height);
  const d = id.data;
  for (let i=0;i<d.length;i+=4){
    const n = (Math.random()-0.5)*14;
    d[i] = Math.max(0,Math.min(255,d[i]+n));
    d[i+1] = Math.max(0,Math.min(255,d[i+1]+n));
    d[i+2] = Math.max(0,Math.min(255,d[i+2]+n));
  }
  ctx.putImageData(id,0,0);
  // soft vignette
  const v = ctx.createRadialGradient(c.width/2,c.height/2,c.width*0.3,c.width/2,c.height/2,c.width*0.7);
  v.addColorStop(0,'rgba(0,0,0,0)');
  v.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0,0,c.width,c.height);
  return c.toDataURL('image/jpeg', 0.85);
};
</script>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.setContent(html);

  for (const set of SETS) {
    for (let i = 0; i < set.photos.length; i++) {
      const dataUrl = await page.evaluate((s) => window.draw(s), set.photos[i]);
      const base64 = dataUrl.split(",")[1];
      const buf = Buffer.from(base64, "base64");
      const fn = path.join(OUT, `${set.month}-${i + 1}.jpg`);
      fs.writeFileSync(fn, buf);
      console.log("wrote", fn, buf.length, "bytes");
    }
  }
  await browser.close();
})();
