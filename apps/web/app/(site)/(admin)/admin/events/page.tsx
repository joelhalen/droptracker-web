import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { AdminEventsBoard } from "@/components/admin/admin-events-board";
import { EventTemplatesManager } from "@/components/event-templates-manager";
import { buttonVariants } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Events" };

// Superadmin oversight (Task 21 / PRD D6): every event on the site — group
// events link into their group's manager (superadmin bypasses group checks);
// global events (group_id null) are managed right here under /admin/events.
export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  await requireSuperadmin("/admin/events");
  // Authed list: as a superadmin this includes every draft (group + global).
  const [events, templates] = await Promise.all([
    api.eventsForAdmin({}),
    // Superadmin sees every template (site-wide + all groups') for oversight.
    api.eventTemplates({}).catch(() => []),
  ]);
  // One clock for the whole render, so the server's buckets and the client's
  // agree on hydration.
  const nowSec = Math.floor(Date.now() / 1000);

  return (
    <div className="min-w-0 space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h2 className="text-osrs-gold text-xl font-semibold">Events</h2>
          <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
            Every event on the site. Global events are run from here. Group events open in their
            group&apos;s own manager.
          </p>
          <p className="text-osrs-parchment-dark/50 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link href={"/admin/event-types" as Route} className="hover:text-osrs-gold-bright">
              Event types →
            </Link>
            <Link href={"/admin/event-limits" as Route} className="hover:text-osrs-gold-bright">
              Tier limits →
            </Link>
            {templates.length > 0 && (
              <a href="#templates" className="hover:text-osrs-gold-bright">
                Saved templates ({templates.length}) →
              </a>
            )}
          </p>
        </div>
        <Link
          href={"/admin/events/new" as Route}
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          Create global event
        </Link>
      </header>

      <AdminEventsBoard events={events} nowSec={nowSec} />

      {templates.length > 0 && (
        <details id="templates" className="border-osrs-bronze/25 rounded-lg border">
          <summary className="text-osrs-gold cursor-pointer px-4 py-3 font-semibold">
            Saved templates{" "}
            <span className="text-osrs-parchment-dark/50 text-sm font-normal">
              ({templates.length})
            </span>
          </summary>
          <div className="border-osrs-bronze/20 border-t p-4">
            <EventTemplatesManager groupId={null} initial={templates} showHeading={false} />
          </div>
        </details>
      )}
    </div>
  );
}
