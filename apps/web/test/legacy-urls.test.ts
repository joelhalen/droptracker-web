/**
 * The legacy XenForo URL map in `next.config.ts`.
 *
 * These are the shapes still arriving from Discord history, old embeds and
 * search results — `/groups/PlayTheGame.176/view` and friends. Next applies the
 * map itself, so this asserts against the config's own rules, resolved with the
 * same path-to-regexp engine Next uses (and that `lib/redirect-resolver.ts`
 * uses for the DB-backed layer).
 *
 * Every rule lands on the bare id, which is a real current URL: a redirect
 * thrown from the entity page instead would arrive as an in-band 200, because
 * `(public)/loading.tsx` puts every public page behind a Suspense boundary.
 * `lib/entity-ref.ts` still understands the ref (see `test/slug.test.ts`) as
 * the net for any XF shape this map misses.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { match } from "path-to-regexp";
import nextConfig from "../next.config";

type Rule = { source: string; destination: string; permanent?: boolean };

const rules: Rule[] = (await nextConfig.redirects!()) as Rule[];

/** First matching rule, with `:param` tokens substituted — Next's own order. */
function resolve(pathname: string): { destination: string; status: 307 | 308 } | null {
  for (const rule of rules) {
    const hit = match<Record<string, unknown>>(rule.source, { decode: decodeURIComponent })(pathname);
    if (!hit) continue;
    const destination = rule.destination.replace(/:([A-Za-z0-9_]+)\*?/g, (whole, key: string) => {
      const value = hit.params[key];
      if (value == null) return whole;
      return Array.isArray(value) ? value.join("/") : String(value);
    });
    return { destination, status: rule.permanent ? 308 : 307 };
  }
  return null;
}

test("a XF entity ref resolves to the entity's current page", () => {
  // The link shape the old site handed out for a group profile.
  assert.equal(resolve("/groups/PlayTheGame.176/view")?.destination, "/groups/176");
  assert.equal(resolve("/groups/PlayTheGame.176/view")?.status, 308);
  // The ref on its own, and XF's page-N pagination on the action.
  assert.equal(resolve("/groups/PlayTheGame.176")?.destination, "/groups/176");
  assert.equal(resolve("/groups/PlayTheGame.176/view/page-2")?.destination, "/groups/176");
  // A title-less row was addressed by bare id; the same rules cover it.
  assert.equal(resolve("/groups/176/view")?.destination, "/groups/176");

  assert.equal(resolve("/players/Zezima.5")?.destination, "/players/5");
  assert.equal(resolve("/players/Zezima.5/view")?.destination, "/players/5");
  assert.equal(resolve("/players/Zezima.5/drops")?.destination, "/players/5");
  assert.equal(resolve("/players/Zezima.5/top-ranks")?.destination, "/players/5");

  assert.equal(resolve("/npcs/Vorkath.8060/view")?.destination, "/npcs/8060");
  assert.equal(resolve("/npcs/Vorkath.8060/top-players/page-2")?.destination, "/npcs/8060");
  assert.equal(resolve("/items/Twisted-bow.20997/view")?.destination, "/items/20997");

  // The per-boss PB page grew into the full NPC page.
  assert.equal(resolve("/personal_best/Vorkath.8060/view")?.destination, "/npcs/8060");
  assert.equal(resolve("/personal_bests")?.destination, "/personal-bests");
});

test("XF actions land on their current pages", () => {
  for (const from of ["/groups/PlayTheGame.176/config", "/groups/176/config", "/groups/PlayTheGame.176/edit"]) {
    assert.equal(resolve(from)?.destination, "/groups/176/settings", from);
  }
  assert.equal(resolve("/groups/PlayTheGame.176/dashboard")?.destination, "/groups/176/admin");
  assert.equal(resolve("/groups/PlayTheGame.176/member-list")?.destination, "/groups/176/members");
  assert.equal(resolve("/groups/PlayTheGame.176/board-generator")?.destination, "/groups/176/lootboard");
  assert.equal(resolve("/groups/PlayTheGame.176/upgrades")?.destination, "/groups/176/subscription");
  assert.equal(resolve("/groups/PlayTheGame.176/feature-store/activate")?.destination, "/groups/176/subscription");
  assert.equal(resolve("/feature-store/PlayTheGame.176")?.destination, "/groups/176/subscription");
  assert.equal(resolve("/feature-store/176/manage/9")?.destination, "/groups/176/subscription");
  assert.equal(
    resolve("/groups/PlayTheGame.176/points-dashboard/page-2")?.destination,
    "/groups/176/points/leaderboard",
  );
  assert.equal(resolve("/groups/PlayTheGame.176/manual-submission")?.destination, "/submit");
  assert.equal(resolve("/groups/PlayTheGame.176/tooltip")?.destination, "/groups/176");
  assert.equal(resolve("/groups/create/servers")?.destination, "/groups/new");

  // Still 307, for the reason spelled out at the rule: the old permanent 308
  // from /points got cached by browsers.
  const points = resolve("/groups/PlayTheGame.176/points");
  assert.equal(points?.destination, "/groups/176/points/manage");
  assert.equal(points?.status, 307);
});

test("current URLs are left alone", () => {
  for (const path of [
    "/groups/playthegame",
    "/groups/176",
    "/groups/176/settings",
    "/groups/176/members",
    "/groups/176/embeds",
    "/groups/176/subscription",
    "/groups/176/lootboard",
    "/groups/176/points/leaderboard",
    "/groups/176/points/manage",
    "/groups/new",
    "/players/zezima",
    "/players/5",
    "/players/5/recap",
    "/npcs/vorkath",
    "/npcs/8060",
    "/items/twisted-bow",
    "/items/20997",
    "/leaderboards",
    "/personal-bests",
    "/premium",
    "/submit",
    "/settings",
    "/dashboard",
  ]) {
    assert.equal(resolve(path), null, `${path} must not redirect`);
  }
});

test("every legacy shape settles in one hop, and no rule loops", () => {
  // A self-redirect is an infinite loop in the browser; the DB-backed resolver
  // has a guard for it, the static map has none.
  const samples = [
    "/groups/PlayTheGame.176",
    "/groups/PlayTheGame.176/view",
    "/groups/PlayTheGame.176/config",
    "/groups/PlayTheGame.176/upgrades",
    "/players/Zezima.5",
    "/players/Zezima.5/view",
    "/npcs/Vorkath.8060/view",
    "/items/Twisted-bow.20997/view",
    "/feature-store/PlayTheGame.176",
    "/personal_bests",
    "/account/players",
    "/account",
    "/leaderboard",
    "/players",
    "/groups",
  ];
  for (const start of samples) {
    const seen = [start];
    let current = start;
    for (let i = 0; i < 10; i++) {
      const hit = resolve(current);
      if (!hit) break;
      const next = hit.destination.split("?")[0] ?? hit.destination;
      assert.ok(!seen.includes(next), `redirect loop: ${[...seen, next].join(" -> ")}`);
      seen.push(next);
      current = next;
    }
    assert.ok(seen.length <= 2, `${start} should settle in one hop, took: ${seen.join(" -> ")}`);
  }
});
