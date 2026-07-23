"use client";

/**
 * Activity adapter for the shared GroupSetupWizard: bearer transport via the
 * /api/activity/group-setup/* BFF routes, launch guild auto-filled from the
 * SDK context (collapses the Server step to a confirmation), view-stack
 * navigation, and outbound links through the Discord SDK's openExternal.
 *
 * The site twin is components/setup/group-setup-site.tsx — behavior changes
 * belong in the shared wizard, not here.
 */
import { useMemo } from "react";
import {
  manageableGuilds,
  setupBotInvite,
  setupChannels,
  setupCreateGroup,
  setupGuildStatus,
  setupSaveConfig,
  setupWomLookup,
} from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityData } from "@/lib/activity/data-context";
import { openExternal } from "@/lib/activity/discord-sdk";
import { useActivityNav } from "@/lib/activity/nav";
import { GroupSetupWizard } from "@/components/setup/group-setup-wizard";
import type { GroupSetupClient, SetupEnv } from "@/components/setup/ports";
import { ErrorNote } from "./bits";

export function GroupSetupView({ guildName }: { guildName?: string | null }) {
  const { sessionToken } = useActivityAuth();
  const { guildId } = useActivityData();
  const nav = useActivityNav();

  const client = useMemo<GroupSetupClient | null>(
    () =>
      sessionToken
        ? {
            manageableGuilds: () => manageableGuilds(sessionToken),
            guildStatus: (gid, opts) => setupGuildStatus(gid, sessionToken, opts),
            botInvite: () => setupBotInvite(),
            lookupWom: (womId) => setupWomLookup(womId, sessionToken),
            createGroup: (input) => setupCreateGroup(input, sessionToken),
            listChannels: (groupId) => setupChannels(groupId, sessionToken),
            saveConfig: (groupId, patch) => setupSaveConfig(groupId, patch, sessionToken),
          }
        : null,
    [sessionToken],
  );

  const env = useMemo<SetupEnv>(
    () => ({
      surface: "activity",
      openLink: (url) => void openExternal(url),
      goToGroup: (groupId, opts) => {
        if (opts?.admin) {
          void openExternal(`https://www.droptracker.io/groups/${groupId}/admin`);
        } else {
          nav.push({ name: "group", id: groupId });
        }
      },
    }),
    [nav],
  );

  if (!client) {
    return <ErrorNote>Sign in with Discord to set up a group.</ErrorNote>;
  }
  if (!guildId) {
    return <ErrorNote>Launch the activity inside a Discord server to set it up.</ErrorNote>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-osrs-gold text-xl font-bold">Set up DropTracker</h2>
        <p className="text-osrs-parchment-dark/70 text-sm">
          Bring loot tracking, leaderboards, and events to this server.
        </p>
      </div>
      <GroupSetupWizard
        client={client}
        env={env}
        launchGuild={{ id: guildId, name: guildName ?? null }}
      />
    </div>
  );
}
