"use client";

/**
 * Site adapter for the shared ClaimRsnFlow (dashboard card + /register page):
 * server-action transport, router.refresh() after a claim so the surrounding
 * server components re-render with the newly linked account. The Activity
 * twin lives in components/activity/claim-rsn.tsx — behavior changes belong
 * in the shared flow, not here.
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { claimPreview, claimRsn } from "@/app/(site)/(dashboard)/register/actions";
import { ClaimRsnFlow } from "./claim-rsn-flow";
import type { ClaimRsnClient, SetupEnv } from "./ports";

export function SiteClaimRsn({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  const client = useMemo<ClaimRsnClient>(
    () => ({
      preview: (rsn) => claimPreview(rsn),
      claim: (input) => claimRsn(input),
    }),
    [],
  );

  const env = useMemo<SetupEnv>(
    () => ({
      surface: "site",
      openLink: (url) => window.open(url, "_blank", "noopener"),
      goToGroup: (groupId) => router.push(`/groups/${groupId}`),
    }),
    [router],
  );

  return (
    <ClaimRsnFlow client={client} env={env} compact={compact} onClaimed={() => router.refresh()} />
  );
}
