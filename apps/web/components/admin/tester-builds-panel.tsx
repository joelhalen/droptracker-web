/**
 * Staff view of the plugin test builds: is the build job healthy, what is the
 * current build, and is each Bug Tester actually running it.
 *
 * A download only proves someone fetched the zip. The "plugin last seen"
 * column is the version their client last reported, so the two together
 * answer the question staff care about before a release: who has tested this.
 *
 * Server-safe (no hooks): the page is force-dynamic and read-only.
 */
import Link from "next/link";
import type {
  AdminTesterBuilds,
  Tester,
  TesterPipelineState,
  TesterPipelineStatus,
} from "@droptracker/api-types";
import { Badge, Card, EmptyState, StatTile, type BadgeVariant } from "@/components/ui";
import { RelativeTime } from "@/components/local-time";
import { CommitLink, When } from "@/components/tester-builds/build-bits";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import {
  HUB_RELEASE_MATCH_LINE,
  buildReasonLabel,
  matchesHubRelease,
  versionLabel,
} from "@/lib/tester-builds";

const STATE_BADGE: Record<TesterPipelineState, { label: string; variant: BadgeVariant }> = {
  ok: { label: "OK", variant: "green" },
  failed: { label: "Failed", variant: "red" },
  building: { label: "Building", variant: "gold" },
  unknown: { label: "Unknown", variant: "neutral" },
};

const TH = "px-4 py-2 font-medium";
const TD = "px-4 py-2.5 align-top";
const SECTION_HEADING = "text-osrs-gold mb-2 text-sm font-semibold";
const MUTED = "text-osrs-parchment-dark/60";

/** Tables here are wider than a phone: let the card scroll sideways instead
 *  of pushing the admin grid wider than the screen. */
function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <Card padding="p-0" className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </Card>
  );
}

