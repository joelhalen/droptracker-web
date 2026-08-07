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
