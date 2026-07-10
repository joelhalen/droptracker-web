"use server";

import { revalidatePath } from "next/cache";
import {
  SuggestionCreateSchema,
  SuggestionReplyCreateSchema,
  type SuggestionCreate,
} from "@droptracker/api-types";
import { api } from "@/lib/api";

/** Server Action: validate and forward a new suggestion/bug thread to the Web
 * API, which stores it and queues the Discord forum post for the bot. */
export async function submitSuggestion(input: SuggestionCreate) {
  const parsed = SuggestionCreateSchema.parse(input);
  const created = await api.createSuggestion(parsed);
  revalidatePath("/suggestions");
  return created;
}

/** Server Action: post a reply on a thread; the Web API relays it into the
 * Discord thread with attribution. */
export async function submitReply(suggestionId: number, content: string) {
  const parsed = SuggestionReplyCreateSchema.parse({ content });
  const created = await api.createSuggestionReply(suggestionId, parsed);
  revalidatePath(`/suggestions/${suggestionId}`);
  return created;
}
