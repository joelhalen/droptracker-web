/**
 * Entity hover-card payloads (players + groups). The BFF card routes
 * (`/api/players/[id]/card`, `/api/groups/[id]/card`) reduce the full
 * profile responses (`api.player()` / `api.group()`) into these compact
 * shapes so hover cards stay a few hundred bytes and render instantly;
 * the client (`components/entity-hover-card.tsx`) fetches them lazily the
 * first time a card opens and caches per session.
 */
import type {
  GroupFlair,
  GroupProfile,
  Money,
  PlayerBadge,
  PlayerProfile,
} from "@droptracker/api-types";

/** Max linked rows on a card — enough for a read, small enough to stay a card. */
const CARD_GROUPS = 3;
const CARD_TOP_PLAYERS = 3;
const CARD_BADGES = 4;

export type PlayerCardBadge = {
  key: string;
  label: string;
  tone: PlayerBadge["tone"];
  emoji?: string | null;
  icon_url?: string | null;
};

export type PlayerCard = {
  kind: "player";
  id: number;
  name: string;
  global_rank?: number;
  /** Total ranked players, for "Top X%" context. */
  ranked_players?: number;
  total_loot?: Money;
  points?: number;
  top_npc?: string;
  is_supporter?: boolean;
  badges: PlayerCardBadge[];
  /** Total badge count (badges above are capped). */
  badge_count: number;
  groups: { id: number; name: string; flair?: GroupFlair }[];
  /** Total group count (groups above are capped). */
  group_count: number;
};

export type GroupCard = {
  kind: "group";
  id: number;
  name: string;
  description?: string;
  member_count: number;
  global_rank?: number;
  monthly_loot?: Money;
  /** Subscription tier flair (present for subscribed groups). */
  flair?: GroupFlair;
  top_players: { rank: number; id: number; name: string; loot: Money }[];
  top_boss?: { npc_id: number; name: string };
};

export type EntityCard = PlayerCard | GroupCard;

export function toPlayerCard(p: PlayerProfile): PlayerCard {
  const active = (p.badges ?? []).filter((b) => b.status === "active");
  return {
    kind: "player",
    id: p.id,
    name: p.name,
    global_rank: p.global_rank,
    ranked_players: p.ranked_players,
    total_loot: p.total_loot,
    points: p.points,
    top_npc: p.top_npc,
    is_supporter: p.is_supporter,
    badges: active.slice(0, CARD_BADGES).map((b) => ({
      key: b.key,
      label: b.name,
      tone: b.tone,
      emoji: b.icon_emoji,
      icon_url: b.icon_url,
    })),
    badge_count: active.length,
    groups: p.groups.slice(0, CARD_GROUPS).map((g) => ({
      id: g.id,
      name: g.name,
      flair: g.flair,
    })),
    group_count: p.groups.length,
  };
}

export function toGroupCard(g: GroupProfile): GroupCard {
  return {
    kind: "group",
    id: g.id,
    name: g.name,
    description: g.description,
    member_count: g.member_count,
    global_rank: g.global_rank,
    monthly_loot: g.monthly_loot,
    flair: g.flair,
    top_players: (g.top_players ?? []).slice(0, CARD_TOP_PLAYERS).map((p) => ({
      rank: p.rank,
      id: p.id,
      name: p.name,
      loot: p.loot,
    })),
    top_boss: g.top_bosses?.[0]
      ? { npc_id: g.top_bosses[0].npc_id, name: g.top_bosses[0].name }
      : undefined,
  };
}
