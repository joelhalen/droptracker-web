import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TesterBuildDownloadSchema,
  TesterBuildSchema,
  TesterBuildsSchema,
  type TesterBuild,
  type TesterBuildChange,
} from "@droptracker/api-types";
import {
  DOWNLOAD_CACHE_CONTROL,
  HUB_RELEASE_MATCH_LINE,
  SAFE_ZIP_NAME,
  accelHeaders,
  buildReasonLabel,
  buildSummaryLine,
  commitUrl,
  downloadPath,
  downloadResponsePlan,
  downloadStatusLine,
  groupChangesByVersion,
  loginPath,
  matchesHubRelease,
  pagePath,
  prUrl,
  versionLabel,
} from "../lib/tester-builds";
import { mockTesterBuilds } from "../lib/mock-data";

const REPO = "https://github.com/joelhalen/droptracker-plugin";
const SHA = "2cd73bee12d03228b65e76543e2a82f187720d28";
const ZIP = "droptracker-dev-6.0.19-2cd73be-rl1.13.1.zip";

function change(version: string | null, title: string): TesterBuildChange {
  return { commit: SHA, short: "2cd73be", version, title, points: [], date: null, pr: null };
}

function build(over: Partial<TesterBuild> = {}): TesterBuild {
  return { ...mockTesterBuilds().current!, ...over };
}

// --- Download handler ------------------------------------------------------

test("a 200 with a safe zip name is handed to nginx", () => {
  const plan = downloadResponsePlan(200, {
    file: ZIP,
    filename: ZIP,
    build_id: "6.0.19-2cd73be-rl1.13.1",
    version: "6.0.19",
    size_bytes: 28_563_998,
  });
  assert.deepEqual(plan, { kind: "accel", file: ZIP });
});

test("a 401 sends the visitor to sign in", () => {
  assert.deepEqual(downloadResponsePlan(401, null), { kind: "login" });
  // Even with a body that looks like a download: the status decides.
  assert.deepEqual(downloadResponsePlan(401, { file: ZIP }), { kind: "login" });
});

test("every other status goes back to the page, which explains why", () => {
  // 403 not a tester, 404 no build published, 5xx backend trouble.
  for (const status of [204, 302, 400, 403, 404, 429, 500, 502]) {
    assert.deepEqual(downloadResponsePlan(status, { file: ZIP }), { kind: "page" });
  }
});

test("an unsafe file name never reaches a header", () => {
  const unsafe = [
    "../etc/passwd.zip",
    "builds/evil.zip",
    "a\\b.zip",
    'quote".zip',
    "line\nbreak.zip",
    "line\r\nX-Evil: 1.zip",
    "space name.zip",
    "plugin.zip\n",
    "plugin.zip.exe",
    "plugin.ZIP",
    "plugin",
    ".zip",
    "",
  ];
  for (const file of unsafe) {
    assert.equal(SAFE_ZIP_NAME.test(file), false, JSON.stringify(file));
    assert.deepEqual(downloadResponsePlan(200, { file }), { kind: "page" }, JSON.stringify(file));
  }
});

test("a 200 without a usable body goes back to the page", () => {
  for (const body of [null, undefined, "", ZIP, [], {}, { file: null }, { file: 7 }, { filename: ZIP }]) {
    assert.deepEqual(downloadResponsePlan(200, body), { kind: "page" });
  }
});

test("only the file name decides: a recorded download is not refused over another field", () => {
  // The backend records the download before it answers, so a missing
  // size_bytes must not cost the tester the file.
  assert.deepEqual(downloadResponsePlan(200, { file: ZIP }), { kind: "accel", file: ZIP });
});

test("the full download response still validates the file name", () => {
  const ok = { file: ZIP, filename: ZIP, build_id: "b", version: "6.0.19", size_bytes: 1 };
  assert.doesNotThrow(() => TesterBuildDownloadSchema.parse(ok));
  assert.throws(() => TesterBuildDownloadSchema.parse({ ...ok, file: "../x.zip" }));
});

test("the hand-off headers name the internal location and are never cacheable", () => {
  const headers = accelHeaders(ZIP);
  assert.equal(headers["X-Accel-Redirect"], `/_tester-builds/${ZIP}`);
  assert.equal(headers["Content-Type"], "application/zip");
  assert.equal(headers["Content-Disposition"], `attachment; filename="${ZIP}"`);
  assert.equal(headers["Cache-Control"], "private, no-store");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(DOWNLOAD_CACHE_CONTROL, "private, no-store");
});

test("the paths the handler redirects between", () => {
  assert.equal(downloadPath, "/dl/bugtest.zip");
  assert.equal(pagePath, "/bug-testing");
  assert.equal(loginPath, "/api/auth/login?redirect=%2Fbug-testing");
});

