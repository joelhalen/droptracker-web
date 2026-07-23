"use client";

/**
 * Activity adapter for the shared ClaimRsnFlow: bearer transport via the
 * /api/activity/claim BFF route, outbound links through the Discord SDK's
 * openExternal, and the launch guild passed so a claim also joins that
 * server's clan (exactly like /claim-rsn run in-server). Renders as an
 * expandable inline card — the shape the home hub + Me tab embed where the
 * old "use /claim-rsn in Discord" dead-end notes used to be.
 *
 * The site twin is components/setup/claim-rsn-site.tsx — behavior changes
 * belong in the shared flow, not here.
 */
import { useMemo, useState } from "react";
import { claimPreview, claimRsn } from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityData } from "@/lib/activity/data-context";
import { openExternal } from "@/lib/activity/discord-sdk";
import { ClaimRsnFlow } from "@/components/setup/claim-rsn-flow";
import type { ClaimResult, ClaimRsnClient, SetupEnv } from "@/components/setup/ports";

export function ActivityClaimRsn({ onClaimed }: { onClaimed?: (res: ClaimResult) => void }) {
  const { sessionToken } = useActivityAuth();
  const { guildId } = useActivityData();
  const [open, setOpen] = useState(false);

  const client = useMemo<ClaimRsnClient | null>(
    () =>
      sessionToken
        ? {
            preview: (rsn, gid) => claimPreview(rsn, sessionToken, gid),
            claim: (input) => claimRsn(input, sessionToken),
          }
        : null,
    [sessionToken],
  );

  const env = useMemo<SetupEnv>(
    () => ({
      surface: "activity",
      openLink: (url) => void openExternal(url),
      // The claim flow never navigates to a group; satisfy the port anyway.
      goToGroup: () => {},
    }),
    [],
  );

  if (!client) return null;

  return (
    <div className="border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">No OSRS accounts linked yet</p>
          <p className="text-osrs-parchment-dark/60 text-xs">
            Claim your RuneScape name to see your loot, ranks, and badges here.
          </p>
        </div>
        <button
          type="button"
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark shrink-0 rounded px-3 py-1.5 text-sm font-medium"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide" : "Claim your RSN"}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <ClaimRsnFlow
            client={client}
            env={env}
            guildId={guildId}
            compact
            onClaimed={onClaimed}
          />
        </div>
      )}
    </div>
  );
}
