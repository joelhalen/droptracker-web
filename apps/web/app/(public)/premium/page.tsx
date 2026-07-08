import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { Badge, EmptyState } from "@/components/ui";
import { InlineMarkdown } from "@/components/markdown";
import { SupporterManager } from "@/components/supporter-manager";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Premium",
  description: "Upgrade your clan with a DropTracker recurring subscription.",
};

export default async function PremiumPage() {
  const [tiers, supporterTiers] = await Promise.all([
    api.subscriptionTiers(),
    api.supporterTiers(),
  ]);

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-osrs-gold text-3xl font-bold">Premium for clans</h1>
        <p className="text-osrs-parchment-dark/80 mx-auto mt-2 max-w-xl">
          A recurring subscription that unlocks seasonal boards, deeper history, and priority
          processing for your whole group. Manage it from your group&apos;s admin page.
        </p>
      </header>

      {tiers.length === 0 && (
        <EmptyState
          title="Plans coming soon"
          hint="Premium subscription tiers aren't available just yet. Check back shortly."
        />
      )}

      <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.key}
            className={`bg-osrs-surface-1 shadow-osrs-card flex flex-col rounded-xl border p-5 ${
              t.recommended ? "border-osrs-gold/60" : "border-osrs-bronze/30"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-osrs-gold-bright text-lg font-semibold">{t.name}</span>
              {t.recommended && <Badge tone="gold">Popular</Badge>}
            </div>
            <div className="text-osrs-parchment mt-1 text-2xl font-bold">{formatPrice(t)}</div>
            {t.description && (
              <p className="text-osrs-parchment-dark/70 mt-1 text-sm">{t.description}</p>
            )}
            <ul className="mt-4 flex-1 space-y-1.5 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-osrs-green">✓</span>
                  <InlineMarkdown>{f}</InlineMarkdown>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-osrs-parchment-dark/70 text-center text-sm">
        Already run a clan?{" "}
        <Link href="/dashboard" className="text-osrs-gold-bright hover:underline">
          Manage your group&apos;s subscription →
        </Link>
      </p>

      <hr className="border-osrs-bronze/30 mx-auto max-w-4xl" />

      <SupporterManager tiers={supporterTiers} />
    </div>
  );
}
