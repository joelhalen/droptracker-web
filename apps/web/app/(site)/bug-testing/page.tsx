import type { Metadata, Route } from "next";
import Link from "next/link";
import { api, ApiError, apiErrorCode } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { CollapsibleSection } from "@/components/collapsible-section";
import { DiscordIcon } from "@/components/icons";
import { Badge, EmptyState, buttonVariants } from "@/components/ui";
import { ChangeList, GroupedChangeList } from "@/components/tester-builds/change-list";
import { CurrentBuildCard } from "@/components/tester-builds/current-build-card";
import { EarlierBuilds } from "@/components/tester-builds/earlier-builds";
import { HowToRun } from "@/components/tester-builds/how-to-run";
import { MyDownloads } from "@/components/tester-builds/my-downloads";
import { buildSummaryLine, downloadStatusLine, pagePath, versionLabel } from "@/lib/tester-builds";

/**
 * Plugin test builds for Bug Testers: the newest plugin commit, packaged with
 * a RuneLite client, before it reaches the Plugin Hub.
 *
 * It sits directly under (site) rather than in the (dashboard) group for the
 * same reason /file-transfer does: that layout's `requireUser("/dashboard")`
 * runs before a nested page's guard, so a signed-out tester following the link
 * from Discord would come back from sign-in on the dashboard instead of here.
 *
 * Signing in is not enough to see a build. The Web API admits Bug Testers and
 * staff only, and answers everyone else with a 403 that this page turns into
 * a notice. The download itself (/dl/bugtest.zip) asks the API again.
 *
 * `noindex` because there is nothing here for a search engine, and the page
 * is deliberately left out of the sitemap.
 */
export const metadata: Metadata = {
  title: "Test builds",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const SECTION_HEADING = "heading-rule text-osrs-gold pb-1 text-lg font-semibold";

export default async function BugTestingPage() {
  await requireUser(pagePath);

  let data;
  try {
    data = await api.testerBuilds();
  } catch (err) {
    if (err instanceof ApiError && err.status === 403 && apiErrorCode(err) === "bug_tester_required") {
      return (
        <AccessDenied
          icon="🧪"
          title="Bug Testers only"
          message="This download is for DropTracker Bug Testers. If you would like to help test new plugin builds, ask in the DropTracker Discord."
          back={{ href: "/", label: "Back to the homepage" }}
        >
          <div className="mt-5">
            <a
              href="/discord"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", className: "rounded-lg" })}
            >
              <DiscordIcon className="size-4 shrink-0" />
              Open the DropTracker Discord
            </a>
          </div>
        </AccessDenied>
      );
    }
    throw err;
  }

  const { current, recent } = data;
  const hubVersion = current?.release?.version ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-osrs-gold text-xl font-bold">Test builds</h1>
          <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
            The newest DropTracker plugin build, before it reaches the Plugin Hub.
          </p>
        </div>
        {data.is_staff && (
          <Link
            href={"/admin/testers" as Route}
            className="text-osrs-gold-bright text-sm hover:underline"
          >
            Tester activity
          </Link>
        )}
      </div>

      {current ? (
        <>
          <CurrentBuildCard build={current} statusLine={downloadStatusLine(data)} />

          <section>
            <h2 className={SECTION_HEADING}>What&apos;s new in this build</h2>
            <div className="mt-3">
              {current.changes.length > 0 ? (
                <ChangeList changes={current.changes} repoUrl={current.repo_url} />
              ) : (
                <p className="text-osrs-parchment-dark/80 text-sm">{buildSummaryLine(current)}</p>
              )}
            </div>
          </section>

          <CollapsibleSection
            title="Everything since the Plugin Hub release"
            hint={
              hubVersion
                ? `The Plugin Hub is on ${versionLabel(hubVersion)}. This is everything being tested before the next release.`
                : "This is everything being tested before the next release."
            }
            defaultOpen
            badge={
              current.since_release.length > 0 ? (
                <Badge variant="bronze">
                  {current.since_release.length}{" "}
                  {current.since_release.length === 1 ? "change" : "changes"}
                </Badge>
              ) : undefined
            }
          >
            {current.since_release.length > 0 ? (
              <GroupedChangeList changes={current.since_release} repoUrl={current.repo_url} />
            ) : (
              <p className="text-osrs-parchment-dark/80 text-sm">
                No changes since the Plugin Hub release.
              </p>
            )}
          </CollapsibleSection>
        </>
      ) : (
        <EmptyState
          title="No test build is available right now"
          hint="Check back soon."
        />
      )}

      {recent.length > 0 && (
        <CollapsibleSection
          title="Earlier builds"
          badge={<Badge variant="neutral">{recent.length}</Badge>}
        >
          <EarlierBuilds builds={recent} />
        </CollapsibleSection>
      )}

      <section>
        <h2 className={SECTION_HEADING}>How to run it</h2>
        <div className="mt-3">
          <HowToRun />
        </div>
      </section>

      {data.my_downloads.length > 0 && (
        <section>
          <h2 className={SECTION_HEADING}>Your downloads</h2>
          <div className="mt-1">
            <MyDownloads downloads={data.my_downloads} />
          </div>
        </section>
      )}
    </div>
  );
}
