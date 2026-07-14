import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SuggestionForm } from "@/components/suggestion-form";

export const metadata: Metadata = { title: "New suggestion or bug report" };

export default async function NewSuggestionPage() {
  await requireUser("/suggestions/new");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/suggestions" className="text-osrs-parchment-dark/60 text-sm hover:underline">
          ← All suggestions
        </Link>
        <h1 className="text-osrs-gold mt-2 text-2xl font-bold">New suggestion or bug report</h1>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Your post opens a thread here and in our Discord forum at the same time — replies from
          either side stay in sync.
        </p>
      </div>
      <SuggestionForm />
    </div>
  );
}
