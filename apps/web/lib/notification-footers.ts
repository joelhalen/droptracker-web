import type { FooterChoice, FooterType, NotificationFooters } from "@droptracker/api-types";

/** What the preview shows when the footer settings could not be loaded. */
export const FALLBACK_FOOTER = "Powered by the DropTracker | https://www.droptracker.io/";

/**
 * The footer a notification of `type` is sent with, still holding its
 * placeholders; null for none. Mirrors services/notification_text.pick_footer:
 * the type's own choice, then its fallback type's (a duplicate pet follows
 * pets), then the choice for every message. Without the entitlement the
 * DropTracker footer is sent whatever is saved.
 */
export function resolveFooter(
  footers: NotificationFooters | null | undefined,
  type: FooterType,
): string | null {
  const ours = footers?.default_footer ?? FALLBACK_FOOTER;
  if (!footers || !footers.entitled) return ours;
  const fallback = footers.fallback_types[type];
  const chain: (FooterChoice | null | undefined)[] = [
    footers.types[type],
    fallback ? footers.types[fallback] : undefined,
    footers.all,
  ];
  for (const choice of chain) {
    if (!choice) continue;
    if (choice.mode === "none") return null;
    if (choice.mode === "custom") return choice.text?.trim() ? choice.text : null;
    return ours;
  }
  return ours;
}
