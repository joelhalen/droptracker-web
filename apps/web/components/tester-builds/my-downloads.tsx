import type { TesterBuildDownloadRow } from "@droptracker/api-types";
import { RelativeTime } from "@/components/local-time";
import { versionLabel } from "@/lib/tester-builds";
import { When } from "./build-bits";

/** The signed-in tester's own recent downloads, newest first. */
export function MyDownloads({ downloads }: { downloads: TesterBuildDownloadRow[] }) {
  return (
    <ul className="divide-osrs-bronze/20 divide-y text-sm">
      {downloads.map((row, i) => (
        <li
          key={`${row.build_id}-${row.downloaded_at}-${i}`}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2"
        >
          {/* An old manifest may not carry a version; the build id still
              tells the tester which one it was. */}
          <span className="text-osrs-parchment font-medium">
            {versionLabel(row.version, row.build_id)}
          </span>
          <span className="text-osrs-parchment-dark/70">
            <When unix={row.downloaded_at} /> <RelativeTime unix={row.downloaded_at} prefix="·" />
          </span>
        </li>
      ))}
    </ul>
  );
}
