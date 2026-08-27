/**
 * The Data API (v2) reference, as data.
 *
 * Kept here rather than as prose in the page so the endpoint list, the section
 * catalogue and the cost table are one structure that can be rendered
 * consistently and unit-tested for internal consistency (unique keys, sane
 * costs, every endpoint documented). The page is then just a view over it.
 *
 * This mirrors the server's registry in `data_api/sections.py`. It is
 * documentation, not the source of truth — `GET /v2/sections` always reports
 * what the running API actually offers, and the page says so.
 */

export const API_BASE = "https://api.droptracker.io/v2";

export type SectionCategory = "Core" | "Progress" | "Loot";

export interface ApiSection {
  key: string;
  cost: number;
  category: SectionCategory;
  summary: string;
}

/** Everything `?include=` accepts, cheapest first within each category. */
export const SECTIONS: ApiSection[] = [
  {
    key: "identity",
    cost: 0,
    category: "Core",
    summary:
      "Name, account type, combat and total level, EHB, last sync. Always included — every response says who it is about.",
  },
  {
    key: "loot",
    cost: 1,
    category: "Loot",
    summary:
      "Loot value this month and all time. Read from the same place as the leaderboard, so the two can never disagree.",
  },
  {
    key: "stats",
    cost: 2,
    category: "Progress",
    summary: "Experience in all 24 skills, plus the total.",
  },
  {
    key: "clog",
    cost: 2,
    category: "Progress",
    summary:
      "Collection log progress: slots obtained out of the game's own total, and how many individual slots we hold rows for.",
  },
  {
    key: "combat_achievements",
    cost: 2,
    category: "Progress",
    summary: "Combat achievement tasks completed and points earned.",
  },
  {
    key: "quests",
    cost: 2,
    category: "Progress",
    summary: "Quest counts by state: not started, in progress, finished.",
  },
  {
    key: "diaries",
    cost: 2,
    category: "Progress",
    summary: "Achievement diary tasks completed, per area and tier.",
  },
  {
    key: "points",
    cost: 2,
    category: "Progress",
    summary: "Lifetime DropTracker points earned.",
  },
  {
    key: "badges",
    cost: 2,
    category: "Progress",
    summary: "Badges the player currently holds.",
  },
  {
    key: "pets",
    cost: 2,
    category: "Progress",
    summary: "Pets received, with the date each was recorded.",
  },
  {
    key: "deaths",
    cost: 2,
    category: "Progress",
    summary: "Recorded death count and the most recent one.",
  },
  {
    key: "personal_bests",
    cost: 3,
    category: "Progress",
    summary: "Best time per boss, split by team-size bracket.",
  },
  {
    key: "loot_npcs",
    cost: 5,
    category: "Loot",
    summary: "Top NPCs by loot value over the requested window.",
  },
  {
    key: "loot_items",
    cost: 5,
    category: "Loot",
    summary: "Top items by loot value over the requested window.",
  },
  {
    key: "clog_slots",
    cost: 8,
    category: "Progress",
    summary:
      "Every recorded collection log slot with its quantity — around 1,500 rows per player, so price a page accordingly.",
  },
];

export interface ApiParam {
  name: string;
  default?: string;
  description: string;
}

export interface ApiEndpoint {
  method: "GET";
  path: string;
  title: string;
  summary: string;
  auth: boolean;
  params?: ApiParam[];
  example?: string;
}

