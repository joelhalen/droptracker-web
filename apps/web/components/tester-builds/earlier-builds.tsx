/**
 * The builds before the current one, for a tester working out which build a
 * change first appeared in. Titles only: the full notes for anything still
 * unreleased are in the "since the Plugin Hub release" list above it.
 */
import type { TesterBuild } from "@droptracker/api-types";
import { Badge } from "@/components/ui";
import { buildSummaryLine, versionLabel } from "@/lib/tester-builds";
import { When } from "./build-bits";

export function EarlierBuilds({ builds }: { builds: TesterBuild[] }) {
  return (
    <ul className="divide-osrs-bronze/20 divide-y">
      {builds.map((build) => {
        const summary = buildSummaryLine(build);
        return (
          <li key={build.build_id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge variant="bronze">{versionLabel(build.version)}</Badge>
              {build.runelite_version && (
                <span className="text-osrs-parchment-dark/80 text-sm">
                  RuneLite {build.runelite_version}
                </span>
              )}
              <span className="text-osrs-parchment-dark/55 text-xs">
                Built <When unix={build.built_at} mode="date" empty="on an unknown date" />
              </span>
            </div>
            {summary ? (
              <p className="text-osrs-parchment-dark/70 mt-1.5 text-sm">{summary}</p>
            ) : (
              <ul className="text-osrs-parchment-dark/80 mt-1.5 list-disc space-y-0.5 pl-5 text-sm">
                {build.changes.map((change, i) => (
                  <li key={`${change.commit}-${i}`}>{change.title}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
