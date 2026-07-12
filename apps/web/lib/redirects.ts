/**
 * Admin-configurable redirects — shared types and Zod schemas (the contract).
 *
 * This module is intentionally dependency-free (only `zod`) so it is safe to
 * import from `lib/api.ts` and every server route without dragging in
 * `path-to-regexp`. The pattern-matching engine (which needs path-to-regexp)
 * lives in `lib/redirect-resolver.ts`, imported only by the Edge middleware,
 * the admin client, and tests.
 *
 * See `web_api/routes/redirects.py` for the backend contract.
 */
import { z } from "zod";

/** Minimal shape the middleware consumes (enabled entries only). */
export const RedirectRuleSchema = z.object({
  source: z.string(),
  destination: z.string(),
  permanent: z.boolean(),
  order: z.number().int(),
  forward_query: z.boolean(),
});
export type RedirectRule = z.infer<typeof RedirectRuleSchema>;

/** Full row as returned by the admin endpoints. */
export const RedirectSchema = RedirectRuleSchema.extend({
  id: z.number().int(),
  enabled: z.boolean(),
  note: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
export type Redirect = z.infer<typeof RedirectSchema>;

/** What the admin form submits. */
export const RedirectInputSchema = z.object({
  source: z.string().min(1).max(512),
  destination: z.string().min(1).max(1024),
  permanent: z.boolean().default(false),
  enabled: z.boolean().default(true),
  order: z.number().int().default(100),
  forward_query: z.boolean().default(true),
  note: z.string().max(255).nullable().default(null),
});
export type RedirectInput = z.infer<typeof RedirectInputSchema>;

/** True for an absolute http(s) destination (vs. an internal `/…` path). Pure
 * regex — safe to import anywhere. */
export function isExternalDestination(destination: string): boolean {
  return /^https?:\/\//i.test(destination);
}
