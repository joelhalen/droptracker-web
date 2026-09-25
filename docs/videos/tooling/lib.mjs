// Shared Playwright harness for recording DropTracker UI clips in mock mode.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.BASE || "http://localhost:3001";
const ICONS = process.env.ICONS || path.resolve("icons");
const W = 1920,
  H = 1080;

// Transparent 1x1 PNG for images we have no local copy of.
const BLANK = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const CURSOR_CSS = `
  nextjs-portal, [data-nextjs-toast], #__next-build-watcher, button[aria-label^="Open messages and support"] { display:none !important; }
  #dt-cursor { position:fixed; left:0; top:0; width:26px; height:26px; z-index:2147483647;
    pointer-events:none; transform:translate(-3px,-2px); transition:transform .05s linear; }
  #dt-cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.55)); }
  .dt-click { position:fixed; width:44px; height:44px; margin:-22px 0 0 -22px; border-radius:50%;
    border:3px solid #ffb938; z-index:2147483646; pointer-events:none;
    animation: dtpulse .45s ease-out forwards; }
  @keyframes dtpulse { from { transform:scale(.3); opacity:1 } to { transform:scale(1.4); opacity:0 } }
`;

const CURSOR_JS = `(() => {
  const install = () => {
    if (document.getElementById('dt-cursor')) return;
    const st = document.createElement('style'); st.textContent = ${JSON.stringify(CURSOR_CSS)};
    document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'dt-cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.8 L11.6 21.5 L14.4 20.3 L11.4 13.7 L17.5 13.7 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const pos = window.__dtPos || { x: innerWidth / 2, y: innerHeight / 2 };
    c.style.left = pos.x + 'px'; c.style.top = pos.y + 'px';
    document.body.appendChild(c);
  };
  document.addEventListener('mousemove', e => {
    window.__dtPos = { x: e.clientX, y: e.clientY };
    const c = document.getElementById('dt-cursor'); if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }
  }, true);
  document.addEventListener('mousedown', e => {
    const r = document.createElement('div'); r.className = 'dt-click';
    r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.appendChild(r); setTimeout(() => r.remove(), 500);
  }, true);
  if (document.readyState !== 'loading') install(); else document.addEventListener('DOMContentLoaded', install);
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: false });
})();`;

// npc id -> pet item id; skill/boss metric -> skillcape / pet item id.
const NPC_STANDINS = {
  8060: 21992,
  2042: 12921,
  3162: 12649,
  2215: 12650,
  2205: 12651,
  3129: 12652,
};
const METRIC_STANDINS = {
  attack: 9747,
  strength: 9750,
  defence: 9753,
  ranged: 9756,
  prayer: 9759,
  magic: 9762,
  runecrafting: 9765,
  hitpoints: 9768,
  agility: 9771,
  herblore: 9774,
  thieving: 9777,
  crafting: 9780,
  fletching: 9783,
  slayer: 9786,
  construction: 9789,
  mining: 9792,
  smithing: 9795,
  fishing: 9798,
  cooking: 9801,
  firemaking: 9804,
  woodcutting: 9807,
  farming: 9810,
  hunter: 9948,
  vorkath: 21992,
  zulrah: 12921,
};

export async function open({ record = null, width = W, height = H, scale = 1 } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: "dark",
    ...(record ? { recordVideo: { dir: record, size: { width, height } } } : {}),
  });
  await ctx.addCookies([
    { name: "dt_session", value: "mock-session", domain: "localhost", path: "/" },
  ]);
  await ctx.addInitScript(CURSOR_JS);
  // Item icons: served from the local osrsbox extract. Everything else image-ish off-box: blank.
  await ctx.route(/\/img\/itemdb\/(\d+)\.png/, (route, req) => {
    const id = req.url().match(/\/img\/itemdb\/(\d+)\.png/)[1];
    const f = path.join(ICONS, "itemdb", `${id}.png`);
    return fs.existsSync(f)
      ? route.fulfill({ status: 200, contentType: "image/png", body: fs.readFileSync(f) })
      : route.fulfill({ status: 200, contentType: "image/png", body: BLANK });
  });
  await ctx.route(
    /^https?:\/\/(?!localhost)[^/]+\/.*\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i,
    (route) => route.fulfill({ status: 200, contentType: "image/png", body: BLANK }),
  );
  // Skills and bosses have no icons in the item extract, so film in-game
  // stand-ins: the skillcape for a skill, the boss's pet for a boss.
  const iconFile = (id) => path.join(ICONS, "itemdb", `${id}.png`);
  const serve = (route, id) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: id && fs.existsSync(iconFile(id)) ? fs.readFileSync(iconFile(id)) : BLANK,
    });
  await ctx.route(/\/img\/npcdb\/(\d+)\.png/, (route, req) =>
    serve(route, NPC_STANDINS[req.url().match(/npcdb\/(\d+)/)[1]]),
  );
  await ctx.route(/\/img\/metrics\/([a-z_]+)\.png/, (route, req) =>
    serve(route, METRIC_STANDINS[req.url().match(/metrics\/([a-z_]+)/)[1]]),
  );
  await ctx.route(/\/img\/(proofs|lootboard)\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: BLANK }),
  );
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  return { browser, ctx, page };
}

