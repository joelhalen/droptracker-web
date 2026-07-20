"use client";

/**
 * 403 interrupt boundary (web57a): rendered when a server guard calls
 * `forbidden()` — a signed-in user without the role a subtree requires.
 * Client component so the copy can be tailored to the requested path
 * (staff area vs moderation vs a specific group's admin panel).
 */
import { usePathname } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";

function forbiddenCopy(pathname: string): {
  title: string;
  message: string;
  back?: { href: string; label: string };
} {
  if (pathname.startsWith("/admin")) {
    return {
      title: "Staff only",
      message:
        "The admin control panel is restricted to DropTracker site staff, and your account doesn't have staff access. If you're looking for your clan's settings, head to your group's admin panel instead.",
    };
  }
  if (pathname.startsWith("/moderation")) {
    return {
      title: "Moderators only",
      message:
        "The moderation panel is restricted to site moderators, and your account doesn't have moderator access.",
    };
  }
  const groupAdmin = pathname.match(/^\/groups\/(\d+)\//);
  if (groupAdmin) {
    return {
      title: "Group admins only",
      message:
        "Managing this group requires an owner or admin role in it, and your account doesn't have one. If you should have access, ask the group's owner to add you under Authorized users — or, if you administer the clan's Discord server, sign out and back in so your roles refresh.",
      back: { href: `/groups/${groupAdmin[1]}`, label: "View the group's public page" },
    };
  }
  return {
    title: "Access denied",
    message: "Your account doesn't have permission to view this page.",
  };
}

export default function Forbidden() {
  const pathname = usePathname() ?? "/";
  const copy = forbiddenCopy(pathname);
  return (
    <AccessDenied title={copy.title} message={copy.message} back={copy.back} icon="⛔" />
  );
}
