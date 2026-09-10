/**
 * Copy for the (site) 403 interrupt boundary (web57a), tailored to the
 * requested path and — once `/me` has loaded — to who is looking. Pure and
 * client-safe (no `lib/auth`, which pulls in server-only modules), so the
 * boundary can call it from a client component and tests can call it directly.
 */
import type { Me } from "@droptracker/api-types";

export type ForbiddenCopy = {
  title: string;
  message: string;
  back?: { href: string; label: string };
};

export function forbiddenCopy(pathname: string, me?: Me | null): ForbiddenCopy {
  if (pathname.startsWith("/admin")) {
    return {
      title: "Staff only",
      message:
        "The admin control panel is restricted to DropTracker site staff (superadmins, and developers for the diagnostic pages), and your account doesn't have the required access. If you're looking for your clan's settings, head to your group's admin panel instead.",
    };
  }
  const groupAdmin = pathname.match(/^\/groups\/(\d+)\//);
  if (groupAdmin) {
    const groupId = Number(groupAdmin[1]);
    // web64a: an event manager is admitted to the Events subtree only, so
    // landing on any other admin page (a leader's pasted /admin link) is
    // expected. Send them to what they can open, rather than telling them to
    // get themselves added under Authorized users — which is full admin.
    const entry = me?.groups.find((g) => g.id === groupId);
    if (entry?.can_manage_events && entry.role === "member") {
      return {
        title: "Group admins only",
        message:
          "You're an event manager for this group, which lets you create, run and configure its events — but this page belongs to the group's owner and admins. Ask one of them if you need something changed here.",
        back: { href: `/groups/${groupId}/events`, label: "Go to the group's events" },
      };
    }
    return {
      title: "Group admins only",
      message:
        "Managing this group requires an owner or admin role in it, and your account doesn't have one. If you should have access, ask the group's owner to add you under Authorized users — or, if you administer the clan's Discord server, sign out and back in so your roles refresh.",
      back: { href: `/groups/${groupId}`, label: "View the group's public page" },
    };
  }
  return {
    title: "Access denied",
    message: "Your account doesn't have permission to view this page.",
  };
}