export async function go(page, url, settle = 2500) {
  await page.goto(BASE + url, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(settle);
}

// Smooth, human-ish cursor glide to an element (or point), then optional click.
let cur = { x: 640, y: 360 };
export function setCursor(x, y) {
  cur = { x, y };
}
export async function glide(
  page,
  target,
  { click = false, ms = null, steps = null, pause = 350, offset = null } = {},
) {
  let x, y;
  if (typeof target === "string" || target?.boundingBox) {
    const loc = typeof target === "string" ? page.locator(target).first() : target;
    await loc.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
    const b = await loc.boundingBox({ timeout: 8000 });
    if (!b) throw new Error("no box for " + target);
    x = b.x + (offset ? offset.x : b.width / 2);
    y = b.y + (offset ? offset.y : b.height / 2);
  } else ({ x, y } = target);
  // Clock-based: the move takes `ms` of wall time however slow each step is.
  const from = { ...cur },
    dist = Math.hypot(x - from.x, y - from.y);
  const dur = ms ?? (steps ? steps * 22 : Math.min(900, 280 + dist * 0.9));
  const t0 = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - t0) / dur),
      e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    if (t >= 1) break;
    await page.waitForTimeout(8);
  }
  cur = { x, y };
  await page.waitForTimeout(pause);
  if (click) {
    await page.mouse.down();
    await page.waitForTimeout(90);
    await page.mouse.up();
    await page.waitForTimeout(pause);
  }
}

export async function typeSlow(page, text, delay = 55) {
  await page.keyboard.type(text, { delay });
}

// Smooth scroll by dy pixels over ms (real time, eased).
export async function scroll(page, dy, ms = 1200) {
  const y = await page.evaluate(() => window.scrollY);
  await scrollTo(page, y + dy, ms);
}

export async function scrollTo(page, y, ms = 1200) {
  await page.evaluate(
    ([y, ms]) =>
      new Promise((r) => {
        const s = window.scrollY,
          t0 = performance.now();
        const f = (now) => {
          const t = Math.min(1, (now - t0) / ms),
            e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          window.scrollTo(0, s + (y - s) * e);
          t < 1 ? requestAnimationFrame(f) : r();
        };
        requestAnimationFrame(f);
      }),
    [y, ms],
  );
  await page.waitForTimeout(200);
}

export async function shot(page, file) {
  await page.screenshot({ path: file });
}

// ---- High-quality recorder: CDP screencast frames -> CFR H.264 via ffmpeg ----
import { execFileSync } from "node:child_process";
export async function cast(page, outMp4, { quality = 88 } = {}) {
  const dir = outMp4.replace(/\.mp4$/, "_frames");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let n = 0,
    stopped = false,
    paused = false,
    pauseAt = 0,
    offset = 0,
    t0 = null;
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    if (paused || stopped) return;
    const t = metadata.timestamp - offset;
    if (t0 === null) t0 = t;
    const f = path.join(dir, `f${String(n++).padStart(6, "0")}.jpg`);
    fs.writeFileSync(f, Buffer.from(data, "base64"));
    frames.push({ f, t: t - t0 });
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality,
    maxWidth: 1920,
    maxHeight: 1080,
    everyNthFrame: 1,
  });
  const now = () => Date.now() / 1000;
  const nudge = async () => {
    const p = await page
      .evaluate(() => window.__dtPos || { x: 640, y: 360 })
      .catch(() => ({ x: 640, y: 360 }));
    await page.mouse.move(p.x + 1, p.y);
    await page.mouse.move(p.x, p.y);
  };
  return {
    pause() {
      paused = true;
      pauseAt = now();
    },
    async resume() {
      await page.waitForTimeout(150);
      offset += now() - pauseAt;
      paused = false;
      await nudge();
    },
    async stop(tail = 0.6) {
      await page.waitForTimeout(tail * 1000);
      stopped = true;
      await cdp.send("Page.stopScreencast").catch(() => {});
      const end = (frames.at(-1)?.t ?? 0) + 0.04;
      const lines = ["ffconcat version 1.0"];
      frames.forEach((fr, i) => {
        const d = (i + 1 < frames.length ? frames[i + 1].t : end + tail) - fr.t;
        lines.push(`file '${fr.f}'`, `duration ${Math.max(d, 0.001).toFixed(4)}`);
      });
      lines.push(`file '${frames.at(-1).f}'`);
      fs.writeFileSync(path.join(dir, "list.txt"), lines.join("\n"));
      execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        path.join(dir, "list.txt"),
        "-vf",
        "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-movflags",
        "+faststart",
        outMp4,
      ]);
      fs.rmSync(dir, { recursive: true, force: true });
      return { frames: frames.length, seconds: end };
    },
  };
}

export async function openHD() {
  return open({ width: 1280, height: 720, scale: 1.5 });
}
