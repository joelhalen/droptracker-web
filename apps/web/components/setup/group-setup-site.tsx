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
  fetchBotInvite,
  fetchManageableGuilds,
  fetchWizardChannels,
  lookupWom,
  saveWizardConfig,
} from "@/app/(site)/(admin)/groups/new/actions";
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

  const client = useMemo<GroupSetupClient>(
    () => ({
      manageableGuilds: () => fetchManageableGuilds(),
      guildStatus: (guildId, opts) => checkGuild(guildId, opts),
      botInvite: () => fetchBotInvite(),
      lookupWom: (womId) => lookupWom(womId),
      createGroup: async (input) => {
        const res = await createGroup(input);
        return { id: res.id };
      },
      listChannels: (groupId) => fetchWizardChannels(groupId),
      saveConfig: async (groupId, patch) => {
        await saveWizardConfig(groupId, patch);
      },
    }),
    [],
  );

  const env = useMemo<SetupEnv>(
    () => ({
      surface: "site",
      openLink: (url) => window.open(url, "_blank", "noopener"),
      goToGroup: (groupId, opts) =>
        router.push(opts?.admin ? `/groups/${groupId}/admin` : `/groups/${groupId}`),
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