function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead className="bg-osrs-brown-dark/60 text-osrs-parchment-dark/70">
      <tr>
        {columns.map((column) => (
          <th key={column} className={TH}>
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function PipelineStatus({
  status,
  repoUrl,
}: {
  status: TesterPipelineStatus;
  repoUrl: string | null;
}) {
  const state = STATE_BADGE[status.state];
  return (
    <section className="space-y-3">
      <h3 className={SECTION_HEADING}>Build pipeline</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="State"
          value={
            <Badge variant={state.variant} size="lg">
              {state.label}
            </Badge>
          }
        />
        <StatTile
          label="Last checked"
          value={status.checked_at != null ? formatRelativeTime(status.checked_at) : "Never"}
        />
        <StatTile label="Branch" value={status.ref ?? "Unknown"} />
        <StatTile
          label="Head commit"
          value={
            status.head_commit ? (
              <CommitLink repoUrl={repoUrl} commit={status.head_commit} />
            ) : (
              "Unknown"
            )
          }
        />
        <StatTile label="RuneLite" value={status.runelite_version ?? "Unknown"} />
      </div>
      {status.state === "failed" && (
        <div
          role="alert"
          className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border px-3 py-2 text-sm"
        >
          <p className="font-medium">The last build failed.</p>
          <pre className="mt-1 font-mono text-xs break-words whitespace-pre-wrap">
            {status.error ?? "No error text was recorded."}
          </pre>
        </div>
      )}
    </section>
  );
}

function CurrentBuild({ data }: { data: AdminTesterBuilds }) {
  const { current } = data;
  const hubVersion = data.release_version ?? current?.release?.version ?? null;
  return (
    <section className="space-y-3">
      <h3 className={SECTION_HEADING}>Current build</h3>
      {current ? (
        <Card className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant="gold" size="lg">
              {versionLabel(current.version)}
            </Badge>
            {current.runelite_version && <span>RuneLite {current.runelite_version}</span>}
            <span className={MUTED}>
              Built <When unix={current.built_at} />
            </span>
            {(current.short || current.commit) && (
              <span className={MUTED}>
                Commit{" "}
                <CommitLink
                  repoUrl={current.repo_url}
                  commit={current.commit}
                  short={current.short}
                />
              </span>
            )}
            <span className={MUTED}>{formatBytes(current.size_bytes)}</span>
            <span className={MUTED}>{buildReasonLabel(current.reason)}</span>
          </div>
          <p className="text-osrs-parchment-dark/80">
            {hubVersion
              ? `The Plugin Hub is on ${versionLabel(hubVersion)}.`
              : "The Plugin Hub version is not known."}{" "}
            {matchesHubRelease(current)
              ? HUB_RELEASE_MATCH_LINE
              : `${current.since_release.length} ${
                  current.since_release.length === 1 ? "change" : "changes"
                } since that release.`}
          </p>
          {current.release && !current.release.is_ancestor && (
            <p>
              <Badge variant="ember">Release commit is not in this build&apos;s history</Badge>
            </p>
          )}
        </Card>
      ) : (
        <EmptyState
          title="No test build is published"
          hint={
            hubVersion ? `The Plugin Hub is on ${versionLabel(hubVersion)}.` : undefined
          }
        />
      )}
    </section>
  );
}

function BuildsTable({ data }: { data: AdminTesterBuilds }) {
  const currentId = data.current?.build_id ?? null;
  return (
    <section>
      <h3 className={SECTION_HEADING}>Builds</h3>
      {data.builds.length === 0 ? (
        <p className={`${MUTED} text-sm`}>No builds have been published yet.</p>
      ) : (
        <TableCard>
          <TableHead columns={["Build", "Built", "Reason", "Downloads", "Testers"]} />
          <tbody className="divide-osrs-bronze/15 divide-y">
            {data.builds.map((build) => (
              <tr key={build.build_id}>
                <td className={TD}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {versionLabel(build.version, "No version")}
                    </span>
                    {build.build_id === currentId && (
                      <Badge variant="green" size="sm">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className={`${MUTED} font-mono text-xs break-all`}>{build.build_id}</div>
                  {build.runelite_version && (
                    <div className={`${MUTED} text-xs`}>RuneLite {build.runelite_version}</div>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  <When unix={build.built_at} />
                </td>
                <td className={TD}>{buildReasonLabel(build.reason)}</td>
                <td className={`${TD} tabular-nums`}>{build.downloads}</td>
                <td className={`${TD} tabular-nums`}>{build.testers}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </section>
  );
}

/** Never a truthiness test on the id: user 0 is a real account. */
function testerName(tester: { user_id: number; username: string | null }): string {
  return tester.username ?? `User ${tester.user_id}`;
}

function TesterRow({ tester }: { tester: Tester }) {
  const { last_download: last, seen } = tester;
  return (
    <tr>
      <td className={TD}>
        <div className="font-medium">{testerName(tester)}</div>
        {tester.discord_id && (
          <div className={`${MUTED} font-mono text-xs`}>Discord {tester.discord_id}</div>
        )}
      </td>
      <td className={TD}>
        {tester.players.length === 0 ? (
          <span className={MUTED}>None linked</span>
        ) : (
          <ul className="space-y-0.5">
            {tester.players.map((player) => (
              <li key={player.player_id}>
                <Link
                  href={`/players/${player.player_id}`}
                  className="text-osrs-gold-bright hover:underline"
                >
                  {player.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className={TD}>
        {last ? (
          <>
            <div className="font-medium">{versionLabel(last.version, last.build_id)}</div>
            <div className={`${MUTED} text-xs`}>
              <When unix={last.downloaded_at} />
            </div>
            <div className={`${MUTED} text-xs`}>
              {tester.download_count} {tester.download_count === 1 ? "download" : "downloads"}
            </div>
          </>
        ) : (
          <span className={MUTED}>Never</span>
        )}
      </td>
      <td className={TD}>
        <Badge variant={tester.has_current ? "green" : "neutral"}>
          {tester.has_current ? "Yes" : "No"}
        </Badge>
      </td>
      <td className={TD}>
        {seen ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{versionLabel(seen.version)}</span>
              {seen.prerelease && (
                <Badge variant="sky" size="sm">
                  test build
                </Badge>
              )}
            </div>
            <div className={`${MUTED} text-xs`}>
              Last seen <When unix={seen.last_seen} />{" "}
              <RelativeTime unix={seen.last_seen} prefix="·" />
            </div>
            {seen.player_name && <div className={`${MUTED} text-xs`}>on {seen.player_name}</div>}
          </>
        ) : (
          <span className={MUTED}>Not seen</span>
        )}
      </td>
      <td className={TD}>
        {tester.tested_versions.length === 0 ? (
          <span className={MUTED}>None</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {tester.tested_versions.map((version) => (
              <Badge key={version} variant="bronze" size="sm">
                {versionLabel(version)}
              </Badge>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

function TestersTable({ testers }: { testers: Tester[] }) {
  return (
    <section>
      <h3 className={SECTION_HEADING}>Testers</h3>
      {testers.length === 0 ? (
        <EmptyState title="No Bug Testers yet" />
      ) : (
        <TableCard>
          <TableHead
            columns={[
              "Tester",
              "RSNs",
              "Last download",
              "Has current build",
              "Plugin last seen",
              "Tested before release",
            ]}
          />
          <tbody className="divide-osrs-bronze/15 divide-y">
            {testers.map((tester) => (
              <TesterRow key={tester.user_id} tester={tester} />
            ))}
          </tbody>
        </TableCard>
      )}
    </section>
  );
}

function RecentDownloads({ data }: { data: AdminTesterBuilds }) {
  return (
    <section>
      <h3 className={SECTION_HEADING}>Recent downloads</h3>
      {data.recent_downloads.length === 0 ? (
        <p className={`${MUTED} text-sm`}>Nobody has downloaded a test build yet.</p>
      ) : (
        <TableCard>
          <TableHead columns={["When", "Tester", "Build"]} />
          <tbody className="divide-osrs-bronze/15 divide-y">
            {data.recent_downloads.map((row, i) => (
              <tr key={`${row.user_id}-${row.build_id}-${row.downloaded_at}-${i}`}>
                <td className={`${TD} whitespace-nowrap`}>
                  <When unix={row.downloaded_at} />
                </td>
                <td className={TD}>{testerName(row)}</td>
                <td className={TD}>
                  <span className="font-medium">{versionLabel(row.version, "No version")}</span>
                  <span className={`${MUTED} ml-2 font-mono text-xs break-all`}>
                    {row.build_id}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </section>
  );
}

export function AdminTesterBuildsPanel({ data }: { data: AdminTesterBuilds }) {
  return (
    <div className="space-y-8">
      <PipelineStatus status={data.status} repoUrl={data.current?.repo_url ?? null} />
      <CurrentBuild data={data} />
      <BuildsTable data={data} />
      <TestersTable testers={data.testers} />
      <RecentDownloads data={data} />
    </div>
  );
}
