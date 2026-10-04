/**
 * Plugin test builds for Bug Testers (backend `web_api/routes/tester_builds.py`).
 *
 * A private build job publishes a zip of the newest plugin commit plus a JSON
 * manifest; the Web API reads those manifests and records who downloaded
 * which build. Three surfaces read these shapes: the tester page at
 * /bug-testing, the download handler at /dl/bugtest.zip, and the staff view at
 * /admin/testers.
 *
 * Every timestamp is unix seconds. Nullable fields also accept being absent:
 * manifests are written by a job outside these repos, and an older manifest
 * that predates a field should render with a gap rather than fail the page.
 */
import { z } from "zod";

/**
 * The only file names the download handler will hand to nginx. The name ends
 * up in an `X-Accel-Redirect` path and a `Content-Disposition` header, so it
 * must not be able to carry a path separator, a quote or a line break.
 */
export const TESTER_BUILD_FILE_PATTERN = /^[A-Za-z0-9._-]+\.zip$/;

const unixOrNull = z.number().int().nullable().default(null);
const textOrNull = z.string().nullable().default(null);

/** One plugin commit, as shown in a build's change lists. */
export const TesterBuildChangeSchema = z.object({
  commit: z.string(),
  short: z.string(),
  /** The plugin version this commit shipped as, when the build job could tell. */
  version: textOrNull,
  title: z.string(),
  points: z.array(z.string()).default([]),
  date: unixOrNull,
  pr: z.number().int().nullable().default(null),
});
export type TesterBuildChange = z.infer<typeof TesterBuildChangeSchema>;

/** The commit the Plugin Hub currently ships. */
export const TesterBuildReleaseSchema = z.object({
  commit: z.string(),
  short: z.string(),
  version: textOrNull,
  /** False when the release commit is not in this build's history. */
  is_ancestor: z.boolean(),
});
export type TesterBuildRelease = z.infer<typeof TesterBuildReleaseSchema>;

export const TesterBuildSchema = z.object({
  build_id: z.string(),
  version: z.string(),
  commit: z.string(),
  short: z.string(),
  ref: textOrNull,
  runelite_version: z.string(),
  built_at: unixOrNull,
  size_bytes: z.number().int(),
  sha256: textOrNull,
  /** Why the job built: "plugin" | "runelite" | "manual" | "initial". Left
   *  open so a new reason reads as an unknown label, not a parse failure. */
  reason: z.string(),
  repo_url: textOrNull,
  release: TesterBuildReleaseSchema.nullable().default(null),
  /** New in this build compared with the one before it, newest first. */
  changes: z.array(TesterBuildChangeSchema).default([]),
  /** Everything since the Plugin Hub release, newest first. Always empty on
   *  the `recent` builds: only the current build carries the full list. */
  since_release: z.array(TesterBuildChangeSchema).default([]),
});
export type TesterBuild = z.infer<typeof TesterBuildSchema>;

/** One download the signed-in user made. */
export const TesterBuildDownloadRowSchema = z.object({
  build_id: z.string(),
  version: textOrNull,
  downloaded_at: z.number().int(),
});
export type TesterBuildDownloadRow = z.infer<typeof TesterBuildDownloadRowSchema>;

/** GET /tester-builds */
export const TesterBuildsSchema = z.object({
  current: TesterBuildSchema.nullable(),
  recent: z.array(TesterBuildSchema),
  my_downloads: z.array(TesterBuildDownloadRowSchema),
  /** The caller already downloaded the current build. */
  has_current: z.boolean(),
  is_staff: z.boolean(),
});
export type TesterBuilds = z.infer<typeof TesterBuildsSchema>;

/** POST /tester-builds/download */
export const TesterBuildDownloadSchema = z.object({
  file: z.string().regex(TESTER_BUILD_FILE_PATTERN),
  filename: z.string(),
  build_id: z.string(),
  version: z.string(),
  size_bytes: z.number().int(),
});
export type TesterBuildDownload = z.infer<typeof TesterBuildDownloadSchema>;

// --- Staff view ----------------------------------------------------------

export const TESTER_PIPELINE_STATES = ["ok", "failed", "building", "unknown"] as const;
export type TesterPipelineState = (typeof TESTER_PIPELINE_STATES)[number];

export const TesterPipelineStatusSchema = z.object({
  /** A state this build of the site does not know reads as "unknown" rather
   *  than taking the staff page down with it. */
  state: z.enum(TESTER_PIPELINE_STATES).catch("unknown"),
  checked_at: unixOrNull,
  ref: textOrNull,
  head_commit: textOrNull,
  runelite_version: textOrNull,
  error: textOrNull,
  current_build_id: textOrNull,
});
export type TesterPipelineStatus = z.infer<typeof TesterPipelineStatusSchema>;

/** One published build with its download counts. */
export const AdminTesterBuildRowSchema = z.object({
  build_id: z.string(),
  version: textOrNull,
  runelite_version: textOrNull,
  built_at: unixOrNull,
  reason: textOrNull,
  downloads: z.number().int(),
  /** Distinct users who downloaded it. */
  testers: z.number().int(),
});
export type AdminTesterBuildRow = z.infer<typeof AdminTesterBuildRowSchema>;

/** The plugin version a tester's client most recently reported. */
export const TesterSeenVersionSchema = z.object({
  version: z.string(),
  first_seen: z.number().int(),
  last_seen: z.number().int(),
  /** Ahead of the Plugin Hub release, so it can only be a test build. */
  prerelease: z.boolean(),
  player_name: textOrNull,
});
export type TesterSeenVersion = z.infer<typeof TesterSeenVersionSchema>;

export const TesterSchema = z.object({
  user_id: z.number().int(),
  discord_id: textOrNull,
  username: textOrNull,
  players: z.array(z.object({ player_id: z.number().int(), name: z.string() })).default([]),
  download_count: z.number().int(),
  last_download: TesterBuildDownloadRowSchema.nullable().default(null),
  has_current: z.boolean(),
  seen: TesterSeenVersionSchema.nullable().default(null),
  /** Versions first seen while still ahead of the release, newest first. */
  tested_versions: z.array(z.string()).default([]),
});
export type Tester = z.infer<typeof TesterSchema>;

export const AdminTesterDownloadSchema = z.object({
  user_id: z.number().int(),
  username: textOrNull,
  build_id: z.string(),
  version: textOrNull,
  downloaded_at: z.number().int(),
});
export type AdminTesterDownload = z.infer<typeof AdminTesterDownloadSchema>;

/** GET /admin/tester-builds */
export const AdminTesterBuildsSchema = z.object({
  status: TesterPipelineStatusSchema,
  current: TesterBuildSchema.nullable(),
  /** The version the Plugin Hub is on, when the build job could resolve it. */
  release_version: textOrNull,
  builds: z.array(AdminTesterBuildRowSchema),
  testers: z.array(TesterSchema),
  recent_downloads: z.array(AdminTesterDownloadSchema),
});
export type AdminTesterBuilds = z.infer<typeof AdminTesterBuildsSchema>;
