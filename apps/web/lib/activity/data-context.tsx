"use client";

/** Launch context shared with every activity screen: the guild the activity
 * was opened in and its registered DropTracker group (null in DMs or for
 * unregistered servers — the app still works, just without clan scoping). */
import { createContext, useContext } from "react";
import type { GuildGroup } from "@/lib/activity/api";

export type ActivityData = {
  guildId: string | null;
  group: GuildGroup | null;
};

const ActivityDataContext = createContext<ActivityData>({ guildId: null, group: null });

export const ActivityDataProvider = ActivityDataContext.Provider;

export function useActivityData(): ActivityData {
  return useContext(ActivityDataContext);
}
