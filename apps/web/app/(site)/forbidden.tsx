"use client";

/**
 * 403 interrupt boundary (web57a): rendered when a server guard calls
 * `forbidden()` — a signed-in user without the role a subtree requires.
 * Client component so the copy can be tailored to the requested path
 * (staff area vs a specific group's admin panel) and to the viewer's own
 * roles once `/me` arrives (an event manager is pointed at Events).
 */
import { usePathname } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { forbiddenCopy } from "@/lib/forbidden-copy";
import { useMe } from "@/lib/use-me";

export default function Forbidden() {
  const pathname = usePathname() ?? "/";
  const me = useMe();
  const copy = forbiddenCopy(pathname, me);
  return (
    <AccessDenied title={copy.title} message={copy.message} back={copy.back} icon="⛔" />
  );
}
