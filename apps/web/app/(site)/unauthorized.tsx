"use client";

/**
 * 401 interrupt boundary (web57a): rendered when a server guard calls
 * `unauthorized()` — a signed-out visitor on a role-gated subtree (/admin,
 * /moderation). Client component so it can read the requested path and build
 * a sign-in link that round-trips straight back to it.
 */
import { usePathname } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";

function contextNote(pathname: string): string | null {
  if (pathname.startsWith("/admin")) {
    return "Heads up: this area is restricted to DropTracker site staff, so you'll also need a staff account.";
  }
  if (pathname.startsWith("/moderation")) {
    return "Heads up: this area is restricted to site moderators, so you'll also need a moderator account.";
  }
  return null;
}

export default function Unauthorized() {
  const pathname = usePathname() ?? "/";
  const note = contextNote(pathname);
  return (
    <AccessDenied
      title="Sign in to continue"
      message="This page requires a signed-in account. Sign in with Discord and we'll bring you right back here."
      signInReturnTo={pathname}
    >
      {note && <p className="text-osrs-parchment-dark/60 mt-3 text-xs">{note}</p>}
    </AccessDenied>
  );
}
