/**
 * Real Data API responses for the reference page.
 *
 * `api-examples.json` is captured from the running API against live data by
 * the backend repo's `scripts/capture_api_examples.py` (no key is minted and
 * nothing is metered). It is committed here so the page is static; re-run the
 * script with `--write` and commit the file when a response shape changes.
 * Long arrays and maps are cut down, each cut marked `// … N more`, and
 * Discord ids are replaced with a placeholder.
 */
import raw from "./api-examples.json";

export interface ApiExample {
  id: string;
  /** "GET https://api.droptracker.io/v2/…" exactly as it was sent. */
  request: string;
  status: number;
  /** Pretty-printed JSON, with cuts marked as comments. */
  body: string;
}

export const EXAMPLES_CAPTURED_AT: string = raw.captured_at;
export const EXAMPLE_PLAYER: string = raw.player;
export const EXAMPLE_GROUP_ID: number = raw.group_id;

const BY_ID = new Map<string, ApiExample>(
  (raw.examples as ApiExample[]).map((example) => [example.id, example]),
);

/** Which captured example illustrates each documented endpoint path. */
const ENDPOINT_EXAMPLES: Record<string, string> = {
  "/v2/health": "health",
  "/v2/meta": "meta",
  "/v2/sections": "sections",
  "/v2/groups": "groups",
  "/v2/players": "players",
  "/v2/collection-log": "collection_log",
  "/v2/npcs": "npcs",
  "/v2/npcs/{npc_id}": "npc",
  "/v2/players/{id_or_name}": "player",
  "/v2/groups/{group_id}/players": "roster",
  "/v2/groups/{group_id}/events": "group_events",
};

export function example(id: string): ApiExample | null {
  return BY_ID.get(id) ?? null;
}

export function endpointExample(path: string): ApiExample | null {
  const id = ENDPOINT_EXAMPLES[path];
  return id ? example(id) : null;
}

/** What one `?include=` section adds to a player, on its own. */
export function sectionExample(key: string): ApiExample | null {
  return example(`section:${key}`);
}

export function allExamples(): ApiExample[] {
  return [...BY_ID.values()];
}

/** The curl form of a captured request. */
export function curlFor(ex: ApiExample): string {
  const url = ex.request.replace(/^GET /, "");
  return `curl -H "Authorization: Bearer $DT_API_KEY" \\\n  "${url}"`;
}
