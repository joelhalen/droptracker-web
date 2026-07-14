"use client";

/**
 * Session state for the Discord Activity.
 *
 * The activity never uses cookies — the `dt_session` cookie can't survive the
 * discordsays.com iframe (it would need SameSite=None; Secure; Partitioned,
 * which conflicts with the Cloudflare-Flexible constraint documented in
 * lib/env.ts). Instead the session JWT lives in React state and rides as an
 * `Authorization: Bearer` header on /api/activity/* calls, where the BFF
 * forwards it upstream as the usual `dt_session` cookie header.
 *
 * `sessionToken == null` is a fully supported anonymous mode: public events
 * are viewable without consenting to the OAuth prompt.
 */
import { createContext, useContext } from "react";

export type ActivityUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

export type ActivityAuth = {
  /** Web API session JWT, held in memory only. Null = anonymous viewer. */
  sessionToken: string | null;
  user: ActivityUser | null;
};

const ActivityAuthContext = createContext<ActivityAuth>({
  sessionToken: null,
  user: null,
});

export const ActivityAuthProvider = ActivityAuthContext.Provider;

export function useActivityAuth(): ActivityAuth {
  return useContext(ActivityAuthContext);
}