// --- Links -----------------------------------------------------------------

test("commit links are built only for GitHub repositories", () => {
  assert.equal(commitUrl(REPO, SHA), `${REPO}/commit/${SHA}`);
  assert.equal(commitUrl(`${REPO}/`, SHA), `${REPO}/commit/${SHA}`);
  assert.equal(commitUrl(`${REPO}.git`, SHA), `${REPO}/commit/${SHA}`);
  assert.equal(commitUrl(REPO, "2cd73be"), `${REPO}/commit/2cd73be`);

  assert.equal(commitUrl(null, SHA), null);
  assert.equal(commitUrl(undefined, SHA), null);
  assert.equal(commitUrl("", SHA), null);
  assert.equal(commitUrl("http://github.com/joelhalen/droptracker-plugin", SHA), null);
  assert.equal(commitUrl("https://gitlab.com/joelhalen/droptracker-plugin", SHA), null);
  assert.equal(commitUrl("https://github.com.evil.example/a/b", SHA), null);
  assert.equal(commitUrl("https://github.com/only-owner", SHA), null);
  assert.equal(commitUrl("https://github.com/a/b/tree/master", SHA), null);
  assert.equal(commitUrl("https://github.com/a/b?x=1", SHA), null);
  assert.equal(commitUrl("javascript:alert(1)", SHA), null);
});

test("a commit that is not a hash gets no link", () => {
  assert.equal(commitUrl(REPO, ""), null);
  assert.equal(commitUrl(REPO, "master"), null);
  assert.equal(commitUrl(REPO, "abc"), null);
  assert.equal(commitUrl(REPO, `${SHA}/../../x`), null);
});

test("pull request links need a GitHub repository and a real number", () => {
  assert.equal(prUrl(REPO, 59), `${REPO}/pull/59`);
  assert.equal(prUrl(REPO, null), null);
  assert.equal(prUrl(REPO, undefined), null);
  assert.equal(prUrl(REPO, 0), null);
  assert.equal(prUrl(REPO, -3), null);
  assert.equal(prUrl(REPO, 1.5), null);
  assert.equal(prUrl(null, 59), null);
  assert.equal(prUrl("https://example.com/a/b", 59), null);
});

// --- Change lists ----------------------------------------------------------

test("changes group under one heading per version, newest first", () => {
  const groups = groupChangesByVersion([
    change("6.0.19", "a"),
    change("6.0.19", "b"),
    change("6.0.18", "c"),
    change("6.0.16", "d"),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.version, g.changes.map((c) => c.title)]),
    [
      ["6.0.19", ["a", "b"]],
      ["6.0.18", ["c"]],
      ["6.0.16", ["d"]],
    ],
  );
});

test("changes with no version share one group and are not guessed into a neighbour", () => {
  const groups = groupChangesByVersion([
    change("6.0.19", "a"),
    change(null, "b"),
    change("6.0.18", "c"),
    change(null, "d"),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.version, g.changes.map((c) => c.title)]),
    [
      ["6.0.19", ["a"]],
      [null, ["b", "d"]],
      ["6.0.18", ["c"]],
    ],
  );
});

test("a version split by another one still gets a single heading", () => {
  const groups = groupChangesByVersion([
    change("6.0.19", "a"),
    change("6.0.18", "b"),
    change("6.0.19", "c"),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.version, g.changes.map((c) => c.title)]),
    [
      ["6.0.19", ["a", "c"]],
      ["6.0.18", ["b"]],
    ],
  );
});

test("grouping nothing gives nothing, and the input is left alone", () => {
  assert.deepEqual(groupChangesByVersion([]), []);
  const input = Object.freeze([change("6.0.19", "a")]);
  assert.equal(groupChangesByVersion(input)[0]!.changes[0], input[0]);
});

test("version labels", () => {
  assert.equal(versionLabel("6.0.19"), "v6.0.19");
  assert.equal(versionLabel(null), "Unknown version");
  assert.equal(versionLabel(undefined, "Other changes"), "Other changes");
  assert.equal(versionLabel("", "Other changes"), "Other changes");
});

// --- Build copy ------------------------------------------------------------

test("a build with changes lets the list speak for itself", () => {
  assert.equal(buildSummaryLine(build()), null);
  // "initial" is not special: the list is shown as is.
  assert.equal(buildSummaryLine(build({ reason: "initial" })), null);
  assert.equal(buildSummaryLine(build({ reason: "runelite" })), null);
});

test("a RuneLite rebuild with no changes says so", () => {
  assert.equal(
    buildSummaryLine(build({ reason: "runelite", runelite_version: "1.13.2", changes: [] })),
    "Rebuilt for RuneLite 1.13.2. No plugin changes.",
  );
});

