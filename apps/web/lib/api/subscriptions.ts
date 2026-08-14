import { apiGet, apiSend, withFallback } from "./_client";
import {
  CheckoutSessionSchema,
  GroupSubscriptionSchema,
  AdminNitroBoostsSchema,
  GroupSubscriptionSummarySchema,
  SubscriptionTierSchema,
  SupportersSchema,
  type Supporters,
  type CheckoutSession,
  type GroupSubscription,
  type GroupSubscriptionSummary,
  type AdminNitroBoosts,
  type SubscriptionTier,
  type UserSubscription,
  UserSubscriptionSchema,
} from "@droptracker/api-types";
import {
  mockGroupSubscription,
  mockGroupSubscriptionSummary,
  mockUserSubscription,
  mockSubscriptionTiers,
  mockSupporters,
} from "../mock-data";

export const subscriptionsApi = {

  /** Nitro boost-slot attribution: the bot's latest reconcile plus every manual
   * override. `snapshot` is null until the bot has reconciled at least once. */
  async adminNitroBoosts(): Promise<AdminNitroBoosts> {
    return withFallback(
      async () => AdminNitroBoostsSchema.parse(await apiGet(`/admin/nitro-boosts`, { authed: true })),
      () => ({ per_boost_cents: 500, snapshot: null, overrides: [] }),
    );
  },


  /** Set (slots) or clear (null) a user's boost-slot count. */
  async adminSetNitroBoosts(userId: number, slots: number | null) {
    return apiSend("POST", `/admin/users/${userId}/nitro-boosts`, { slots });
  },


  /**
   * Paid subscriber groups + individual supporters for the homepage
   * appreciation wall. Public, cached; decorative — callers treat it as
   * best-effort (an empty result just hides the section).
   */
  async supporters(): Promise<Supporters> {
    return withFallback(
      async () => SupportersSchema.parse(await apiGet(`/supporters`, { revalidate: 300 })),
      () => mockSupporters(),
    );
  },


  // --- Group subscriptions / upgrades -----------------------------------
  /**
   * Group tiers by default; pass "user" or "all" to widen (e.g. admin).
   * `includeFree` surfaces $0 fallback tiers (the non-premium plan) — admin
   * only; public listings hide them so they never render as a checkout option.
   */
  async subscriptionTiers(
    scope: "group" | "user" | "all" = "group",
    opts?: { includeFree?: boolean },
  ): Promise<SubscriptionTier[]> {
    const qs = `?scope=${scope}${opts?.includeFree ? "&include_free=1" : ""}`;
    return withFallback(
      async () =>
        SubscriptionTierSchema.array().parse(
          await apiGet(`/subscriptions/tiers${qs}`, { revalidate: 300 }),
        ),
      () => mockSubscriptionTiers(),
    );
  },


  async groupSubscription(groupId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiGet(`/groups/${groupId}/subscription`, { authed: true }),
        ),
      () => mockGroupSubscription(groupId),
    );
  },


  /** Public pool summary for the group page "Support this clan" card. */
  async groupSubscriptionSummary(groupId: number): Promise<GroupSubscriptionSummary> {
    return withFallback(
      async () =>
        GroupSubscriptionSummarySchema.parse(
          await apiGet(`/groups/${groupId}/subscription/summary`, { revalidate: 60 }),
        ),
      () => mockGroupSubscriptionSummary(groupId),
    );
  },


  /** Add a contribution leg toward `tierKey` (pool model: any group member
   * pays the difference between the tier price and the current pool). */
  async subscriptionCheckout(groupId: number, tierKey: string): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/checkout`, { tier_key: tierKey }),
        ),
      () => ({ url: null }),
    );
  },


  /** Wind down ONE contribution leg (payer or group admin). */
  async cancelSubscriptionLeg(groupId: number, legId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/legs/${legId}/cancel`, {}),
        ),
      () => ({ ...mockGroupSubscription(groupId), cancel_at_period_end: true }),
    );
  },


  async resumeSubscriptionLeg(groupId: number, legId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/legs/${legId}/resume`, {}),
        ),
      () => ({ ...mockGroupSubscription(groupId), cancel_at_period_end: false }),
    );
  },


  /** Open the provider's billing portal (update card, invoices, cancel). */
  async billingPortal(groupId: number): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(
          await apiSend("POST", `/groups/${groupId}/subscription/portal`, {}),
        ),
      () => ({ url: null }),
    );
  },


  // --- User supporter subscription ---------------------------------------
  /** User-scoped supporter tiers for the pricing page. */
  async supporterTiers(): Promise<SubscriptionTier[]> {
    return withFallback(
      async () =>
        SubscriptionTierSchema.array().parse(
          await apiGet(`/subscriptions/tiers?scope=user`, { revalidate: 300 }),
        ),
      () => [],
    );
  },


  async mySubscription(): Promise<UserSubscription> {
    return withFallback(
      async () =>
        UserSubscriptionSchema.parse(await apiGet(`/users/me/subscription`, { authed: true })),
      () => mockUserSubscription(),
    );
  },


  /** Begin (or switch to) a supporter tier; returns a provider redirect URL.
   * Pay-what-you-want: `amountCents` (>= tier minimum) picks the recurring
   * amount; omitted = the tier minimum. */
  async mySubscriptionCheckout(tierKey: string, amountCents?: number): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(
          await apiSend("POST", `/users/me/subscription/checkout`, {
            tier_key: tierKey,
            ...(amountCents != null ? { amount_cents: amountCents } : {}),
          }),
        ),
      () => ({ url: null }),
    );
  },


  async cancelMySubscription(): Promise<UserSubscription> {
    return withFallback(
      async () =>
        UserSubscriptionSchema.parse(await apiSend("POST", `/users/me/subscription/cancel`, {})),
      () => ({ ...mockUserSubscription(), cancel_at_period_end: true }),
    );
  },


  async resumeMySubscription(): Promise<UserSubscription> {
    return withFallback(
      async () =>
        UserSubscriptionSchema.parse(await apiSend("POST", `/users/me/subscription/resume`, {})),
      () => ({ ...mockUserSubscription(), cancel_at_period_end: false }),
    );
  },


  /** Open the provider's billing portal for the supporter subscription. */
  async myBillingPortal(): Promise<CheckoutSession> {
    return withFallback(
      async () =>
        CheckoutSessionSchema.parse(await apiSend("POST", `/users/me/subscription/portal`, {})),
      () => ({ url: null }),
    );
  },
};
