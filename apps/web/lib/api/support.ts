import { apiGet, apiSend, withFallback } from "./_client";
import {
  AdminTicketPageSchema,
  SuggestionDetailSchema,
  SuggestionMessageSchema,
  SuggestionPageSchema,
  TicketDetailSchema,
  TicketMessageSchema,
  TicketPageSchema,
  TicketSummarySchema,
  type AdminTicketPage,
  type SuggestionCreate,
  type SuggestionDetail,
  type SuggestionMessage,
  type SuggestionPage,
  type SuggestionReplyCreate,
  type TicketCreate,
  type TicketDetail,
  type TicketMessage,
  type TicketPage,
  type TicketReplyCreate,
  type TicketSummary,
} from "@droptracker/api-types";
import {
  mockAdminTickets,
  mockCreatedTicket,
  mockMyTickets,
  mockSuggestionDetail,
  mockSuggestions,
  mockTicket,
  mockTicketReply,
} from "../mock-data";

export const supportApi = {
  // --- Support tickets (web21a) -------------------------------------------
  async myTickets(params: { page?: number; limit?: number } = {}): Promise<TicketPage> {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () => TicketPageSchema.parse(await apiGet(`/me/tickets${suffix}`, { authed: true })),
      () => mockMyTickets(params.page ?? 1),
    );
  },

  async ticket(ticketId: number): Promise<TicketDetail> {
    return withFallback(
      async () => TicketDetailSchema.parse(await apiGet(`/tickets/${ticketId}`, { authed: true })),
      () => mockTicket(ticketId),
    );
  },

  // --- Support widget (web102a): web ticket creation + replies -------------

  /** POST /me/tickets — opens a `pending` ticket; the bot provisions its
   * Discord channel and flips it to `open`. 409 when one is already open. */
  async createTicket(input: TicketCreate): Promise<TicketDetail> {
    return withFallback(
      async () => TicketDetailSchema.parse(await apiSend("POST", `/me/tickets`, input)),
      () => mockCreatedTicket(input),
    );
  },

  /** POST /tickets/{id}/messages — a web reply, relayed into the ticket's
   * Discord channel by the bot (screenshots included). Only valid while the
   * ticket is `open`. `attachments` are upload keys, max 4; content may be
   * empty when at least one rides along. */
  async ticketReply(ticketId: number, input: TicketReplyCreate): Promise<TicketMessage> {
    return withFallback(
      async () =>
        TicketMessageSchema.parse(await apiSend("POST", `/tickets/${ticketId}/messages`, input)),
      () => mockTicketReply(input),
    );
  },

  /** Advance-only read pointer for the ticket surface (widget unread). */
  async markTicketRead(
    ticketId: number,
    messageId: number,
  ): Promise<{ last_read_message_id: number; unread: number }> {
    return withFallback(
      async () =>
        (await apiSend("POST", `/tickets/${ticketId}/read`, { message_id: messageId })) as {
          last_read_message_id: number;
          unread: number;
        },
      () => ({ last_read_message_id: messageId, unread: 0 }),
    );
  },

  /** Advance-only read pointer for the suggestion surface (widget unread). */
  async markSuggestionRead(
    suggestionId: number,
    messageId: number,
  ): Promise<{ last_read_message_id: number; unread: number }> {
    return withFallback(
      async () =>
        (await apiSend("POST", `/suggestions/${suggestionId}/read`, {
          message_id: messageId,
        })) as { last_read_message_id: number; unread: number },
      () => ({ last_read_message_id: messageId, unread: 0 }),
    );
  },

  async adminTickets(
    params: { status?: string; type?: string; q?: string; page?: number; limit?: number } = {},
  ): Promise<AdminTicketPage> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.type) qs.set("type", params.type);
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        AdminTicketPageSchema.parse(await apiGet(`/admin/tickets${suffix}`, { authed: true })),
      () => mockAdminTickets(params.page ?? 1),
    );
  },

  async adminTicketAction(
    ticketId: number,
    action: "claim" | "unclaim" | "close",
  ): Promise<TicketSummary> {
    return withFallback(
      async () =>
        TicketSummarySchema.parse(await apiSend("PATCH", `/admin/tickets/${ticketId}`, { action })),
      () => mockMyTickets(1).items[0]!,
    );
  },

  // --- Suggestion forum (web /suggestions, mirrored with Discord) ---------
  async suggestions(
    params: { type?: string; mine?: boolean; open?: boolean; page?: number; limit?: number } = {},
  ): Promise<SuggestionPage> {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (params.mine) qs.set("mine", "1");
    if (params.open) qs.set("open", "1");
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        SuggestionPageSchema.parse(await apiGet(`/suggestions${suffix}`, { authed: true })),
      () => mockSuggestions(params.page ?? 1),
    );
  },

  async suggestion(id: number): Promise<SuggestionDetail> {
    return withFallback(
      async () =>
        SuggestionDetailSchema.parse(await apiGet(`/suggestions/${id}`, { authed: true })),
      () => mockSuggestionDetail(id),
    );
  },

  async createSuggestion(input: SuggestionCreate): Promise<SuggestionDetail> {
    return withFallback(
      async () => SuggestionDetailSchema.parse(await apiSend("POST", `/suggestions`, input)),
      () => ({ ...mockSuggestionDetail(99), ...input, status: "pending" as const }),
    );
  },

  async createSuggestionReply(
    suggestionId: number,
    input: SuggestionReplyCreate,
  ): Promise<SuggestionMessage> {
    return withFallback(
      async () =>
        SuggestionMessageSchema.parse(
          await apiSend("POST", `/suggestions/${suggestionId}/messages`, input),
        ),
      () => mockSuggestionDetail(suggestionId).messages[0]!,
    );
  },
};