test("a RuneLite rebuild with no version on record still reads as a sentence", () => {
  assert.equal(
    buildSummaryLine(build({ reason: "runelite", runelite_version: "", changes: [] })),
    "Rebuilt for a new RuneLite version. No plugin changes.",
  );
});

test("any other build with no changes gets the plain line", () => {
  for (const reason of ["plugin", "manual", "initial", "something-new"]) {
    assert.equal(
      buildSummaryLine(build({ reason, changes: [] })),
      "No plugin changes in this build.",
    );
  }
});

test("a build matches the Plugin Hub release only on the same version with nothing since", () => {
  const release = { commit: SHA, short: "2cd73be", version: "6.0.19", is_ancestor: true };
  assert.equal(matchesHubRelease(build({ release, since_release: [] })), true);
  // Same version number but commits on top: still something to test.
  assert.equal(matchesHubRelease(build({ release })), false);
  assert.equal(
    matchesHubRelease(build({ release: { ...release, version: "6.0.12" }, since_release: [] })),
    false,
  );
  assert.equal(
    matchesHubRelease(build({ release: { ...release, version: null }, since_release: [] })),
    false,
  );
  // No release known: an empty list proves nothing.
  assert.equal(matchesHubRelease(build({ release: null, since_release: [] })), false);
  assert.equal(matchesHubRelease(build()), false);
});

test("the line under the Download button", () => {
  const older = [{ build_id: "old", version: "6.0.18", downloaded_at: 1 }];
  assert.equal(downloadStatusLine({ has_current: true, my_downloads: older }), "You have this build.");
  assert.equal(
    downloadStatusLine({ has_current: false, my_downloads: older }),
    "New since your last download.",
  );
  assert.equal(downloadStatusLine({ has_current: false, my_downloads: [] }), null);
});

test("build reasons read as words, and an unknown one shows as written", () => {
  assert.equal(buildReasonLabel("plugin"), "Plugin change");
  assert.equal(buildReasonLabel("runelite"), "RuneLite update");
  assert.equal(buildReasonLabel("manual"), "Manual rebuild");
  assert.equal(buildReasonLabel("initial"), "First build");
  assert.equal(buildReasonLabel("nightly"), "nightly");
  assert.equal(buildReasonLabel("constructor"), "constructor");
  assert.equal(buildReasonLabel(null), "Unknown");
  assert.equal(buildReasonLabel(""), "Unknown");
});

test("visible copy carries no em-dashes", () => {
  const lines = [
    HUB_RELEASE_MATCH_LINE,
    buildSummaryLine(build({ changes: [] })),
    buildSummaryLine(build({ reason: "runelite", changes: [] })),
    downloadStatusLine({ has_current: true, my_downloads: [] }),
    downloadStatusLine({ has_current: false, my_downloads: [{ build_id: "b", version: null, downloaded_at: 1 }] }),
  ];
  // Built from its code point so this file passes the same check it makes.
  const emDash = String.fromCharCode(0x2014);
  for (const line of lines) assert.equal((line ?? "").includes(emDash), false, line ?? "");
});

// --- Schemas ---------------------------------------------------------------

test("a build parses with its nullable fields missing or null", () => {
  // Manifests come from a job outside these repos; an older one that lacks a
  // field must render with a gap rather than fail the page.
  const bare = {
    build_id: "6.0.19-2cd73be-rl1.13.1",
    version: "6.0.19",
    commit: SHA,
    short: "2cd73be",
    runelite_version: "1.13.1",
    size_bytes: 1,
    reason: "plugin",
  };
  const parsed = TesterBuildSchema.parse(bare);
  assert.equal(parsed.ref, null);
  assert.equal(parsed.built_at, null);
  assert.equal(parsed.sha256, null);
  assert.equal(parsed.repo_url, null);
  assert.equal(parsed.release, null);
  assert.deepEqual(parsed.changes, []);
  assert.deepEqual(parsed.since_release, []);

  const nulled = TesterBuildSchema.parse({
    ...bare,
    ref: null,
    built_at: null,
    sha256: null,
    repo_url: null,
    release: null,
    changes: [{ commit: SHA, short: "2cd73be", version: null, title: "t", points: [], date: null, pr: null }],
  });
  assert.equal(nulled.changes[0]!.version, null);
  assert.equal(nulled.changes[0]!.pr, null);
});

test("the tester payload parses with no build published", () => {
  const empty = TesterBuildsSchema.parse({
    current: null,
    recent: [],
    my_downloads: [],
    has_current: false,
    is_staff: false,
  });
  assert.equal(empty.current, null);
});
