import { apiGet, withFallback } from "./_client";
import { FeedEventSchema, type FeedEvent } from "./types";
import {
  SearchResultsSchema,
  type SearchResults,
} from "@droptracker/api-types";
import {
  mockSearch,
} from "../mock-data";

export const searchApi = {

  async search(q: string): Promise<SearchResults> {
    if (!q.trim()) return { players: [], groups: [], npcs: [], items: [] };
    return withFallback(
      async () =>
        SearchResultsSchema.parse(
          await apiGet(`/search?q=${encodeURIComponent(q)}`, { revalidate: 10 }),
        ),
      () => mockSearch(q),
    );
  },


  /**
   * Recent drop-feed history — the same Redis-backed list the live ticker
   * hydrates from via `/api/feed/recent`. Used server-side for decorative
   * surfaces (homepage hero collage); callers should treat it as best-effort.
   */
  async recentFeed(): Promise<FeedEvent[]> {
    return withFallback(
      async () => FeedEventSchema.array().parse(await apiGet(`/feed/recent`, { revalidate: 60 })),
      () => [],
    );
  },
};
