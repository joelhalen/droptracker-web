/**
 * The superadmin information architecture, defined once. The admin layout's
 * sidebar and the overview page's quick-link sections both render from this
 * structure, so navigation and the overview can't drift apart as pages are
 * added — new admin pages get registered here and appear in both places.
 */
export type AdminNavItem = {
  href: string;
  label: string;
  /** One-line description shown on the overview quick links. */
  desc: string;
  /** Keep the item highlighted on nested child routes (e.g. /admin/events/42). */
  matchPrefix?: boolean;
};

export type AdminNavSection = { label: string; items: AdminNavItem[] };

export const ADMIN_SECTIONS: AdminNavSection[] = [
  {
    label: "Community",
    items: [
      { href: "/admin/users", label: "Users", desc: "Look up a user; manage superadmin access." },
      { href: "/admin/groups", label: "Groups", desc: "Introspect groups; grant or revoke comped subscriptions." },
      { href: "/admin/tickets", label: "Tickets", desc: "Support tickets and archived transcripts.", matchPrefix: true },
      { href: "/admin/lookup", label: "Lookup", desc: "Cross-content search across players, groups, and drops." },
      { href: "/admin/audit", label: "Audit log", desc: "Every admin action taken on the site." },
    ],
  },
  {
    label: "Events",
    items: [
      { href: "/admin/events", label: "Events", desc: "Oversee every event; create and run global events.", matchPrefix: true },
      { href: "/admin/event-types", label: "Event types", desc: "Enable or disable event formats site-wide; manage test groups." },
      { href: "/admin/event-limits", label: "Event limits", desc: "Cap how many events each subscription tier can run per rolling window." },
      { href: "/admin/boardgame-shop", label: "Board-game shop", desc: "Curate the power-up catalog for board-game events." },
      { href: "/admin/task-library", label: "Task library", desc: "Curate the shared pool of event tasks." },
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
      { href: "/admin/data", label: "Data viewer", desc: "Browse and edit whitelisted records safely." },
      { href: "/admin/personal-bests", label: "Personal bests", desc: "Block bogus PB bosses and purge bad rows." },
      { href: "/admin/item-values", label: "Item values", desc: "Override GE prices for specific items." },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/admin/subscriptions", label: "Revenue", desc: "MRR, income history, and every subscription." },
      { href: "/admin/tiers", label: "Tiers", desc: "Create and edit premium subscription tiers." },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/services", label: "Services", desc: "Start, stop, or restart backend services; view logs." },
      { href: "/admin/backups", label: "Backups", desc: "Nightly database backup status and offsite copies." },
      { href: "/admin/b2", label: "B2 usage", desc: "Bucket storage usage and estimated monthly cost." },
      { href: "/admin/logs", label: "Logs", desc: "Tail application logs by source." },
      { href: "/admin/discord", label: "Discord sender", desc: "Send a message to any channel via the bot." },
    ],
  },
];

/** Flat list of every admin page (excluding the overview itself). */
export const ADMIN_PAGES: AdminNavItem[] = ADMIN_SECTIONS.flatMap((s) => s.items);
