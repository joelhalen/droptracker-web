import { requireModerator } from "@/lib/auth";
import { TabNav, type NavTab } from "@/components/tab-nav";

const TABS: NavTab[] = [
  { href: "/moderation", label: "Overview" },
  { href: "/moderation/personal-bests", label: "PB blocks" },
  { href: "/moderation/item-values", label: "Item values" },
  { href: "/moderation/task-library", label: "Task library" },
];

/**
 * Moderator control panel. Gated to moderators (superadmins pass too); the
 * pages reuse the superadmin manager components, the backend re-checks the
 * role on every call, and every mutation lands in the audit log with the
 * moderator as the actor.
 */
export default async function ModerationLayout({ children }: { children: React.ReactNode }) {
  await requireModerator("/moderation");

  return (
    <div className="space-y-6">
      <header>
        <span className="bg-sky-500/20 text-sky-300 rounded px-2 py-0.5 text-xs font-medium">
          Moderation
        </span>
        <h1 className="text-osrs-gold mt-2 text-2xl font-bold">Moderator panel</h1>
        <p className="text-osrs-parchment-dark/60 mt-1 text-sm">
          Every change made here is recorded in the site audit log.
        </p>
      </header>

      <TabNav tabs={TABS} />

      <div>{children}</div>
    </div>
  );
}
