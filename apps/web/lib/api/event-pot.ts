import { apiGet, apiSend, withFallback } from "./_client";
import {
  EventDetailSchema,
  EventPrizePotSchema,
  type EventPrizePot,
  type EventBuyinKind,
  type EventBuyinStatus,
  type EventPrizeDistribution,
  type EventDetail,
} from "@droptracker/api-types";
import {
  mockEvent,
} from "../mock-data";

export const eventPotApi = {

  // --- Prize pot: buy-ins & donations (web52a) -----------------------------
  /** The event's prize pot: totals, config, per-team breakdown and (unless
   * redacted) the contributor list. Public read; admins get every row + notes. */
  async eventPot(eventId: number): Promise<EventPrizePot> {
    const zero = { value: 0, value_formatted: "0" };
    return withFallback(
      async () => EventPrizePotSchema.parse(await apiGet(`/events/${eventId}/pot`, { authed: true })),
      () => ({
        enabled: false,
        total: zero,
        buyin_total: zero,
        donation_total: zero,
        config: {
          default_buyin: zero,
          distribution: "first_only" as const,
          top_n: 1,
          splits: [100],
          advertise: false,
          show_contributors: true,
          allow_leader_mark: false,
        },
        per_team: [],
        contributors: [],
        can_manage: false,
      }),
    );
  },


  /** Record a buy-in or donation. Buy-ins default `pledged`; donations `paid`. */
  async recordBuyin(
    eventId: number,
    input: {
      player_id?: number | null;
      rsn?: string | null;
      team_id?: number | null;
      kind?: EventBuyinKind;
      amount: number;
      status?: "pledged" | "paid";
      note?: string | null;
      /** Object key from `uploadProof` — the backend builds the CDN URL. */
      proof_key?: string | null;
    },
  ): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events/${eventId}/buyins`, input)) as { id: number },
      () => ({ id: 0 }),
    );
  },


  /** Edit a buy-in's amount / note / proof, or flip its paid state (the roster
   * "tick"). `proof_key: null` detaches the screenshot; omitting it leaves the
   * existing one alone. */
  async updateBuyin(
    eventId: number,
    buyinId: number,
    patch: {
      amount?: number;
      status?: EventBuyinStatus;
      note?: string | null;
      proof_key?: string | null;
    },
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/events/${eventId}/buyins/${buyinId}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Remove a buy-in — soft-void once it was ever paid, else a hard delete. */
  async deleteBuyin(eventId: number, buyinId: number): Promise<{ ok: true; voided: boolean }> {
    return withFallback(
      async () =>
        (await apiSend("DELETE", `/events/${eventId}/buyins/${buyinId}`, {})) as {
          ok: true;
          voided: boolean;
        },
      () => ({ ok: true, voided: false }),
    );
  },


  /** Seed one pledged buy-in per member at the default buy-in (a ready
   * checklist). Optionally scoped to one team. Skips members already seeded. */
  async bulkSeedBuyins(eventId: number, teamId?: number | null): Promise<{ created: number }> {
    return withFallback(
      async () =>
        (await apiSend(
          "POST",
          `/events/${eventId}/buyins/bulk`,
          teamId != null ? { team_id: teamId } : {},
        )) as { created: number },
      () => ({ created: 0 }),
    );
  },


  /** Post the current pot to the event's Discord announcements channel now. */
  async announcePot(eventId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/pot/announce`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Toggle the pot and/or merge its config (writes to PATCH /events/{id}).
   * Disabling an event that has recorded buy-ins throws ApiError 409 (problem
   * `type: "buyins-present"` with `count`/`total`) unless `confirm_disable_buyins`
   * is set — the caller catches it to show a confirm dialog, then retries. */
  async updateEventPotConfig(
    eventId: number,
    input: {
      buyins_enabled?: boolean;
      confirm_disable_buyins?: boolean;
      prize_config?: {
        default_buyin?: number;
        distribution?: EventPrizeDistribution;
        top_n?: number;
        splits?: number[];
        advertise?: boolean;
        show_contributors?: boolean;
        allow_leader_mark?: boolean;
      };
    },
  ): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiSend("PATCH", `/events/${eventId}`, input)),
      () => mockEvent(eventId),
    );
  },
};
