import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { SiteClaimRsn } from "@/components/setup/claim-rsn-site";

// The Discord bot's /claim-rsn success embed has linked droptracker.io/register
// for years — this page makes that link real: sign in, claim your RSN, and
// (for clan leaders) jump into group creation.
export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  await requireUser("/register");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-osrs-gold text-2xl font-bold">Welcome to DropTracker</h1>
        <p className="text-osrs-parchment-dark/70 text-sm">
          Link your RuneScape account to your Discord identity to appear on leaderboards, join
          groups, and get notifications for your drops.
        </p>
      </div>

      <Card>
        <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Claim your RuneScape name</h2>
        <SiteClaimRsn />
      </Card>

      <Card>
        <h2 className="text-osrs-gold mb-2 text-lg font-semibold">Setting up a clan?</h2>
        <p className="text-osrs-parchment-dark/70 mb-3 text-sm">
          Create a DropTracker group for your Discord server — we&apos;ll walk you through linking
          Wise Old Man, inviting the bot, and picking your notification channels.
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
