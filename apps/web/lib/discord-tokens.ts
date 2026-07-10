/**
 * remark plugin: render raw Discord entity markup as readable, styled chips.
 *
 * Mirrored Discord message content (ticket transcripts, suggestion/bug forum
 * posts) embeds entities as raw tokens — user mentions `<@123>` / `<@!123>`,
 * role mentions `<@&123>`, channel mentions `<#123>`, custom emoji
 * `<:name:123>` / `<a:name:123>` and timestamps `<t:unix:R>`. Rendered as-is
 * they show up as meaningless numeric ids. This plugin walks the Markdown AST
 * and splits text nodes so each token becomes a `<span class="dt-mention …">`
 * whose label is human-readable:
 *
 *   - user    → `@username` (from the resolved `mentions` map) or `@unknown`
 *   - role    → `@role`
 *   - channel → `#channel`
 *   - emoji   → `:name:`
 *   - time    → an absolute UTC date
 *
 * It's a self-contained mdast transformer (no `unist-util-visit` dependency)
 * that only rewrites `text` nodes, so it never touches `inlineCode`/`code`
 * spans — a `<@123>` inside backticks stays literal, as on Discord. The
 * `data.hName`/`data.hProperties` it sets are honored by remark-rehype, so the
 * chips render without any custom react-markdown component wiring; styling
 * lives in globals.css (`.dt-mention`).
 */

export type MentionMap = Record<string, string>;

// One combined matcher for every entity kind. Alternation order matters:
// the `<@…>`/`<#…>` branch must be tried before treating `<` as literal text.
//   1: sigil (@, @!, @&, #)   2: id (user/role/channel)
//   3: `a` for animated emoji 4: emoji name          5: emoji id
//   6: unix seconds           7: timestamp style flag
const TOKEN_RE = /<(@[!&]?|#)(\d+)>|<(a)?:(\w+):(\d+)>|<t:(-?\d+)(?::([tTdDfFR]))?>/g;

type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

function chip(label: string, kind: string, id?: string): MdNode {
  return {
    type: "dtToken",
    data: {
      hName: "span",
      hProperties: {
        className: ["dt-mention", `dt-mention-${kind}`],
        ...(id ? { title: `Discord ID: ${id}` } : {}),
      },
    },
    children: [{ type: "text", value: label }],
  };
}

function formatTimestamp(seconds: string): string {
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms)) return "unknown time";
  // Deterministic UTC render (no locale/timezone → hydration-safe): "5 Jan 2026, 14:03 UTC".
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
}

function tokenNode(m: RegExpExecArray, mentions: MentionMap): MdNode {
  // Branch 1: user / role / channel mentions.
  if (m[2] !== undefined) {
    const sigil = m[1];
    const id = m[2];
    if (sigil === "#") return chip("#channel", "channel", id);
    if (sigil === "@&") return chip("@role", "role", id);
    const name = mentions[id];
    return name ? chip(`@${name}`, "user", id) : chip("@unknown", "user-unknown", id);
  }
  // Branch 2: custom (animated) emoji.
  if (m[4] !== undefined) return chip(`:${m[4]}:`, "emoji", m[5]);
  // Branch 3: timestamp.
  if (m[6] !== undefined) return chip(formatTimestamp(m[6]), "time");
  return { type: "text", value: m[0] };
}

function splitText(value: string, mentions: MentionMap): MdNode[] {
  const out: MdNode[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(value)) !== null) {
    if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
    out.push(tokenNode(m, mentions));
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

/** unified/remark plugin factory. Pass `[remarkDiscordTokens, { mentions }]`.
 * The transformer boundary is typed `unknown` so it's assignable to unified's
 * `Plugin`/`Transformer` types without depending on `@types/mdast`; internally
 * the tree is the loose `MdNode` shape above. */
export function remarkDiscordTokens({ mentions = {} }: { mentions?: MentionMap } = {}) {
  return (tree: unknown) => {
    const walk = (node: MdNode): void => {
      if (!node.children || node.children.length === 0) return;
      const next: MdNode[] = [];
      for (const child of node.children) {
        // Only rewrite plain text; leaves like `inlineCode` carry `value` under
        // a non-"text" type, so backticked `<@123>` is left untouched.
        if (child.type === "text" && typeof child.value === "string" && child.value.includes("<")) {
          next.push(...splitText(child.value, mentions));
        } else {
          walk(child);
          next.push(child);
        }
      }
      node.children = next;
    };
    walk(tree as MdNode);
  };
}
