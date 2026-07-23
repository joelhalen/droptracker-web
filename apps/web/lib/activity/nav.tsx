"use client";

/**
 * In-app navigation for the Discord Activity.
 *
 * The activity is a single chromeless SPA in an iframe — site routes don't
 * exist there, so `next/link`/`entityPath` navigation would 404. Instead we
 * keep a simple view STACK in React state: the bottom tab bar resets the stack
 * to a root view, detail screens (a player, an event, a PB board) push on top,
 * and the back affordance pops. This mirrors the site's information
 * architecture (Leaderboards → players/groups/pbs, Events, profile) without
 * URL routing.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ActivityView =
  | { name: "home" }
  | { name: "ranks"; tab: "players" | "groups" | "pbs" }
  | { name: "events" }
  | { name: "me" }
  | { name: "event"; id: number }
  | { name: "event-review"; id: number }
  | { name: "event-players"; id: number }
  | { name: "event-team"; id: number; teamId: number }
  | { name: "player"; id: number }
  | { name: "group"; id: number }
  | { name: "group-setup" }
  | { name: "pb-board"; npcId: number; bossName: string };

export type ActivityTab = "home" | "ranks" | "events" | "me";

/** Which bottom tab a root view belongs to (details inherit the root's tab). */
export function tabOf(root: ActivityView): ActivityTab {
  switch (root.name) {
    case "ranks":
    case "pb-board":
      return "ranks";
    case "events":
    case "event":
    case "event-review":
    case "event-players":
    case "event-team":
      return "events";
    case "me":
      return "me";
    default:
      return "home";
  }
}

type ActivityNav = {
  /** Top of the stack — the view currently on screen. */
  view: ActivityView;
  /** The root view (bottom of the stack) — decides the active tab. */
  root: ActivityView;
  canPop: boolean;
  push: (view: ActivityView) => void;
  pop: () => void;
  /** Tab-bar switch: replaces the whole stack with one root view. */
  setRoot: (view: ActivityView) => void;
};

const NavContext = createContext<ActivityNav | null>(null);

export function ActivityNavProvider({
  initial,
  children,
}: {
  initial?: ActivityView;
  children: React.ReactNode;
}) {
  const [stack, setStack] = useState<ActivityView[]>([initial ?? { name: "home" }]);

  const push = useCallback((view: ActivityView) => {
    setStack((s) => [...s, view]);
  }, []);
  const pop = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);
  const setRoot = useCallback((view: ActivityView) => {
    setStack([view]);
  }, []);

  const value = useMemo<ActivityNav>(
    () => ({
      view: stack[stack.length - 1] ?? { name: "home" },
      root: stack[0] ?? { name: "home" },
      canPop: stack.length > 1,
      push,
      pop,
      setRoot,
    }),
    [stack, push, pop, setRoot],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useActivityNav(): ActivityNav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useActivityNav outside ActivityNavProvider");
  return nav;
}
