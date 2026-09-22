/**
 * Canvas renderer for the hero's loot rain.
 *
 * Every streak is one REAL credited drop: the `global` realtime scope publishes
 * a `leaderboard_delta` for each of them (roughly seven a second), and
 * ./hero.tsx calls `spawn(value)` per frame. Length, weight and colour come
 * from the drop's GP value on a log scale, so the constant drizzle of bones and
 * runes stays faint and a rare nine-figure drop reads at a glance.
 *
 * On top of the rain falls a highlight reel: the newest notable drops (>= 10M,
 * from the `feed` scope and its Redis history) as labelled item tags. A tag's
 * label carries its age, so a replayed drop is never passed off as "just now".
 *
 * Plain DOM/canvas code with no React in it — the component only creates,
 * feeds and destroys an engine. It is not a "use client" module (it has no
 * directive of its own and is only ever imported by one).
 */
import { formatGp } from "@/lib/format";
import { formatAgo, itemIcon, rainWeight, valueTier, type NotableDrop, type ValueTier } from "./home-data";

/** Hard cap on streaks in flight — a burst (or a bug) can never bog the page. */
const MAX_STREAKS = 200;
/** How long a highlight tag takes to fall the height of the stage. */
const TAG_FALL_MS = 8_000;
/** Minimum spacing between reel launches. */
const TAG_GAP_MS = 2_600;
/** A lane wants roughly this much width for a tag to fall without crowding. */
const LANE_WIDTH = 330;
const TAG_HEIGHT = 30;
const TAG_FONT_PX = 16;
/** Height of the pill row at the top of the stage that tags must clear. */
const TAG_CLEARANCE = 38;

interface Streak {
  x: number;
  /** Head (bottom) of the streak, in CSS px from the top of the stage. */
  y: number;
  speed: number;
  len: number;
  width: number;
  alpha: number;
  tier: ValueTier;
  weight: number;
}

interface Splash {
  x: number;
  born: number;
  size: number;
  tier: ValueTier;
}

interface Tag {
  drop: NotableDrop;
  lane: number;
  x: number;
  born: number;
  /** Arrived over SSE while the visitor was watching. */
  live: boolean;
  label: string;
  width: number;
  img: HTMLImageElement;
}

interface Palette {
  tiers: Record<ValueTier, string>;
  tagBg: string;
  tagText: string;
  fontFamily: string;
}

export interface RainEngine {
  /** One credited drop worth `value` gp just landed somewhere in the game. */
  spawn(value: number): void;
  /** Drop a highlight tag now (used for notable drops arriving live). */
  feature(drop: NotableDrop, live: boolean): void;
  /** Replace the replay reel (the page re-syncs it from the server). */
  setReel(reel: NotableDrop[]): void;
  destroy(): void;
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    tiers: {
      dust: v("--hp-rain-dust", "#7a5a32"),
      common: v("--hp-rain-common", "#d8c9a3"),
      "1m": v("--hp-tier-1m", "#6fbf73"),
      "10m": v("--hp-tier-10m", "#56b6f0"),
      "100m": v("--hp-tier-100m", "#c084fc"),
      "1b": v("--hp-tier-1b", "#ffd966"),
    },
    tagBg: v("--hp-tag-bg", "#211a12"),
    tagText: v("--hp-tag-text", "#efe6d2"),
    // The canvas element is styled with the OSRS UI face; next/font gives it a
    // hashed family name, so it has to be read back rather than written here.
    fontFamily: cs.fontFamily || "sans-serif",
  };
}

