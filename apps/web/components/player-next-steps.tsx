import type { Route } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";

/** Global group id: every player is in it, so it doesn't count as a clan. */
const GLOBAL_GROUP_ID = 2;

type Step = { title: string; hint: string; done: boolean; href: string; cta: string; external?: boolean };

/**
 * First-run checklist on the dashboard: what a new player should do, in
 * order. Hidden once they have a linked account and a clan.
 */
export function PlayerNextSteps({
  players,
  groups,
}: {
  players: { id: number }[];
  groups: { id: number }[];
}) {
  const hasAccount = players.length > 0;
  const hasClan = groups.some((g) => g.id !== GLOBAL_GROUP_ID);
  if (hasAccount && hasClan) return null;

  const steps: Step[] = [
    {
      title: "Install the RuneLite plugin",
      hint: "Search DropTracker in the Plugin Hub. Tracking starts as soon as it's on.",
      done: hasAccount,
      href: "/runelite",
      cta: "Get the plugin",
      external: true,
    },
    {
      title: "Optional: turn on Use API",
      hint: "In the plugin's settings, under Advanced. Adds live boards, lookups and in-game event updates.",
      done: false,
      href: "/docs/runelite-plugin#api-connections-recommended",
      cta: "How",
    },
    {
      title: "Claim your RuneScape name",
      hint: "Links your drops to you, so they ping you and show on your profile.",
      done: hasAccount,
      href: "#claim",
      cta: "Claim below",
    },
    {
      title: "Make your profile yours",
      hint: "Pick the blocks, colours and banner on your public profile.",
      done: false,
      href: hasAccount ? `/profile-builder/${players[0]!.id}` : "/docs/link-account",
      cta: hasAccount ? "Customize" : "Learn more",
    },
    {
      title: "Choose your pings and privacy",
      hint: "Decide when the bot pings you and where your drops are shown.",
      done: false,
      href: "/settings",
      cta: "Settings",
    },
    {
      title: hasClan ? "You're in a clan" : "Join or start a clan",
      hint: "Clan members share a lootboard, points, events and Discord posts. Clans add you from their Wise Old Man group.",
      done: hasClan,
      href: "/groups/new",
      cta: "Start a clan",
    },
  ];

  return (
    <Card>
      <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Next steps</h2>
      <ol className="divide-osrs-bronze/20 divide-y">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-wrap items-start gap-3 py-2.5">
            <span
              aria-hidden
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                s.done ? "bg-osrs-green/20 text-osrs-green" : "bg-osrs-bronze/30 text-osrs-parchment"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-medium ${s.done ? "text-osrs-parchment-dark/60 line-through" : ""}`}>
                {s.title}
              </div>
              {!s.done && <div className="text-osrs-parchment-dark/70 text-xs">{s.hint}</div>}
            </div>
            {!s.done &&
              (s.external ? (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 shrink-0 rounded border px-2.5 py-1 text-xs font-medium"
                >
                  {s.cta} ↗
                </a>
              ) : (
                <Link
                  href={s.href as Route}
                  className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 shrink-0 rounded border px-2.5 py-1 text-xs font-medium"
                >
                  {s.cta}
                </Link>
              ))}
          </li>
        ))}
      </ol>
    </Card>
  );
}
