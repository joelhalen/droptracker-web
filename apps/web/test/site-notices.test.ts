import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdminPopupNoticeSchema,
  MyNoticesSchema,
  NoticeRuleSchema,
  PopupNoticeInputSchema,
  isAllowedNoticeLink,
  type PopupNotice,
} from "@droptracker/api-types";
import {
  CLOSED_MEMORY_TTL_MS,
  audienceProblem,
  blankRule,
  closedStorageKey,
  isExternalHref,
  isTypingTarget,
  localInputToUnix,
  parseClosedMemory,
  pruneClosedMemory,
  rememberClosed,
  splitByClosed,
  toSitePath,
  unixToLocalInput,
} from "../lib/site-notices";
import { insertBlock, insertLink, prefixLines, wrapSelection } from "../lib/markdown-edit";

const notice = (id: number): PopupNotice => ({
  id,
  title: `N${id}`,
  body_md: "hi",
  cta_label: null,
  cta_url: null,
  tone: "info",
  size: "md",
  sent_at: 1_700_000_000,
});

// --- closed memory -------------------------------------------------------

test("closed memory is per user", () => {
  assert.notEqual(closedStorageKey(0), closedStorageKey(1));
  assert.equal(closedStorageKey(0), "dt:notices:closed:0");
});

test("closed memory tolerates junk", () => {
  assert.deepEqual(parseClosedMemory(null), {});
  assert.deepEqual(parseClosedMemory("not json"), {});
  assert.deepEqual(parseClosedMemory("[1,2]"), {});
  assert.deepEqual(parseClosedMemory('{"5": 10, "x": 1, "6": "soon"}'), { "5": 10 });
});

test("remember + prune", () => {
  const now = 1_000_000_000_000;
  const m = rememberClosed({ "1": now - CLOSED_MEMORY_TTL_MS - 1 }, [2, 3], now);
  assert.deepEqual(Object.keys(m).sort(), ["1", "2", "3"]);
  assert.deepEqual(Object.keys(pruneClosedMemory(m, now)).sort(), ["2", "3"]);
});

test("notices closed in this browser are hidden and their close re-sent", () => {
  const { show, resend } = splitByClosed([notice(1), notice(2), notice(3)], { "2": 1 });
  assert.deepEqual(
    show.map((n) => n.id),
    [1, 3],
  );
  assert.deepEqual(resend, [2]);
});

// --- links -----------------------------------------------------------------

test("site paths stay in the tab, other sites open a new one", () => {
  const origin = "https://www.droptracker.io";
  assert.equal(isExternalHref("/premium", origin), false);
  assert.equal(isExternalHref("#top", origin), false);
  assert.equal(isExternalHref("https://www.droptracker.io/docs", origin), false);
  assert.equal(isExternalHref("https://runelite.net", origin), true);
  assert.equal(isExternalHref("//evil.example/x", origin), true);
  assert.equal(isExternalHref("mailto:a@b.c", origin), false);
  assert.equal(toSitePath("https://www.droptracker.io/docs?x=1#y", origin), "/docs?x=1#y");
  assert.equal(toSitePath("https://runelite.net/", origin), "https://runelite.net/");
});

test("button links match the backend's rule", () => {
  for (const ok of ["/premium", "https://runelite.net", "HTTP://x.io"]) assert.ok(isAllowedNoticeLink(ok), ok);
  for (const bad of ["//evil.example", "javascript:alert(1)", "premium", "data:text/html,x", ""])
    assert.ok(!isAllowedNoticeLink(bad), bad);
});

test("typing detection", () => {
  const el = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, ...extra }) as unknown as Element;
  assert.equal(isTypingTarget(null), false);
  assert.equal(isTypingTarget(el("TEXTAREA")), true);
  assert.equal(isTypingTarget(el("INPUT", { type: "text" })), true);
  assert.equal(isTypingTarget(el("INPUT", { type: "checkbox" })), false);
  assert.equal(isTypingTarget(el("DIV", { isContentEditable: true })), true);
  assert.equal(isTypingTarget(el("BUTTON")), false);
});

// --- composer helpers -------------------------------------------------------