export function createRainEngine(canvas: HTMLCanvasElement, initialReel: NotableDrop[]): RainEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { spawn() {}, feature() {}, setReel() {}, destroy() {} };
  }

  let palette = readPalette(canvas);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let laneCount = 1;
  let laneFreeAt: number[] = [0];

  let streaks: Streak[] = [];
  let splashes: Splash[] = [];
  let tags: Tag[] = [];

  let reel = initialReel.slice();
  let reelIndex = 0;
  let nextReelAt = 0;

  let raf = 0;
  let last = 0;
  let onScreen = true;
  let destroyed = false;

  const images = new Map<number, HTMLImageElement>();
  const iconFor = (itemId: number): HTMLImageElement => {
    let img = images.get(itemId);
    if (!img) {
      img = new Image();
      img.decoding = "async";
      img.src = itemIcon(itemId);
      images.set(itemId, img);
    }
    return img;
  };

  /* --- sizing ------------------------------------------------------------ */

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    // 2 is plenty for hairlines; a 3x phone would triple the fill cost for
    // no visible gain.
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    laneCount = Math.max(1, Math.floor(width / LANE_WIDTH));
    laneFreeAt = Array.from({ length: laneCount }, (_, i) => laneFreeAt[i] ?? 0);
    tags = tags.filter((t) => t.lane < laneCount);
  };

  /* --- highlight tags ---------------------------------------------------- */

  const fitLabel = (text: string, maxWidth: number): { label: string; width: number } => {
    ctx.font = `${TAG_FONT_PX}px ${palette.fontFamily}`;
    let label = text;
    let w = ctx.measureText(label).width;
    // Item names run long ("Scythe of vitur (uncharged)") and a phone gives a
    // tag ~340px — trim the text rather than let it hang off the stage.
    while (w > maxWidth && label.length > 8) {
      label = `${label.slice(0, -2).trimEnd()}…`;
      w = ctx.measureText(label).width;
    }
    return { label, width: w };
  };

  const launchTag = (drop: NotableDrop, live: boolean, now: number): boolean => {
    if (!onScreen || document.hidden) return false;
    const free = laneFreeAt
      .map((at, lane) => ({ at, lane }))
      .filter((l) => l.at <= now);
    // A live drop never waits for a lane: it takes whichever frees up soonest.
    const lane = free.length
      ? free[Math.floor(Math.random() * free.length)]!.lane
      : live
        ? laneFreeAt.indexOf(Math.min(...laneFreeAt))
        : -1;
    if (lane < 0) return false;

    const age = live ? "just now" : `${formatAgo(drop.ts, Date.now() / 1000)} ago`;
    const text = `${drop.itemName} · ${formatGp(drop.value)} · ${age}`;
    const laneWidth = width / laneCount;
    const chrome = 27 + 8 + 12 + 10; // icon + gap + padding left/right
    const { label, width: textWidth } = fitLabel(text, Math.max(60, laneWidth - chrome - 16));
    const tagWidth = textWidth + chrome;
    const slack = Math.max(0, laneWidth - tagWidth - 16);

    tags.push({
      drop,
      lane,
      x: lane * laneWidth + 8 + Math.random() * slack,
      born: now,
      live,
      label,
      width: tagWidth,
      img: iconFor(drop.itemId),
    });
    // Hold the lane until this tag is well on its way down, so the next one in
    // it never rides on its heels. A phone has a single lane and a short stage,
    // where two tags at once already reads as crowded — hold it for longer.
    laneFreeAt[lane] = now + TAG_FALL_MS * (laneCount === 1 ? 0.62 : 0.38);
    return true;
  };

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const drawTag = (tag: Tag, now: number) => {
    const t = (now - tag.born) / TAG_FALL_MS;
    const y = -TAG_HEIGHT + t * (height + TAG_HEIGHT);
    // Materialise BELOW the stream/activity pills pinned to the top corners of
    // the stage (a tag sliding out from behind one reads as a glitch), and
    // dissolve before the ledger line.
    const fadeIn = Math.min(1, Math.max(0, (y - TAG_CLEARANCE) / 26));
    // By position, not by time: fully gone when its bottom edge meets the line,
    // so it never appears to slide underneath the counter.
    const fadeOut = Math.min(1, Math.max(0, (height - TAG_HEIGHT - y) / 34));
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0) return;
    const tier = palette.tiers[valueTier(tag.drop.value)];

    ctx.save();
    ctx.globalAlpha = alpha * 0.94;
    if (tag.live) {
      ctx.shadowColor = tier;
      ctx.shadowBlur = 14;
    }
    roundRect(tag.x, y, tag.width, TAG_HEIGHT, 5);
    ctx.fillStyle = palette.tagBg;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * (tag.live ? 1 : 0.7);
    ctx.lineWidth = 1;
    ctx.strokeStyle = tier;
    ctx.stroke();

    ctx.globalAlpha = alpha;
    if (tag.img.complete && tag.img.naturalWidth > 0) {
      // 36x32 pixel-art sprite: keep the pixels square instead of smearing them.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tag.img, tag.x + 10, y + 3, 27, 24);
    }
    ctx.font = `${TAG_FONT_PX}px ${palette.fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.tagText;
    ctx.fillText(tag.label, tag.x + 10 + 27 + 8, y + TAG_HEIGHT / 2 + 1);
    ctx.restore();
  };

  /* --- frame ------------------------------------------------------------- */

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(64, now - last) / 1000;
    last = now;

    if (reel.length > 0 && now >= nextReelAt) {
      const drop = reel[reelIndex % reel.length]!;
      if (launchTag(drop, false, now)) reelIndex += 1;
      // Brisk through the first pass so the stage fills quickly, then ease off:
      // from the second lap on these are repeats.
      nextReelAt = now + (reelIndex < reel.length ? TAG_GAP_MS : TAG_GAP_MS * 2);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    // Butt caps: the tail is drawn as abutting segments, and round caps would
    // overlap into bright beads at every join.
    ctx.lineCap = "butt";

    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i]!;
      s.y += s.speed * dt;
      if (s.y - s.len >= height) {
        streaks.splice(i, 1);
        continue;
      }
      if (s.y >= height && s.weight > 0) {
        splashes.push({ x: s.x, born: now, size: 2 + s.weight * 9, tier: s.tier });
        // One splash per streak: mark it spent, let the tail finish falling.
        s.weight = -1;
      }

      // Brighter as it nears the ledger line: faint where it enters under the
      // site header, vivid where it lands.
      const depth = Math.min(1, Math.max(0, s.y / height));
      const head = Math.min(s.y, height);
      const tail = s.y - s.len;
      const rare = s.tier !== "dust" && s.tier !== "common";
      ctx.strokeStyle = palette.tiers[s.tier];
      ctx.lineWidth = s.width;
      // A 1M+ drop is a once-in-a-few-seconds event, so it can afford a glow
      // (shadowBlur on every streak would not be free).
      ctx.shadowColor = rare ? palette.tiers[s.tier] : "transparent";
      ctx.shadowBlur = rare ? 10 : 0;
      // Three segments of rising opacity stand in for a gradient tail, without
      // needing to parse an arbitrary CSS colour into an rgba() ramp.
      const thirds = [0.25, 0.55, 1];
      const strength = s.alpha * (0.6 + 0.4 * depth);
      for (let k = 0; k < 3; k++) {
        const from = tail + (s.len * k) / 3;
        const to = Math.min(head, tail + (s.len * (k + 1)) / 3);
        if (to <= from || to <= 0) continue;
        ctx.globalAlpha = strength * thirds[k]!;
        ctx.beginPath();
        ctx.moveTo(s.x, Math.max(0, from));
        ctx.lineTo(s.x, to);
        ctx.stroke();
      }
      // A bead at the head: the part of a raindrop the eye actually tracks, and
      // what keeps a thin streak legible on a wide desktop stage.
      if (head > 0 && head < height) {
        ctx.globalAlpha = Math.min(1, strength * 1.35);
        ctx.fillStyle = palette.tiers[s.tier];
        ctx.fillRect(s.x - s.width, head - 2.5, s.width * 2, 2.5);
      }
    }
    ctx.shadowBlur = 0;

    for (let i = splashes.length - 1; i >= 0; i--) {
      const p = splashes[i]!;
      const t = (now - p.born) / 420;
      if (t >= 1) {
        splashes.splice(i, 1);
        continue;
      }
      const reach = p.size * (0.4 + t);
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.strokeStyle = palette.tiers[p.tier];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - reach, height - reach * 0.55);
      ctx.lineTo(p.x, height - 0.5);
      ctx.lineTo(p.x + reach, height - reach * 0.55);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    for (let i = tags.length - 1; i >= 0; i--) {
      const tag = tags[i]!;
      if (now - tag.born >= TAG_FALL_MS) {
        tags.splice(i, 1);
        continue;
      }
      drawTag(tag, now);
    }
  };

  const start = () => {
    if (raf || destroyed) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const sync = () => (onScreen && !document.hidden ? start() : stop());

  /* --- observers --------------------------------------------------------- */

  const resizer = new ResizeObserver(resize);
  resizer.observe(canvas);

  const viewport = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true;
    sync();
  });
  viewport.observe(canvas);

  document.addEventListener("visibilitychange", sync);

  // The theme switcher flips `data-theme` on <html>; canvas pixels do not
  // follow CSS variables on their own, so re-read the palette when it does.
  const themeWatcher = new MutationObserver(() => {
    palette = readPalette(canvas);
  });
  themeWatcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // Web fonts load after first paint; the hashed family name resolves to the
  // fallback until then, and tag widths are measured against it.
  void document.fonts?.ready.then(() => {
    if (!destroyed) palette = readPalette(canvas);
  });

  resize();
  sync();

  return {
    spawn(value) {
      // Nothing is queued while paused: a tab left in the background for an
      // hour must not come back to an hour of rain falling at once.
      if (!raf || streaks.length >= MAX_STREAKS) return;
      const weight = rainWeight(value);
      if (weight <= 0) return;
      const len = 22 + weight * 100;
      // Bell-shaped across a wide stage (sum of three uniforms, sd ~0.21 of the
      // width) rather than flat: the rain gathers over the counter it falls
      // into, and a 1920px stage does not thin ~7 drops a second into nothing.
      // A phone is narrow enough to fill evenly, so there the curve is opened
      // right up. Anything that lands outside is re-drawn uniformly instead of
      // clamped, which would pile a visible column up at each edge.
      const bell = (Math.random() + Math.random() + Math.random() - 1.5) * (width < 700 ? 0.9 : 0.42);
      const at = 0.5 + bell;
      streaks.push({
        x: width * (at < 0 || at > 1 ? Math.random() : at),
        y: -Math.random() * 12,
        // Unhurried on purpose: a fall of two seconds and up keeps fifteen or
        // more in the air at that rate, which is what makes it read as rain and
        // not the odd spark. Heavier drops fall slower still, so the eye catches
        // them.
        speed: (height + len) / (1.9 + weight * 1.5),
        len,
        // Most drops are a few hundred gp; they still have to READ as rain, so
        // even the lightest streak is over a pixel wide and a third opaque.
        width: weight >= 0.6 ? 2.75 : weight >= 0.3 ? 2 : 1.5,
        alpha: 0.5 + weight * 0.5,
        tier: valueTier(value),
        weight,
      });
    },

    feature(drop, live) {
      launchTag(drop, live, performance.now());
      if (!reel.some((d) => d.key === drop.key)) reel = [drop, ...reel].slice(0, 12);
    },

    setReel(next) {
      // Keep anything that arrived live and is newer than the server's page.
      const known = new Set(next.map((d) => d.key));
      reel = [...reel.filter((d) => !known.has(d.key)), ...next]
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 12);
    },

    destroy() {
      destroyed = true;
      stop();
      resizer.disconnect();
      viewport.disconnect();
      themeWatcher.disconnect();
      document.removeEventListener("visibilitychange", sync);
      streaks = [];
      splashes = [];
      tags = [];
    },
  };
}
