/**
 * The group setup checklist (web138a), from GET /groups/{id}/setup-status.
 * Shown on the group admin Overview while the group is onboarding or something
 * is failing (`showSetupChecklist`); each problem carries the button that
 * fixes it. `SetupBanner` is the one-line version admin pages show while
 * something is actually broken.
 */
import type { Route } from "next";
import Link from "next/link";
import type { SetupCheck, SetupStatus } from "@droptracker/api-types";
import { Card } from "@/components/ui";

const PLUGIN_URL = "https://www.droptracker.io/runelite";

const ICON: Record<SetupCheck["status"], { glyph: string; cls: string }> = {
  ok: { glyph: "✓", cls: "bg-osrs-green/20 text-osrs-green" },
  warn: { glyph: "!", cls: "bg-osrs-gold/20 text-osrs-gold-bright" },
  fail: { glyph: "✕", cls: "bg-osrs-red/20 text-osrs-red" },
  unknown: { glyph: "?", cls: "bg-osrs-surface-3 text-osrs-parchment-dark/70" },
};

function fixLink(fix: string, groupId: number, inviteUrl: string | null): { label: string; href: string; external?: boolean } | null {
  const settings = `/groups/${groupId}/settings`;
  switch (fix) {
    case "invite_bot":
      return inviteUrl ? { label: "Add the bot", href: inviteUrl, external: true } : null;
    case "pick_channel":
      return { label: "Pick a channel", href: `${settings}#cfg-channels` };
    case "link_wom":
      return { label: "Link Wise Old Man", href: `${settings}#cfg-integration` };
    case "sync_members":
      return { label: "Members", href: `/groups/${groupId}/members` };
    case "share_plugin":
      return { label: "Plugin link to share", href: PLUGIN_URL, external: true };
    case "minimum_value":
      return { label: "Adjust minimum", href: `${settings}#cfg-drops` };
    case "link_server":
      return { label: "Settings", href: settings };
    default:
      return null;
  }
}

/** The invite link with the group's server preselected. */
export function serverInviteUrl(base: string | null | undefined, guildId: string | null): string | null {
  if (!base) return null;
  return guildId ? `${base}&guild_id=${guildId}&disable_guild_select=true` : base;
}

/** Onboarding, or something broken. A settled group that's working (or only
 * has optional warnings) doesn't need the panel taking up its Overview. */
export function showSetupChecklist(status: SetupStatus): boolean {
  return status.onboarding || status.summary.failing > 0;
}

export function GroupSetupChecklist({
  status,
  inviteUrl,
}: {
  status: SetupStatus;
  inviteUrl: string | null;
}) {
  const { summary } = status;
  const allGood = summary.failing === 0 && status.checks.every((c) => c.status === "ok" || c.status === "unknown");
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-osrs-gold text-lg font-semibold">Setup checklist</h2>
        <span className="text-osrs-parchment-dark/70 text-sm">
          {allGood ? "Everything's working" : `${summary.ok} of ${summary.total} done`}
        </span>
      </div>
      <ul className="divide-osrs-bronze/20 divide-y">
        {status.checks.map((c) => {
          const icon = ICON[c.status];
          const link = c.status !== "ok" && c.fix ? fixLink(c.fix, status.group_id, inviteUrl) : null;
          return (
            <li key={c.key} className="flex flex-wrap items-start gap-3 py-2.5">
              <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${icon.cls}`} aria-hidden>
                {icon.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{c.title}</div>
                {c.detail && c.status !== "ok" && <div className="text-osrs-parchment-dark/70 text-xs">{c.detail}</div>}
              </div>
              {link &&
                (link.external ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 shrink-0 rounded border px-2.5 py-1 text-xs font-medium">
                    {link.label} ↗
                  </a>
                ) : (
                  <Link href={link.href as Route} className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 shrink-0 rounded border px-2.5 py-1 text-xs font-medium">
                    {link.label}
                  </Link>
                ))}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** One red line across admin pages while something is broken. */
export function SetupBanner({ status, groupId }: { status: SetupStatus | null; groupId: number }) {
  if (!status?.summary.failing || !status.summary.headline) return null;
  return (
    <div role="alert" className="border-osrs-red/50 bg-osrs-red/10 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm">
      <span>
        <strong className="text-osrs-red">{status.summary.headline}.</strong>{" "}
        {status.summary.failing > 1 ? `${status.summary.failing - 1} more problem${status.summary.failing > 2 ? "s" : ""} need attention.` : ""}
      </span>
      <Link href={`/groups/${groupId}/admin` as Route} className="text-osrs-gold-bright underline">
        See the checklist
      </Link>
    </div>
  );
}
