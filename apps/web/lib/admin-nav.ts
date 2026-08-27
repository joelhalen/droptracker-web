/**
 * The staff information architecture, defined once. The admin layout's
 * sidebar and the overview page's quick-link sections both render from this
 * structure, so navigation and the overview can't drift apart as pages are
 * added — new admin pages get registered here and appear in both places.
 *
 * Two site roles share the /admin shell (web87a): superadmins see everything;
 * developers only see items tagged `minRole: "developer"`. The nav is
 * cosmetic — every page re-asserts its own role server-side and the backend
 * enforces independently.
 */
export type AdminRole = "developer" | "superadmin";

export type AdminNavItem = {
  href: string;
  label: string;
  /** One-line description shown on the overview quick links. */
  desc: string;
  /** Keep the item highlighted on nested child routes (e.g. /admin/events/42). */
  matchPrefix?: boolean;
  /** Lowest site role that may see this item. Defaults to superadmin, so a
   *  newly registered page never leaks to developers by omission. */
  minRole?: AdminRole;
};

export type AdminNavSection = { label: string; items: AdminNavItem[] };

export const ADMIN_SECTIONS: AdminNavSection[] = [
  {
    label: "Community",
    items: [
      { href: "/admin/users", label: "Users", desc: "Look up a user; manage superadmin access." },
      { href: "/admin/groups", label: "Groups", desc: "Introspect groups; grant or revoke comped subscriptions." },
      { href: "/admin/tickets", label: "Tickets", desc: "Support tickets and archived transcripts.", matchPrefix: true },
      { href: "/admin/file-transfers", minRole: "developer", label: "File transfers", desc: "Files users sent from /file-transfer; reply with an updated version." },
      { href: "/admin/lookup", minRole: "developer", label: "Lookup", desc: "Cross-content search across players, groups, and drops." },
      { href: "/admin/audit", minRole: "developer", label: "Audit log", desc: "Every admin action taken on the site." },
    ],
  },
  {
    label: "Events",
    items: [
      { href: "/admin/events", label: "Events", desc: "Oversee every event; create and run global events.", matchPrefix: true },
      { href: "/admin/event-types", label: "Event types", desc: "Enable or disable event formats site-wide; manage test groups." },
      { href: "/admin/event-limits", label: "Event limits", desc: "Cap how many events each subscription tier can run per rolling window." },
      { href: "/admin/boardgame-shop", label: "Board-game shop", desc: "Curate the power-up catalog for board-game events." },
      { href: "/admin/task-library", minRole: "developer", label: "Task library", desc: "Curate the shared pool of event tasks." },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/announcements", label: "Global news", desc: "Publish site-wide announcements." },
      { href: "/admin/docs", label: "Docs", desc: "Add, edit, and delete documentation pages." },
      { href: "/admin/redirects", label: "Redirects", desc: "Manage vanity short links (e.g. /discord)." },
      { href: "/admin/badges", label: "Badges", desc: "Define badges and award them manually." },
    ],
  },
  {
    label: "Game data",
    items: [
      { href: "/admin/data", minRole: "developer", label: "Data viewer", desc: "Browse and edit whitelisted records safely." },
      { href: "/admin/personal-bests", minRole: "developer", label: "Personal bests", desc: "Block bogus PB bosses and purge bad rows." },
      { href: "/admin/item-values", minRole: "developer", label: "Item values", desc: "Override GE prices for specific items." },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/admin/subscriptions", label: "Revenue", desc: "MRR, income history, and every subscription." },
      { href: "/admin/tiers", label: "Tiers", desc: "Create and edit premium subscription tiers." },
      { href: "/admin/nitro-boosts", label: "Nitro boosts", desc: "Boost-slot attribution; assign slots Discord can't trace." },
    ],
  },
  {
    label: "Planning",
    items: [
      {
        href: "/admin/projects",
        minRole: "developer",
        label: "Project tracker",
        desc: "Internal feature/task board for the owner and codebase agents.",
        matchPrefix: true,
      },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/services", minRole: "developer", label: "Services", desc: "Live service health; superadmins can start, stop, or restart." },
      { href: "/admin/status", minRole: "developer", label: "Status & issues", desc: "Live pipeline health and the known-issues board shown in Discord." },
      { href: "/admin/backups", label: "Backups", desc: "Nightly database backup status and offsite copies." },
      { href: "/admin/b2", label: "B2 usage", desc: "Bucket storage usage and estimated monthly cost." },
      { href: "/admin/api-keys", minRole: "developer", label: "Data API keys", desc: "Keys for the external /v2 API — usage, tier promotion, per-key limits." },
      { href: "/admin/logs", minRole: "developer", label: "Logs", desc: "Tail application logs by source." },
      { href: "/admin/discord", label: "Discord sender", desc: "Send a message to any channel via the bot." },
    ],
  },
];

/** Flat list of every admin page (excluding the overview itself). */
export const ADMIN_PAGES: AdminNavItem[] = ADMIN_SECTIONS.flatMap((s) => s.items);

/** The sections a given role may see, with empty sections dropped. */
export function sectionsForRole(role: AdminRole): AdminNavSection[] {
  if (role === "superadmin") return ADMIN_SECTIONS;
  return ADMIN_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.minRole === "developer"),
  })).filter((s) => s.items.length > 0);
}
