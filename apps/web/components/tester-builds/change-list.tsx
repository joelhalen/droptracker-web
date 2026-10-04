/**
 * The change lists on the tester page: one flat list for "what's new in this
 * build", and the same rows grouped under a heading per plugin version for
 * "everything since the Plugin Hub release".
 */
import type { TesterBuildChange } from "@droptracker/api-types";
import { Badge } from "@/components/ui";
import { LocalTime } from "@/components/local-time";
import { groupChangesByVersion, prUrl, versionLabel } from "@/lib/tester-builds";
import { CommitLink } from "./build-bits";

export function ChangeList({
  changes,
  repoUrl,
  showVersion = true,
}: {
  changes: TesterBuildChange[];
  repoUrl: string | null;
  /** Off inside a version group, where the heading already says it. */
  showVersion?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {changes.map((change, i) => {
        const pr = prUrl(repoUrl, change.pr);
        return (
          <li
            key={`${change.commit}-${i}`}
            className="border-osrs-bronze/20 bg-osrs-surface-2/40 rounded-lg border px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-osrs-parchment font-medium">{change.title}</span>
              {showVersion && change.version && (
                <Badge variant="bronze" size="sm">
                  {versionLabel(change.version)}
                </Badge>
              )}
            </div>
            {change.points.length > 0 && (
              <ul className="text-osrs-parchment-dark/80 mt-1.5 list-disc space-y-0.5 pl-5 text-sm">
                {change.points.map((point, j) => (
                  <li key={j}>{point}</li>
                ))}
              </ul>
            )}
            <div className="text-osrs-parchment-dark/60 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <CommitLink repoUrl={repoUrl} commit={change.commit} short={change.short} />
              {pr && (
                <a
                  href={pr}
                  target="_blank"
                  rel="noreferrer"
                  className="text-osrs-gold-bright hover:underline"
                >
                  PR #{change.pr}
                </a>
              )}
              {change.date != null && <LocalTime unix={change.date} mode="date" />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The same rows under one heading per plugin version, newest version first. */
export function GroupedChangeList({
  changes,
  repoUrl,
}: {
  changes: TesterBuildChange[];
  repoUrl: string | null;
}) {
  return (
    <div className="space-y-5">
      {groupChangesByVersion(changes).map((group) => (
        <div key={group.version ?? "none"}>
          <h3 className="text-osrs-parchment mb-2 text-sm font-semibold">
            {versionLabel(group.version, "Other changes")}
          </h3>
          <ChangeList changes={group.changes} repoUrl={repoUrl} showVersion={false} />
        </div>
      ))}
    </div>
  );
}