test("datetime-local round trip", () => {
  assert.equal(localInputToUnix(""), null);
  const ts = localInputToUnix("2026-10-01T09:30");
  assert.ok(ts);
  assert.equal(unixToLocalInput(ts), "2026-10-01T09:30");
  assert.equal(unixToLocalInput(null), "");
});

test("audience problems mirror the backend", () => {
  assert.ok(audienceProblem([]));
  assert.ok(audienceProblem([blankRule("users")]));
  assert.ok(audienceProblem([{ type: "group_leaders", roles: [], group_ids: [], group_tiers: [] }]));
  assert.equal(audienceProblem([blankRule("group_leaders"), { type: "users", user_ids: [0] }]), null);
  assert.equal(audienceProblem([blankRule("staff")]), null);
});

test("blank rules parse", () => {
  for (const t of ["everyone", "staff", "users", "group_leaders", "group_members", "supporters"] as const) {
    NoticeRuleSchema.parse(blankRule(t));
  }
});

// --- contract ---------------------------------------------------------------

test("admin payload shape (backend _admin_payload + _full)", () => {
  AdminPopupNoticeSchema.parse({
    id: 3,
    title: "Hello",
    body_md: "**hi**",
    cta_label: "Go",
    cta_url: "/premium",
    tone: "important",
    size: "lg",
    audience: [
      { type: "group_leaders", roles: ["owner"], group_ids: [], group_tiers: ["t3"] },
      { type: "users", user_ids: [0, 5] },
    ],
    audience_summary: "Clan owners of Tier 3 groups + 2 people",
    status: "live",
    state: "scheduled",
    starts_at: 1_800_000_000,
    expires_at: null,
    sent_at: 1_700_000_000,
    ended_at: null,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    audience_estimate: 11,
    seen_count: 0,
    dismissed_count: 0,
    labels: { users: { "0": "joelhalen" }, groups: {}, tiers: { t3: "Tier 3", free: "Free" } },
  });
  MyNoticesSchema.parse({ items: [notice(1)] });
});

test("composer input rejects an empty audience", () => {
  const base = {
    title: "T",
    body_md: "B",
    cta_label: null,
    cta_url: null,
    tone: "info",
    size: "md",
    starts_at: null,
    expires_at: null,
  } as const;
  assert.throws(() => PopupNoticeInputSchema.parse({ ...base, audience: [] }));
  PopupNoticeInputSchema.parse({ ...base, audience: [{ type: "staff" }] });
});

// --- markdown toolbar ----------------------------------------------------------

test("wrap toggles", () => {
  const a = wrapSelection("say hi", 4, 6, "**", "**", "bold");
  assert.equal(a.value, "say **hi**");
  assert.equal(a.value.slice(a.selStart, a.selEnd), "hi");
  const b = wrapSelection(a.value, a.selStart, a.selEnd, "**", "**", "bold");
  assert.equal(b.value, "say hi");
  const c = wrapSelection("", 0, 0, "_", "_", "italic text");
  assert.equal(c.value, "_italic text_");
  assert.equal(c.value.slice(c.selStart, c.selEnd), "italic text");
});

test("line prefixes toggle across the selected lines", () => {
  const text = "one\ntwo\nthree";
  const a = prefixLines(text, 1, 6, "- ");
  assert.equal(a.value, "- one\n- two\nthree");
  const b = prefixLines(a.value, a.selStart, a.selEnd, "- ");
  assert.equal(b.value, text);
  const n = prefixLines(text, 0, text.length, (i) => `${i + 1}. `);
  assert.equal(n.value, "1. one\n2. two\n3. three");
});

test("blocks land on their own lines", () => {
  assert.equal(insertBlock("abc", 3, 3, "---").value, "abc\n\n---");
  assert.equal(insertBlock("abc\n\ndef", 5, 5, "---").value, "abc\n\n---\n\ndef");
  const img = insertBlock("", 0, 0, "![Describe the image](https://)", [22, 30]);
  assert.equal(img.value.slice(img.selStart, img.selEnd), "https://");
});

test("links select the url", () => {
  const r = insertLink("see docs", 4, 8);
  assert.equal(r.value, "see [docs](https://)");
  assert.equal(r.value.slice(r.selStart, r.selEnd), "https://");
});
