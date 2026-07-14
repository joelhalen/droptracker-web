import type { Metadata } from "next";
import { api } from "@/lib/api";
import { PbBlockManager } from "@/components/admin/pb-block-manager";

export const metadata: Metadata = { title: "PB blocks" };

// Same surface as /admin/personal-bests; the moderation layout gates access
// and the API re-checks the moderator role on every call.
export default async function ModerationPersonalBestsPage() {
  const data = await api.adminPbBlocks();

  return (
    <div className="max-w-3xl">
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        NPCs that have no real personal best. The plugin still reports &ldquo;kill times&rdquo;
        for them, so our tracking stores junk rows. Blocking an NPC drops every future PB
        submission for it and <strong>permanently deletes</strong> its existing rows across all
        players and groups. Removing a block stops the drop going forward but does{" "}
        <strong>not</strong> restore deleted rows.
      </p>
      <PbBlockManager initial={data} />
    </div>
  );
}
