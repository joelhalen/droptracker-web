import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { GroupWizard } from "@/components/group-wizard";

export const metadata: Metadata = { title: "Create a group" };

export default async function NewGroupPage() {
  await requireUser("/groups/new");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-osrs-gold text-2xl font-bold">Create a group</h1>
        <p className="text-osrs-parchment-dark/70 text-sm">
          Link your Wise Old Man group and Discord server to start tracking.
        </p>
      </div>
      <GroupWizard />
    </div>
  );
}
