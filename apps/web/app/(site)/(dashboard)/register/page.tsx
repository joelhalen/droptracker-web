import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { SiteClaimRsn } from "@/components/setup/claim-rsn-site";
import { PlayerNextSteps } from "@/components/player-next-steps";

// The Discord bot's /claim-rsn success embed has linked droptracker.io/register
// for years — this page makes that link real: sign in, claim your RSN, and
// (for clan leaders) jump into group creation.
export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  const user = await requireUser("/register");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-osrs-gold text-2xl font-bold">Welcome to The DropTracker</h1>
        <p className="text-osrs-parchment-dark/70 text-sm">
          Link your RuneScape account to your Discord identity to appear on leaderboards, join
          groups, and get notifications for your drops.
        </p>
      </div>

      <PlayerNextSteps players={user.players} groups={user.groups} />

      <Card id="claim">
        <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Claim your RuneScape name</h2>
        <SiteClaimRsn />
      </Card>

      <Card>
        <h2 className="text-osrs-gold mb-2 text-lg font-semibold">Setting up a clan?</h2>
        <p className="text-osrs-parchment-dark/70 mb-3 text-sm">
          Create a group for your Discord server. We&apos;ll walk you through linking Wise Old Man,
          inviting the bot, picking channels and switching on clan points, events and more. It&apos;s
          free.
        </p>
        <Link
          href="/groups/new"
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark inline-block rounded px-4 py-2 text-sm font-medium"
        >
          Create a group
        </Link>
      </Card>
    </div>
  );
}
