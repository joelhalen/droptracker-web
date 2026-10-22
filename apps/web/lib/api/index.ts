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
import { pageLayoutsApi } from "./page-layouts";
import { groupsApi } from "./groups";
import { pluginConfigApi } from "./plugin-config";
import { eventsApi } from "./events";
import { eventTasksApi } from "./event-tasks";
import { eventMembershipApi } from "./event-membership";
import { eventDiscordApi } from "./event-discord";
import { eventPotApi } from "./event-pot";
import { groupBankApi } from "./group-bank";
import { pvpApi } from "./pvp";
import { eventPointsApi } from "./event-points";
import { lootboardApi } from "./lootboard";
import { announcementsApi } from "./announcements";
import { docsApi } from "./docs";
import { redirectsApi } from "./redirects";
import { adminWidgetApi } from "./admin-widget";
import { statusApi } from "./status";
import { platformApi } from "./platform";
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
import { staffApi } from "./staff";
import { fileTransfersApi } from "./file-transfers";
import { noticesApi } from "./notices";
import { eventConquestApi } from "./event-conquest";
import { testerBuildsApi } from "./tester-builds";
import { dataRemovalApi } from "./data-removal";
import { botProfileApi } from "./bot-profile";

export const api = {
  ...leaderboardsApi,
  ...dataRemovalApi,
  ...playersApi,
  ...sitesApi,
  ...pageLayoutsApi,
  ...groupsApi,
  ...pluginConfigApi,
  ...eventsApi,
  ...eventTasksApi,
  ...eventMembershipApi,
  ...eventDiscordApi,
  ...eventPotApi,
  ...groupBankApi,
  ...pvpApi,
  ...eventPointsApi,
  ...lootboardApi,
  ...announcementsApi,
  ...docsApi,
  ...redirectsApi,
  ...adminWidgetApi,
  ...statusApi,
  ...platformApi,
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
  ...staffApi,
  ...fileTransfersApi,
  ...noticesApi,
  ...eventConquestApi,
  ...testerBuildsApi,
  ...botProfileApi,
};

export * from "./types";
export { ApiError, apiErrorCode } from "./_client";
