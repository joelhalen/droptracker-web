import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../app/api/widget/admin/route";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function req(auth?: string) {
  return new NextRequest("https://www.droptracker.io/api/widget/admin", {
    headers: auth ? { authorization: auth } : {},
  });
}

test("rejects anything that is not a dtw_ bearer token without calling upstream", async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}");
  }) as typeof fetch;
  for (const auth of [undefined, "Bearer eyJhbGciOi.jwt", "dtw_abc", "Bearer dtw_bad token"]) {
    const res = await GET(req(auth));
    assert.equal(res.status, 401);
  }
  assert.equal(called, false);
});

test("forwards the token and returns the summary uncached", async () => {
  let seen: string | null = null;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    seen = new Headers(init?.headers).get("authorization");
    return new Response(
      JSON.stringify({ generated_at: 1, user_id: 0, support: { tickets_open: 2 }, business: null, dev: null }),
      { status: 200 },
    );
  }) as typeof fetch;
  const res = await GET(req("Bearer dtw_abc-DEF_123"));
  assert.equal(res.status, 200);
  assert.equal(seen, "Bearer dtw_abc-DEF_123");
  assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  const body = await res.json();
  assert.equal(body.support.tickets_open, 2);
});

test("passes revoked/demoted statuses through", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ code: "widget_token_invalid" }), { status: 401 })) as typeof fetch;
  const res = await GET(req("Bearer dtw_revoked"));
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "widget_token_invalid");
});
