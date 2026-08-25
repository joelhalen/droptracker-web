/**
 * The Components-V2 substitution and dropping rules, as pure functions.
 *
 * These mirror `render_layout` in the backend's services/component_layout.py.
 * They live here rather than inside the editor because they are the whole
 * value of the preview: a preview that keeps a line the sender would drop, or
 * shows an image the sender would leave out, tells a group admin their message
 * looks like something it will not look like. Being pure, they can be tested
 * against the same cases the Python tests cover.
 *
 * The one rule NOT reproduced here is Discord's own limits (block count, text
 * length): the backend rejects those on save, so the editor surfaces them as
 * save errors rather than silently trimming a preview.
 */

/** `services/event_message_layouts._TOKEN_RE`. */
export const EVENT_TOKEN_RE = /\{[a-z_]+\}/;
/** `services/component_layout._PLACEHOLDER_RE`. */
export const NOTIFICATION_TOKEN_RE = /\{[a-z0-9_]+\}/i;

/**
 * Substitute per line, dropping any line left holding an unresolved token.
 *
 * `substitute` off is the "raw tokens" view: the template as written, with
 * nothing resolved and nothing dropped.
 */
/**
 * True when every token on this line resolves to nothing.
 *
 * Mirrors `_line_values_are_all_blank` in services/component_layout.py: a line
 * exists to carry a value, so "**Location** {location}" with no location
 * disappears rather than rendering a label with nothing after it. Lines using
 * a token this type never defines are left to the unresolved-token rule.
 */
function lineValuesAreAllBlank(
  line: string,
  samples: Map<string, string>,
  tokenRe: RegExp,
): boolean {
  const global = new RegExp(
    tokenRe.source,
    tokenRe.flags.includes("g") ? tokenRe.flags : `${tokenRe.flags}g`,
  );
  const found = line.match(global);
  if (!found) return false;
  let sawKnown = false;
  for (const token of found) {
    if (!samples.has(token)) continue;
    sawKnown = true;
    if ((samples.get(token) ?? "").trim()) return false;
  }
  return sawKnown;
}

export function resolveLines(
  text: string,
  samples: Map<string, string>,
  substitute: boolean,
  tokenRe: RegExp,
): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    let line = rawLine;
    if (substitute) {
      if (lineValuesAreAllBlank(rawLine, samples, tokenRe)) continue;
      for (const [token, sample] of samples) line = line.split(token).join(sample);
      if (tokenRe.test(line)) continue;
      if (!line.trim() && rawLine.trim()) continue;
    }
    out.push(line);
  }
  return out;
}

/** Resolve a single value (thumbnail, image, button URL): no line dropping. */
export function resolveValue(
  text: string,
  samples: Map<string, string>,
  substitute: boolean,
): string {
  if (!substitute) return text;
  let out = text;
  for (const [token, sample] of samples) out = out.split(token).join(sample);
  return out;
}

/**
 * True when a URL would survive `_is_resolved_url` on the backend: non-empty,
 * no leftover token, and a scheme Discord accepts. Sending an unresolved
 * `{gear_image_url}` as a URL fails the whole message, which is why an
 * unusable one is dropped rather than passed through.
 */
export function isSendableUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  if (NOTIFICATION_TOKEN_RE.test(value)) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("attachment://")
  );
}

/* ------------------------------------------------------------------ */
/* Notification layout preview                                          */
/* ------------------------------------------------------------------ */
/** The editor's working shape for one block. */
export type PreviewDraftBlock = {
  type: "text" | "section" | "separator" | "media" | "buttons";
  content: string;
  thumbnail: string;
  divider: boolean;
  largeGap: boolean;
  urls: string[];
  buttons: { label: string; url: string }[];
};

/** What survives to be drawn. */
export type PreviewBlock =
  | { kind: "separator"; divider: boolean; largeGap: boolean }
  | { kind: "text"; text: string }
  | { kind: "section"; text: string; thumbnail: string | null }
  | { kind: "media"; urls: string[] }
  | { kind: "buttons"; buttons: { label: string; url: string }[] };

/**
 * Resolve a draft the way the sender would, returning only what Discord would
 * actually receive. An empty result means the message renders to nothing and
 * the notification falls back to its embed.
 */
export function renderNotificationPreview(
  blocks: PreviewDraftBlock[],
  samples: Map<string, string>,
  substitute: boolean,
): PreviewBlock[] {
  const rendered: PreviewBlock[] = [];

  for (const block of blocks) {
    if (block.type === "separator") {
      rendered.push({ kind: "separator", divider: block.divider, largeGap: block.largeGap });
      continue;
    }

    if (block.type === "text" || block.type === "section") {
      const text = resolveLines(block.content, samples, substitute, NOTIFICATION_TOKEN_RE)
        .join("\n")
        .trim();
      // A block whose every line dropped is itself dropped.
      if (!text) continue;
      if (block.type === "text") {
        rendered.push({ kind: "text", text });
        continue;
      }
      const thumbnail = block.thumbnail.trim()
        ? resolveValue(block.thumbnail, samples, substitute).trim()
        : "";
      // An unresolved thumbnail costs the accessory, not the section: most
      // players have no character render.
      const usable = substitute ? isSendableUrl(thumbnail) : Boolean(thumbnail);
      rendered.push({ kind: "section", text, thumbnail: usable ? thumbnail : null });
      continue;
    }

    if (block.type === "media") {
      const urls = block.urls
        .map((u) => resolveValue(u, samples, substitute).trim())
        .filter((u) => (substitute ? isSendableUrl(u) : Boolean(u)));
      if (!urls.length) continue;
      rendered.push({ kind: "media", urls });
      continue;
    }

    if (block.type === "buttons") {
      const buttons = block.buttons
        .map((b) => ({
          label: resolveValue(b.label, samples, substitute).trim(),
          url: resolveValue(b.url, samples, substitute).trim(),
        }))
        .filter((b) => b.label && (substitute ? isSendableUrl(b.url) : Boolean(b.url)));
      if (!buttons.length) continue;
      rendered.push({ kind: "buttons", buttons });
    }
  }

  // Separators alone are not a message.
  if (!rendered.some((b) => b.kind !== "separator")) return [];
  // A rule at either end is a rule against nothing.
  while (rendered.length && rendered[0]?.kind === "separator") rendered.shift();
  while (rendered.length && rendered[rendered.length - 1]?.kind === "separator") rendered.pop();
  return rendered;
}

/** Token samples for one notification type, blanking the optional ones in the
 * "sparse" view — the common production case the author needs to see. */
export function sampleMap(
  tokens: { token: string; sample: string; optional: boolean }[],
  sparse: boolean,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tokens) map.set(`{${t.token}}`, sparse && t.optional ? "" : t.sample);
  return map;
}
