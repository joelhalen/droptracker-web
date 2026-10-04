/**
 * Pure helpers for the plugin test-build surfaces: the tester page at
 * /bug-testing, the download handler at /dl/bugtest.zip and the staff view at
 * /admin/testers.
 *
 * Kept out of the components and the route handler so the parts that have to
 * be right are unit-testable without Next: which file name may reach an nginx
 * header, where a failed download sends the visitor, and how a build with no
 * change list describes itself.
 */
import {
  TESTER_BUILD_FILE_PATTERN,
  TesterBuildDownloadSchema,
  type TesterBuild,
  type TesterBuilds,
} from "@droptracker/api-types";

/** The only zip names the download handler passes on. See the schema file for
 *  why the character set is this narrow. */
export const SAFE_ZIP_NAME = TESTER_BUILD_FILE_PATTERN;

/** The one stable download link. It always serves the current build, so it can
 *  be shared in Discord without going stale. */
export const downloadPath = "/dl/bugtest.zip";

export const pagePath = "/bug-testing";

/** Sign in, then land on the tester page (not on the download itself: coming
 *  back from Discord straight into a file download reads as a broken page). */
export const loginPath = `/api/auth/login?redirect=${encodeURIComponent(pagePath)}`;

/** nginx `internal` location that serves the published zips. */
const ACCEL_PREFIX = "/_tester-builds/";

/**
 * Every response from the download handler carries this. The path ends in
 * .zip and Cloudflare caches that extension by default, so a cacheable
 * response would hand the file (or a redirect) to people who are not signed in.
 */
export const DOWNLOAD_CACHE_CONTROL = "private, no-store";

// --- Download handler ----------------------------------------------------

export type DownloadPlan =
  | { kind: "accel"; file: string }
  | { kind: "login" }
  | { kind: "page" };

/**
 * What the download handler does with the Web API's answer.
 *
 * Only `file` is checked, on purpose. By the time a 200 arrives the download
 * is already recorded, so refusing it over an unrelated field would count a
 * download the tester never got. `file` is the one value that reaches a
 * header, and it must match SAFE_ZIP_NAME no matter what the backend says.
 */
export function downloadResponsePlan(status: number, body: unknown): DownloadPlan {
  if (status === 401) return { kind: "login" };
  if (status !== 200) return { kind: "page" };
  const parsed = TesterBuildDownloadSchema.pick({ file: true }).safeParse(body);
  return parsed.success ? { kind: "accel", file: parsed.data.file } : { kind: "page" };
}

/**
 * Headers for the hand-off to nginx. The handler sends no bytes: nginx sees
 * `X-Accel-Redirect` and serves the file itself, keeping the type, disposition
 * and cache headers set here.
 */
export function accelHeaders(file: string): Record<string, string> {
  return {
    "X-Accel-Redirect": ACCEL_PREFIX + file,
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${file}"`,
    "Cache-Control": DOWNLOAD_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
  };
}

// --- Links ---------------------------------------------------------------

const GITHUB_REPO = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/** `https://github.com/owner/repo`, or null for anything that is not a GitHub
 *  repository URL. The manifest's repo_url becomes an href, so it is rebuilt
 *  from its parts rather than trusted as written. */
function githubRepo(repoUrl: string | null | undefined): string | null {
  const match = repoUrl ? GITHUB_REPO.exec(repoUrl) : null;
  return match ? `https://github.com/${match[1]}/${match[2]}` : null;
}

export function commitUrl(repoUrl: string | null | undefined, commit: string): string | null {
  const repo = githubRepo(repoUrl);
  if (!repo || !COMMIT_SHA.test(commit)) return null;
  return `${repo}/commit/${commit}`;
}

export function prUrl(
  repoUrl: string | null | undefined,
  pr: number | null | undefined,
): string | null {
  const repo = githubRepo(repoUrl);
  if (!repo || pr == null || !Number.isInteger(pr) || pr < 1) return null;
  return `${repo}/pull/${pr}`;
}

// --- Change lists --------------------------------------------------------

export type ChangeGroup<T> = { version: string | null; changes: T[] };

/**
 * Group a newest-first change list under one heading per plugin version.
 *
 * Groups come out in the order their version first appears and each keeps its
 * changes in the order given, so a newest-first list stays newest first.
 * Changes with no version share one `null` group; they are never guessed into
 * a neighbouring version, because a commit between two version bumps could
 * belong to either.
 */
export function groupChangesByVersion<T extends { version: string | null }>(
  changes: readonly T[],
): ChangeGroup<T>[] {
  const groups: ChangeGroup<T>[] = [];
  const byVersion = new Map<string | null, ChangeGroup<T>>();
  for (const change of changes) {
    let group = byVersion.get(change.version);
    if (!group) {
      group = { version: change.version, changes: [] };
      byVersion.set(change.version, group);
      groups.push(group);
    }
    group.changes.push(change);
  }
  return groups;
}

/** "v6.0.19", or the fallback when the version is unknown. */
export function versionLabel(version: string | null | undefined, fallback = "Unknown version"): string {
  return version ? `v${version}` : fallback;
}

// --- Build copy ----------------------------------------------------------

/**
 * True when the current build is exactly what the Plugin Hub already ships.
 *
 * Only meaningful for the CURRENT build. The earlier builds arrive with
 * `since_release` emptied to keep the payload small, so for them an empty list
 * says nothing.
 */
export function matchesHubRelease(
  build: Pick<TesterBuild, "version" | "release" | "since_release">,
): boolean {
  return (
    build.release != null &&
    build.release.version === build.version &&
    build.since_release.length === 0
  );
}

export const HUB_RELEASE_MATCH_LINE =
  "This build matches the Plugin Hub release. Nothing new to test yet.";

/**
 * One plain sentence for a build that has no change list to show, or null
 * when it has one (the list speaks for itself).
 *
 * A RuneLite rebuild is the common empty case: the plugin did not change, the
 * client it is bundled with did. Every other reason, including the very first
 * build, falls through to the list when there is one.
 */
export function buildSummaryLine(
  build: Pick<TesterBuild, "reason" | "runelite_version" | "changes">,
): string | null {
  if (build.changes.length > 0) return null;
  if (build.reason === "runelite") {
    // The API sends "" for a manifest with no RuneLite version.
    return build.runelite_version
      ? `Rebuilt for RuneLite ${build.runelite_version}. No plugin changes.`
      : "Rebuilt for a new RuneLite version. No plugin changes.";
  }
  return "No plugin changes in this build.";
}

/** The line under the Download button, or null when there is nothing to say
 *  (a tester who has never downloaded a build). */
export function downloadStatusLine(
  data: Pick<TesterBuilds, "has_current" | "my_downloads">,
): string | null {
  if (data.has_current) return "You have this build.";
  if (data.my_downloads.length > 0) return "New since your last download.";
  return null;
}

const REASON_LABELS = new Map<string, string>([
  ["plugin", "Plugin change"],
  ["runelite", "RuneLite update"],
  ["manual", "Manual rebuild"],
  ["initial", "First build"],
]);

/** Why the build job ran, for the staff table. An unknown reason shows as
 *  written so a new one is visible instead of blank. */
export function buildReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Unknown";
  return REASON_LABELS.get(reason) ?? reason;
}
