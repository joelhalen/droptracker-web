/**
 * The current test build: what it is, and the one Download button.
 *
 * The button is a plain `<a>`, not a `<Link>`. The download handler records a
 * download every time it runs, so nothing may prefetch it. It also carries no
 * `download` attribute: when the handler redirects (signed out, no build) the
 * browser should follow it to a page, not save that page as a file.
 */
import type { TesterBuild } from "@droptracker/api-types";
import { Alert, Badge, Card, buttonVariants } from "@/components/ui";
import { RelativeTime } from "@/components/local-time";
import { formatBytes } from "@/lib/format";
import {
  HUB_RELEASE_MATCH_LINE,
  downloadPath,
  matchesHubRelease,
  versionLabel,
} from "@/lib/tester-builds";
import { CommitLink, When } from "./build-bits";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-osrs-parchment-dark/55">{label}</dt>
      <dd className="text-osrs-parchment-dark/90">{children}</dd>
    </div>
  );
}

export function CurrentBuildCard({
  build,
  statusLine,
}: {
  build: TesterBuild;
  /** "You have this build." and friends; null when there is nothing to say. */
  statusLine: string | null;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gold" size="lg">
              {versionLabel(build.version)}
            </Badge>
            {build.runelite_version && (
              <span className="text-osrs-parchment-dark/80 text-sm">
                for RuneLite {build.runelite_version}
              </span>
            )}
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Fact label="Built">
              <When unix={build.built_at} />
              {build.built_at != null && (
                <>
                  {" "}
                  <RelativeTime unix={build.built_at} prefix="·" />
                </>
              )}
            </Fact>
            {(build.short || build.commit) && (
              <Fact label="Commit">
                <CommitLink repoUrl={build.repo_url} commit={build.commit} short={build.short} />
              </Fact>
            )}
            <Fact label="Size">{formatBytes(build.size_bytes)}</Fact>
          </dl>
        </div>

        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <a href={downloadPath} className={buttonVariants({ variant: "primary", size: "lg" })}>
            Download
          </a>
          {statusLine && <p className="text-osrs-parchment-dark/70 text-xs">{statusLine}</p>}
        </div>
      </div>

      {matchesHubRelease(build) && <Alert variant="info">{HUB_RELEASE_MATCH_LINE}</Alert>}

      {build.sha256 && (
        <p className="text-osrs-parchment-dark/50 text-xs break-all">
          SHA-256 <code className="font-mono">{build.sha256}</code>
        </p>
      )}
    </Card>
  );
}
