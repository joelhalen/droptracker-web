import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SubmitForm } from "@/components/submit-form";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Submit a drop" };

export default async function SubmitPage() {
  const user = await requireUser("/submit");

  return (
    <div>
      <h1 className="text-osrs-gold mb-6 text-2xl font-bold">Submit a drop</h1>
      {user.players.length ? (
        <SubmitForm players={user.players} />
      ) : (
        <EmptyState
          title="Link an account first"
          hint="You need at least one linked OSRS account before you can submit a drop."
          action={
            <Link href="/dashboard" className="text-osrs-gold-bright text-sm hover:underline">
              Go to my accounts →
            </Link>
          }
        />
      )}
    </div>
  );
}
