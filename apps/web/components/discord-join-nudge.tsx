/**
 * "Join our Discord" prompt for support tickets. Shown only when the API says
 * the viewer is definitely NOT in the main server (`discord_member === false`);
 * `null`/missing means unknown (no linked Discord, or the bot's member cache is
 * stale) and renders nothing, so members are never nagged on a guess.
 *
 * When the opener joins, the webhook bot adds them to their open ticket
 * channels by itself (services/ticket_system.py, late joiners).
 */
export const DISCORD_INVITE_URL = "https://discord.gg/droptracker";

export function DiscordJoinNudge({
  discordMember,
  context,
  className = "",
}: {
  discordMember: boolean | null | undefined;
  /** "create": before a ticket exists. "ticket": viewing one. */
  context: "create" | "ticket";
  className?: string;
}) {
  if (discordMember !== false) return null;
  return (
    <div
      role="note"
      className={`border-osrs-gold/30 bg-osrs-gold/5 text-osrs-parchment-dark/90 rounded border px-3 py-2 text-xs ${className}`}
    >
      <p>
        <span className="text-osrs-parchment font-semibold">Join our Discord</span> to follow{" "}
        {context === "create" ? "your ticket" : "this ticket"} there too and get replies faster.
        You&apos;ll be added to {context === "create" ? "it" : "the ticket"} automatically once you
        join.
      </p>
      <a
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-osrs-gold-bright mt-1 inline-block font-semibold hover:underline"
      >
        discord.gg/droptracker ↗
      </a>
    </div>
  );
}
