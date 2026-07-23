/**
 * Transport + environment seams for the shared onboarding components
 * (GroupSetupWizard, ClaimRsnFlow).
 *
 * These components are the SINGLE implementation rendered by BOTH surfaces:
 *   - the main site (server-action transport, cookie auth, router/history nav)
 *   - the Discord Activity (bearer fetch to /api/activity/*, view-stack nav,
 *     openExternal for outbound links — the iframe has no cookies and no URL)
 *
 * Hard rules for anything under components/setup/:
 *   - NO next/link, NO useRouter, NO history writes — navigation via `env`.
 *   - NO value imports from "@/lib/api" (server-only) — types only.
 *   - NO server-action imports — those live in the surface adapters.
 * The adapters (group-setup-site.tsx / activity group-setup-view.tsx, etc.)
 * are the only place transport details may appear.
 */
import type {
  BotInvite,
  ClaimPreview,
  ClaimResult,
  CreateGroupInput,
  CreateGroupResult,
  GuildStatus,
  ManageableGuild,
  MyGuilds,
  WomGroupPreview,
} from "@droptracker/api-types";
// Type-only import from the server-only module — erased at build time (the
// discord-channel-picker does exactly this).
import type { DiscordChannel } from "@/lib/api";

export type {
  BotInvite,
  ClaimPreview,
  ClaimResult,
  CreateGroupInput,
  CreateGroupResult,
  GuildStatus,
  ManageableGuild,
  MyGuilds,
  WomGroupPreview,
  DiscordChannel,
};

/** How the host surface navigates and opens links. */
export type SetupEnv = {
  surface: "site" | "activity";
  /** Site: window.open(url, "_blank", "noopener"). Activity: openExternal
   * (Discord shows its leave prompt). */
  openLink: (url: string) => void;
  /** Where to land when the flow finishes (or when the server already owns a
   * group). Site: router.push to the group page (`admin` → the admin hub).
   * Activity: push the in-app group view; admin surfaces open externally. */
  goToGroup: (groupId: number, opts?: { admin?: boolean }) => void;
  /** Optional step persistence across remounts. Site stamps ?group&step via
   * history.replaceState (the events-wizard trick). Activity: undefined — the
   * iframe URL belongs to Discord's proxy. */
  persistStep?: (pos: { groupId: number | null; step: number }) => void;
};

/** Transport for the group-setup wizard. */
export interface GroupSetupClient {
  manageableGuilds(): Promise<MyGuilds>;
  guildStatus(guildId: string, opts?: { refresh?: boolean }): Promise<GuildStatus>;
  botInvite(): Promise<BotInvite>;
  lookupWom(womId: number): Promise<WomGroupPreview>;
  createGroup(input: CreateGroupInput): Promise<CreateGroupResult>;
  listChannels(groupId: number): Promise<{ channels: DiscordChannel[]; cached: boolean }>;
  saveConfig(groupId: number, patch: Record<string, string | null>): Promise<void>;
}

/** Transport for the RSN claim flow. */
export interface ClaimRsnClient {
  preview(rsn: string, guildId?: string): Promise<ClaimPreview>;
  claim(input: { rsn: string; guild_id?: string }): Promise<ClaimResult>;
}
