/**
 * Server-side Web API v1 client used by the BFF (Server Components and Route
 * Handlers). The browser never calls the Web API directly — only Next.js.
 *
 * This barrel re-assembles the single `api` facade out of the per-domain
 * modules in this directory, and re-exports the shared error helpers and the
 * hand-authored response types so `@/lib/api` keeps its original public shape.
 */
import { leaderboardsApi } from "./leaderboards";
import { playersApi } from "./players";
import { sitesApi } from "./sites";
import { groupsApi } from "./groups";
import { eventsApi } from "./events";
import { eventTasksApi } from "./event-tasks";
import { eventMembershipApi } from "./event-membership";
import { eventDiscordApi } from "./event-discord";
import { eventPotApi } from "./event-pot";
import { lootboardApi } from "./lootboard";
import { announcementsApi } from "./announcements";
import { docsApi } from "./docs";
import { redirectsApi } from "./redirects";
import { statusApi } from "./status";
import { devApi } from "./dev";
import { itemValuesApi } from "./item-values";
import { accountApi } from "./account";
import { searchApi } from "./search";
import { npcsApi } from "./npcs";
import { manualSubmissionsApi } from "./manual-submissions";
import { groupPointsApi } from "./group-points";
import { subscriptionsApi } from "./subscriptions";
import { layoutsApi } from "./layouts";
import { adminApi } from "./admin";
import { badgesApi } from "./badges";
import { adminDashboardApi } from "./admin-dashboard";
import { supportApi } from "./support";
import { chatApi } from "./chat";
import { fileTransfersApi } from "./file-transfers";

export const api = {
  ...leaderboardsApi,
  ...playersApi,
  ...sitesApi,
  ...groupsApi,
  ...eventsApi,
  ...eventTasksApi,
  ...eventMembershipApi,
  ...eventDiscordApi,
  ...eventPotApi,
  ...lootboardApi,
  ...announcementsApi,
  ...docsApi,
  ...redirectsApi,
  ...statusApi,
  ...devApi,
  ...itemValuesApi,
  ...accountApi,
  ...searchApi,
  ...npcsApi,
  ...manualSubmissionsApi,
  ...groupPointsApi,
  ...subscriptionsApi,
  ...layoutsApi,
  ...adminApi,
  ...badgesApi,
  ...adminDashboardApi,
  ...supportApi,
  ...chatApi,
  ...fileTransfersApi,
};

export * from "./types";
export { ApiError, apiErrorCode } from "./_client";
