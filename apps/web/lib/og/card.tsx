/**
 * Social-card renderer for entity pages (players, groups, NPCs, items).
 *
 * Every card is the same 1200×630 frame: the entity's headline stats on the
 * left, its picture on the right (a character model, a group icon or
 * lootboard, a boss or item sprite). Rendered on request by
 * `app/api/og/[kind]/[file]/route.tsx` and referenced from each page's
 * `generateMetadata`, so a link pasted into Discord or X unfurls with the
 * same numbers the page shows.
 *
 * Server-only. `next/og` (satori + resvg) draws a subset of CSS: flexbox only,
 * every element with more than one child needs `display: flex`, and fonts must
 * be TTF/OTF — hence the static instances in ./fonts, cut from the site's
 * variable woff2 files (satori reads neither variable fonts nor woff2).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";

export const OG_SIZE = { width: 1200, height: 630 } as const;

// Dusk theme (packages/ui/src/theme.css), inlined: satori has no CSS vars.
const C = {
  bg: "#15110c",
  panel: "#211a12",
  border: "#7a5a32",
  text: "#efe6d2",
  muted: "#d8c9a3",
  gold: "#ffb83f",
  goldBright: "#ffd966",
};

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

let fontsPromise: Promise<Font[]> | null = null;

/** Loaded once per process. `cwd` is apps/web under both the systemd units
 * and `next dev`. */
function loadFonts(): Promise<Font[]> {
  fontsPromise ??= (async (): Promise<Font[]> => {
    const dir = join(process.cwd(), "lib/og/fonts");
    const read = async (file: string) => {
      const buf = await readFile(join(dir, file));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    };
    const [cinzel, regular, bold] = await Promise.all([
      read("cinzel-bold.ttf"),
      read("figtree-regular.ttf"),
      read("figtree-bold.ttf"),
    ]);
    return [
      { name: "Cinzel", data: cinzel, weight: 700, style: "normal" },
      { name: "Figtree", data: regular, weight: 400, style: "normal" },
      { name: "Figtree", data: bold, weight: 700, style: "normal" },
    ];
  })().catch((err) => {
    fontsPromise = null;
    throw err;
  });
  return fontsPromise!;
}

/**
 * Public image host, as the API spells it, and where this server reaches it.
 * Cloudflare answers non-browser clients on the public host with 403s, and the
 * image server is on this box anyway.
 */
const PUBLIC_IMG_PREFIXES = [
  "https://www.droptracker.io/img/",
  "https://droptracker.io/img/",
  "/img/",
];
const INTERNAL_IMG_BASE = (process.env.OG_IMG_INTERNAL_URL ?? "http://127.0.0.1:8080/img").replace(
  /\/$/,
  "",
);

/** Rewrites a site image URL to the internal image server; other hosts pass through. */
export function internalImageUrl(url: string): string {
  for (const prefix of PUBLIC_IMG_PREFIXES) {
    if (url.startsWith(prefix)) return `${INTERNAL_IMG_BASE}/${url.slice(prefix.length)}`;
  }
  return url;
}

export type LoadedImage = { src: string; width: number; height: number };

/**
 * Fetches an image and inlines it as a data URL, or returns null.
 *
 * Only PNG and JPEG count. The image server answers most missing files with
 * a 200 and its animated logo GIF, so "200 OK" proves nothing; the magic
 * bytes do. Inlining also means a slow or failed fetch degrades to the
 * fallback art instead of failing the whole render inside satori.
 */
export async function loadImage(
  url: string | null | undefined,
  timeoutMs = 4000,
): Promise<LoadedImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(internalImageUrl(url), {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) return null;
    const dims = pngSize(buf) ?? jpegSize(buf);
    if (!dims) return null;
    const mime = buf[0] === 0x89 ? "image/png" : "image/jpeg";
    return { src: `data:${mime};base64,${buf.toString("base64")}`, ...dims };
  } catch {
    return null;
  }
}

function pngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1]!;
    const len = buf.readUInt16BE(i + 2);
    // SOF0..SOF15, minus DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

export type CardStat = { label: string; value: string };

export type CardProps = {
  /** Small caps line above the title: "Player", "Group", "Boss", "Item". */
  kicker: string;
  title: string;
  /** One line under the title (account type, member count, GE price). */
  subtitle?: string;
  /** Tiny badge drawn before the subtitle (an account-type helm). */
  subtitleIcon?: LoadedImage | null;
  /** Up to four; rendered as a 2×2 grid. */
  stats: CardStat[];
  /** The right-hand picture, already positioned inside a `visualWidth` box. */
  visual: ReactNode;
  visualWidth?: number;
  /** Accent for the rule under the title and the visual's glow. */
  accent?: string;
};

