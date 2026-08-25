/**
 * Discord embed title rules, shared by the embed editor preview.
 *
 * Discord renders an embed *title* as plain text: masked links, bold, code
 * ticks and the rest all show their markers. The backend's notification
 * service therefore flattens markdown out of the title before sending
 * (`strip_title_markdown` in the disc repo's `utils/format.py`), and the
 * preview has to show the same thing — otherwise the editor promises a link
 * the title can never render, which is exactly how group leaders got confused.
 *
 * Keep this in sync with the Python. `apps/web/test/embed-title.test.ts`
 * covers the same cases as `tests/unit/test_format.py::TestStripTitleMarkdown`.
 */

/** `[label](url)` — captures the label, drops the target. */
const TITLE_MD_LINK = /\[([^[\]]*)\]\(\s*<?[^)\s]*>?(?:\s+"[^"]*")?\s*\)/g;

/**
 * Paired emphasis markers only, so a lone marker character survives. Single
 * `_underscore_` is deliberately absent on both sides: OSRS display names
 * contain underscores (the plugin submits `Beast_Owned`), and stripping them
 * would corrupt names for the sake of an italic nobody writes in a title.
 */
const TITLE_MD_MARKERS = [
  /\*\*\*([\s\S]+?)\*\*\*/g,
  /\*\*([\s\S]+?)\*\*/g,
  /\*([\s\S]+?)\*/g,
  /___([\s\S]+?)___/g,
  /__([\s\S]+?)__/g,
  /~~([\s\S]+?)~~/g,
  /`+([^`]+)`+/g,
];

/** Flatten Discord markdown that an embed title cannot render. */
export function flattenTitleMarkdown(text: string): string {
  let out = text.replace(TITLE_MD_LINK, "$1");
  for (const re of TITLE_MD_MARKERS) out = out.replace(re, "$1");
  return out;
}

/**
 * Collapse the whitespace an empty placeholder leaves behind.
 *
 * `{item_emoji} {item_name}` resolves to " Abyssal whip" for an item with no
 * emoji, and Discord renders that leading space. The backend trims it at send
 * time (`tidy_title` in `utils/format.py`), so the preview has to as well —
 * otherwise the editor shows an indent the posted message will not have.
 */
export function tidyTitle(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Tokens whose value is a Discord custom emoji, and the icon the preview draws
 * in their place.
 *
 * These cannot be previewed with a string sample the way every other token is.
 * The message carries `<:item_twisted_bow:1541…>`, which Discord turns into a
 * picture and every other reader — including this preview — sees as raw text.
 * So the token is left unsubstituted and rendered as an image instead.
 *
 * The sample is Twisted bow, matching the backend's own token sample.
 */
export const TOKEN_SAMPLE_ICONS: Readonly<Record<string, string>> = {
  "{item_emoji}": "https://www.droptracker.io/img/itemdb/20997.png",
};

/** The sample icon for a placeholder token, or undefined if it has none. */
export function sampleIconFor(token: string): string | undefined {
  return TOKEN_SAMPLE_ICONS[token];
}
