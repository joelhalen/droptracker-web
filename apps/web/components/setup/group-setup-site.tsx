"use client";

/**
 * Site adapter for the shared GroupSetupWizard: server-action transport,
 * router navigation, and ?group&step URL persistence (survives RSC remounts,
 * the events-wizard trick). The Activity twin lives in
 * components/activity/group-setup-view.tsx — behavior changes belong in the
 * shared wizard, not here.
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  checkGuild,
  createGroup,
  enableWizardFeature,
  fetchBotInvite,
  fetchManageableGuilds,
  fetchWizardChannels,
  fetchWizardFeatures,
  lookupWom,
  postWizardMemberGuide,
  saveWizardConfig,
} from "@/app/(site)/(admin)/groups/new/actions";
import { unwrapActionResult } from "@/lib/errors";
import { GroupSetupWizard } from "./group-setup-wizard";
import type { GroupSetupClient, SetupEnv } from "./ports";

export function SiteGroupSetup({
  initialGroupId = null,
  initialStep = 0,
}: {
  initialGroupId?: number | null;
  initialStep?: number;
}) {
  const router = useRouter();

  // Actions return { ok, message } instead of throwing (production redacts
  // thrown Server Action errors); unwrap rethrows here, where it survives.
  const client = useMemo<GroupSetupClient>(() => {
    const data = async <T,>(p: Promise<{ ok: true; data: T } | { ok: false; message: string }>) =>
      unwrapActionResult(await p).data;
    return {
      manageableGuilds: () => data(fetchManageableGuilds()),
      guildStatus: (guildId, opts) => data(checkGuild(guildId, opts)),
      botInvite: () => data(fetchBotInvite()),
      lookupWom: (womId) => data(lookupWom(womId)),
      createGroup: (input) => data(createGroup(input)),
      listChannels: (groupId) => data(fetchWizardChannels(groupId)),
      saveConfig: async (groupId, patch) => {
        await data(saveWizardConfig(groupId, patch));
      },
      listFeatures: (groupId) => data(fetchWizardFeatures(groupId)),
      enableFeature: (groupId, key, channelId) => data(enableWizardFeature(groupId, key, channelId)),
      postMemberGuide: async (groupId, channelId) => {
        await data(postWizardMemberGuide(groupId, channelId));
      },
    };
  }, []);

  const env = useMemo<SetupEnv>(
    () => ({
      surface: "site",
      openLink: (url) => window.open(url, "_blank", "noopener"),
      goToGroup: (groupId, opts) =>
        router.push(opts?.admin ? `/groups/${groupId}/admin` : `/groups/${groupId}`),
      // The server list comes from the Discord sign-in, so signing in again is
      // what refreshes it (servers created or joined since then are missing).
      refreshGuilds: () => {
        window.location.href = `/api/auth/login?redirect=${encodeURIComponent("/groups/new")}`;
      },
      persistStep: ({ groupId, step }) => {
        const params = new URLSearchParams();
        if (groupId != null) params.set("group", String(groupId));
        params.set("step", String(step));
        window.history.replaceState(null, "", `/groups/new?${params.toString()}`);
      },
    }),
    [router],
  );

  return (
    <GroupSetupWizard
      client={client}
      env={env}
      initialGroupId={initialGroupId}
      initialStep={initialStep}
    />
  );
}