/** Shrinks long names so they stay on one line in the left column. */
function titleSize(title: string, columnWidth: number): number {
  // Cinzel caps average ~0.72em wide.
  const fit = Math.floor(columnWidth / Math.max(title.length * 0.72, 1));
  return Math.max(40, Math.min(84, fit));
}

export async function renderCard(props: CardProps): Promise<ImageResponse> {
  const fonts = await loadFonts();
  const visualWidth = props.visualWidth ?? 440;
  const columnWidth = OG_SIZE.width - visualWidth - 64 - 40;
  const accent = props.accent ?? C.gold;
  const stats = props.stats.slice(0, 4);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: `radial-gradient(circle at 78% 45%, #3e3529 0%, ${C.bg} 62%)`,
        color: C.text,
        fontFamily: "Figtree",
        position: "relative",
      }}
    >
      {/* Frame */}
      <div
        style={{
          position: "absolute",
          inset: 18,
          border: `2px solid ${C.border}`,
          borderRadius: 20,
          opacity: 0.55,
          display: "flex",
        }}
      />

      {/* Left column: text */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: columnWidth + 64,
          padding: "60px 0 52px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: C.muted,
          }}
        >
          <span style={{ color: C.gold }}>DropTracker.io</span>
          <span style={{ margin: "0 14px", opacity: 0.5 }}>·</span>
          <span style={{ opacity: 0.8 }}>{props.kicker}</span>
        </div>
        <div
          style={{
            fontFamily: "Cinzel",
            fontSize: titleSize(props.title, columnWidth),
            color: C.goldBright,
            lineHeight: 1.1,
            marginTop: 10,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: columnWidth,
          }}
        >
          {props.title}
        </div>
        <div
          style={{
            width: 120,
            height: 4,
            borderRadius: 2,
            background: accent,
            marginTop: 18,
            display: "flex",
          }}
        />
        {props.subtitle ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 28,
              color: C.muted,
              marginTop: 20,
              maxWidth: columnWidth,
            }}
          >
            {props.subtitleIcon ? (
              <img
                src={props.subtitleIcon.src}
                width={props.subtitleIcon.width * 2}
                height={props.subtitleIcon.height * 2}
                alt=""
              />
            ) : null}
            <span>{props.subtitle}</span>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            marginTop: "auto",
            columnGap: 24,
            rowGap: 20,
            maxWidth: columnWidth,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                width: (columnWidth - 24) / 2,
                padding: "14px 20px",
                borderRadius: 14,
                background: C.panel,
                border: `1px solid ${C.border}66`,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: C.muted,
                  opacity: 0.7,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 38,
                  fontWeight: 700,
                  color: C.gold,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column: picture */}
      <div
        style={{
          display: "flex",
          position: "relative",
          width: visualWidth,
          height: "100%",
          marginLeft: "auto",
          marginRight: 40,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {props.visual}
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts,
      headers: {
        // Crawlers fetch once per unfurl; an hour at the edge absorbs a link
        // being pasted around a busy channel.
        "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}

/** A picture scaled to fit a box, centred, with a soft glow behind it. */
export function FittedImage({
  image,
  box,
  pixelated = false,
  radius = 0,
  glow = C.gold,
}: {
  image: LoadedImage;
  box: { width: number; height: number };
  /** Nearest-neighbour upscaling for small game sprites. */
  pixelated?: boolean;
  radius?: number;
  glow?: string | null;
}) {
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const w = Math.round(image.width * scale);
  const h = Math.round(image.height * scale);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {glow ? (
        <div
          style={{
            position: "absolute",
            width: Math.max(w, h) * 1.1,
            height: Math.max(w, h) * 1.1,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${glow}33 0%, ${glow}00 68%)`,
            display: "flex",
          }}
        />
      ) : null}
      <img
        src={image.src}
        width={w}
        height={h}
        alt=""
        style={{
          borderRadius: radius,
          ...(pixelated ? { imageRendering: "pixelated" as const } : {}),
        }}
      />
    </div>
  );
}

/** Initial-letter tile, for an entity with no picture of its own. */
export function InitialTile({ name, size = 300 }: { name: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Cinzel",
        fontSize: size * 0.5,
        color: "rgba(255,255,255,0.9)",
        background: `linear-gradient(135deg, hsl(${h}, 45%, 42%), hsl(${(h + 40) % 360}, 50%, 30%))`,
        border: `2px solid hsla(${h}, 45%, 55%, 0.5)`,
      }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

export const OG_COLORS = C;
