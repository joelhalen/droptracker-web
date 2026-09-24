/** Server-only fetch for /leaderboards2 (kept out of board-data.ts, which the
 * client board imports). */
import { apiGet, withFallback } from "@/lib/api/_client";
import { mockGroupLeaderboard, mockPlayerLeaderboard } from "@/lib/mock-data";
import { CardPageSchema, PAGE_SIZE, type BoardKind, type CardPage } from "./board-data";

export async function fetchBoard(
  kind: BoardKind,
  period: string,
  page: number,
  limit = PAGE_SIZE,
): Promise<CardPage> {
  const q = new URLSearchParams({ period, page: String(page), limit: String(limit) });
  if (kind === "players") q.set("scope", "global");
  return withFallback(
    async () =>
      CardPageSchema.parse(await apiGet(`/leaderboards/${kind}?${q}`, { revalidate: 15 })),
    () => (kind === "groups" ? mockGroupLeaderboard(page, limit) : mockPlayerLeaderboard(page, limit)),
  );
}
