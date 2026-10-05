import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/widget/overview/route";

const STATUS = {
  categories: [{ id: 1, name: "Plugin", issues: [{ id: 1 }, { id: 2 }] }],
  services: {
    api: {
      consumer_alive: true,
      online: true,
      players_1h: 615,
      processed: { "24h": 761753, "30m": 17712, "5m": 2874 },
      queue_depth: 0,
      status: "operational",
    },
    generated_at: 1791217103,
    players_5m: 337,
    webhook: {
      online: true,
      players_1h: 313,
      processed: { "24h": 248883, "30m": 8063, "5m": 1376 },
      status: "operational",
    },
  },
};

const SUMMARY = {
  generated_at: 1791217103,
  member_count: 30168,
  monthly_loot: { value: 85051451797, value_formatted: "85.05B" },
  partition: 202610,
  top_bosses: [
    { drops: 10888, loot: { value: 10175657429, value_formatted: "10.18B" }, name: "Phosani's Nightmare", npc_id: 9416 },
  ],
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(routes: Record<string, unknown>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const hit = Object.keys(routes).find((p) => url.endsWith(`/api/v1${p}`));
    if (!hit) return new Response("nope", { status: 500 });
    return new Response(JSON.stringify(routes[hit]), { status: 200 });
  }) as typeof fetch;
}

test("combines status and summary into the widget payload", async () => {
  stubFetch({ "/status": STATUS, "/platform/summary": SUMMARY });
  const res = await GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status.api.status, "operational");
  assert.equal(body.status.api.processed_24h, 761753);
  assert.equal(body.status.webhook.processed_5m, 1376);
  assert.equal(body.status.webhook.queue_depth, null);
  assert.equal(body.status.players_5m, 337);
  assert.equal(body.status.open_issues, 2);
  assert.equal(body.usage.monthly_loot_formatted, "85.05B");
  assert.equal(body.usage.accounts, 30168);
  assert.deepEqual(body.usage.top_bosses[0], {
    name: "Phosani's Nightmare",
    npc_id: 9416,
    drops: 10888,
    loot_formatted: "10.18B",
  });
});

test("a failed half is null, the other half still renders", async () => {
  stubFetch({ "/status": STATUS });
  const res = await GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.usage, null);
  assert.equal(body.status.api.status, "operational");
});

test("both halves failing is a 502", async () => {
  stubFetch({});
  const res = await GET();
  assert.equal(res.status, 502);
});