export const ENDPOINTS: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/v2/health",
    title: "Health",
    summary: "Liveness check. The only endpoint that does not need a key.",
    auth: false,
  },
  {
    method: "GET",
    path: "/v2/meta",
    title: "About your key",
    summary:
      "Your key's id, label, tier, what it is scoped to, and the limits currently applied to it. Read your limits from here at runtime rather than hardcoding them — they change when a key is promoted.",
    auth: true,
  },
  {
    method: "GET",
    path: "/v2/sections",
    title: "Section catalogue",
    summary:
      "Every section the running API offers and what each one costs. This is the authoritative version of the table on this page.",
    auth: true,
  },
  {
    method: "GET",
    path: "/v2/players/{id_or_name}",
    title: "One player",
    summary:
      "A single player by numeric id or exact RSN, carrying whichever sections you ask for.",
    auth: true,
    params: [
      { name: "include", default: "identity", description: "Comma-separated section list, or `all`." },
      { name: "days", default: "30", description: "Window for the loot sections. Maximum 366." },
      { name: "top", default: "10", description: "Rows per player in `loot_npcs` and `loot_items`. Maximum 50." },
    ],
    example: `curl -H "Authorization: Bearer $DT_API_KEY" \\
  "${API_BASE}/players/Crawlicious?include=identity,stats,loot"`,
  },
  {
    method: "GET",
    path: "/v2/groups/{group_id}/players",
    title: "A group's roster",
    summary:
      "One page of your group's members, each carrying the same sections. Requires a group-scoped key for that group.",
    auth: true,
    params: [
      { name: "include", default: "identity", description: "Comma-separated section list, or `all`." },
      { name: "limit", default: "25", description: "Players per page. Maximum 100." },
      { name: "cursor", description: "The `next_cursor` from your previous response. Omit for the first page." },
      { name: "days", default: "30", description: "Window for the loot sections. Maximum 366." },
      { name: "top", default: "10", description: "Rows per player in the loot breakdowns. Maximum 50." },
    ],
    example: `curl -H "Authorization: Bearer $DT_API_KEY" \\
  "${API_BASE}/groups/19/players?include=identity,loot&limit=100"`,
  },
];

export interface ApiError {
  status: number;
  meaning: string;
  fix: string;
}

export const ERRORS: ApiError[] = [
  {
    status: 400,
    meaning: "Unknown section, or a malformed parameter.",
    fix: "The response names the section it did not recognise and lists the valid ones.",
  },
  {
    status: 401,
    meaning: "Missing, malformed, unknown, revoked or expired key.",
    fix: "All of those look identical on purpose, so a token cannot be used to probe which keys exist. Check the header format first.",
  },
  {
    status: 403,
    meaning: "A valid key, but not scoped to what you asked for.",
    fix: "Group keys may only read their own group.",
  },
  {
    status: 404,
    meaning: "No such player — or one outside your scope, or hidden.",
    fix: "These are deliberately indistinguishable; otherwise the API would let you enumerate other clans' rosters.",
  },
  {
    status: 429,
    meaning: "A rate-limit budget was exhausted.",
    fix: "`Retry-After` says how long to wait, and the `limit` field names which budget you hit.",
  },
  {
    status: 503,
    meaning: "The query exceeded the server's time limit.",
    fix: "Not a crash — the server gives up cleanly rather than holding the connection. Narrow `days` or ask for fewer sections.",
  },
];

export interface RateLimitBudget {
  name: string;
  description: string;
}

export const BUDGETS: RateLimitBudget[] = [
  { name: "requests_per_min", description: "How many calls you may make in a minute." },
  {
    name: "cost_units_per_min",
    description: "How much actual work you may cause in a minute — see the cost model below.",
  },
  { name: "requests_per_day", description: "Sustained daily volume." },
  { name: "max_concurrency", description: "How many requests you may have in flight at once." },
];

/** Section keys grouped for display, in the page's reading order. */
export function sectionsByCategory(): { category: SectionCategory; sections: ApiSection[] }[] {
  const order: SectionCategory[] = ["Core", "Loot", "Progress"];
  return order
    .map((category) => ({
      category,
      sections: SECTIONS.filter((s) => s.category === category).sort((a, b) => a.cost - b.cost),
    }))
    .filter((group) => group.sections.length > 0);
}

/**
 * What a request costs: players x the sum of the requested sections.
 *
 * Mirrors the server so the worked examples on the page cannot drift from the
 * arithmetic they describe.
 */
export function requestCost(sectionKeys: string[], players: number): number {
  const perPlayer = sectionKeys.reduce((total, key) => {
    const section = SECTIONS.find((s) => s.key === key);
    return total + (section?.cost ?? 0);
  }, 0);
  return Math.max(1, perPlayer * Math.max(1, players));
}
