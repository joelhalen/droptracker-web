/**
 * Pure text edits behind a Markdown toolbar: each takes the textarea's value
 * and selection and returns the new value plus where the selection should
 * land, so the component only has to apply it. Pinned by
 * `test/markdown-edit.test.ts`.
 */
export type EditResult = { value: string; selStart: number; selEnd: number };

/** Wrap the selection (or a placeholder, selected) in `before`/`after`.
 * Wrapping an already-wrapped selection unwraps it. */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): EditResult {
  const selected = value.slice(start, end);
  const outerStart = start - before.length;
  const outerEnd = end + after.length;
  if (
    selected &&
    outerStart >= 0 &&
    value.slice(outerStart, start) === before &&
    value.slice(end, outerEnd) === after
  ) {
    return {
      value: value.slice(0, outerStart) + selected + value.slice(outerEnd),
      selStart: outerStart,
      selEnd: outerStart + selected.length,
    };
  }
  const inner = selected || placeholder;
  const next = value.slice(0, start) + before + inner + after + value.slice(end);
  return { value: next, selStart: start + before.length, selEnd: start + before.length + inner.length };
}

/** Prefix every line the selection touches. `prefix` may depend on the
 * line's position (numbered lists). Lines that already carry the prefix lose
 * it instead, so the button toggles. */
export function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: string | ((index: number) => string),
): EditResult {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end > start && value[end - 1] === "\n" ? end - 1 : end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const make = typeof prefix === "function" ? prefix : () => prefix;
  const allPrefixed = lines.every((line, i) => line.startsWith(make(i)));
  const changed = lines.map((line, i) => {
    const p = make(i);
    return allPrefixed ? line.slice(p.length) : line.startsWith(p) ? line : p + line;
  });
  const block = changed.join("\n");
  return {
    value: value.slice(0, lineStart) + block + value.slice(lineEnd),
    selStart: lineStart,
    selEnd: lineStart + block.length,
  };
}

/** Insert a block on its own lines at the cursor, selecting `select` (a
 * [from, to] range inside `text`) or placing the cursor after it. */
export function insertBlock(
  value: string,
  start: number,
  end: number,
  text: string,
  select?: [number, number],
): EditResult {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = after === "" || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const at = start + lead.length;
  return {
    value: before + lead + text + trail + after,
    selStart: select ? at + select[0] : at + text.length,
    selEnd: select ? at + select[1] : at + text.length,
  };
}

/** `[text](url)` around the selection, with the url placeholder selected. */
export function insertLink(value: string, start: number, end: number): EditResult {
  const label = value.slice(start, end) || "link text";
  const url = "https://";
  const text = `[${label}](${url})`;
  const next = value.slice(0, start) + text + value.slice(end);
  const urlAt = start + label.length + 3;
  return { value: next, selStart: urlAt, selEnd: urlAt + url.length };
}
