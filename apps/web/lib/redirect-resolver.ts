/**
 * Admin-configurable redirects — the path-to-regexp matching engine.
 *
 * Split out from `lib/redirects.ts` so that `path-to-regexp` is reached ONLY by
 * the Edge middleware (which bundles it inline) and the admin client bundle —
 * never by `lib/api.ts` or the node server routes, where Next's output-file
 * tracing drops it from shared chunks and the runtime `require` fails.
 *
 * `source` is a path-to-regexp v6 pattern using the same syntax as the static
 * map in `next.config.ts` (e.g. `/players/view/:id(\d+)`). `destination` is an
 * internal path (`/docs`) or an absolute `http(s)://` URL; `:param` tokens
 * captured from the source are substituted in.
 */
import { match, pathToRegexp, type MatchFunction } from "path-to-regexp";
import { isExternalDestination, type RedirectRule } from "./redirects";

/** True when `source` is a syntactically valid path-to-regexp pattern. Used to
 * validate authoring with the *same* engine the middleware resolves with. */
export function isValidSource(source: string): boolean {
  if (!source.startsWith("/")) return false;
  try {
    pathToRegexp(source);
    return true;
  } catch {
    return false;
  }
}

// Compiled matchers are memoized per source string — recompiling on every
// request would be wasteful, and the rule set changes rarely.
const matcherCache = new Map<string, MatchFunction<Record<string, unknown>> | null>();

function getMatcher(source: string): MatchFunction<Record<string, unknown>> | null {
  if (matcherCache.has(source)) return matcherCache.get(source) ?? null;
  let m: MatchFunction<Record<string, unknown>> | null = null;
  try {
    m = match<Record<string, unknown>>(source, { decode: decodeURIComponent });
  } catch {
    m = null; // invalid pattern (shouldn't happen — validated at author time)
  }
  matcherCache.set(source, m);
  return m;
}

/**
 * Substitute `:param` tokens in a destination with captured values.
 *
 * Deliberately a plain token replacement rather than path-to-regexp's
 * `compile()`, so it is safe for BOTH external URLs (the `:` in `https://` is
 * never a valid `:param` token because it is followed by `//`) and internal
 * paths that carry a query string (e.g. `/search?q=:name`, which `compile()`
 * would misparse). Missing captures are left untouched; catch-all arrays are
 * joined with `/`.
 */
function buildDestination(destination: string, params: Record<string, unknown>): string {
  return destination.replace(/:([A-Za-z0-9_]+)/g, (whole, key: string) => {
    const value = params[key];
    if (value == null) return whole;
    if (Array.isArray(value)) return value.map((v) => encodeURIComponent(String(v))).join("/");
    return encodeURIComponent(String(value));
  });
}

export interface ResolvedRedirect {
  destination: string;
  status: 307 | 308;
}

/**
 * Resolve the first matching redirect for `pathname`. Rules are evaluated in
 * `order` (ascending); first match wins.
 *
 * @param pathname incoming path (no query), e.g. `/players/view/42`
 * @param search   incoming query string WITHOUT the leading `?`, e.g. `foo=1`
 */
export function resolveRedirect(
  pathname: string,
  search: string,
  rules: RedirectRule[],
): ResolvedRedirect | null {
  const ordered = [...rules].sort((a, b) => a.order - b.order);

  for (const rule of ordered) {
    const matcher = getMatcher(rule.source);
    if (!matcher) continue;
    const result = matcher(pathname);
    if (!result) continue;

    let destination = buildDestination(rule.destination, result.params);

    // Loop guard: never redirect an internal path to itself.
    if (!isExternalDestination(destination)) {
      const targetPath = destination.split("?")[0];
      if (targetPath === pathname) continue;
    }

    // Forward the incoming query string, merging with any query the
    // destination already carries.
    if (rule.forward_query && search) {
      destination += (destination.includes("?") ? "&" : "?") + search;
    }

    return { destination, status: rule.permanent ? 308 : 307 };
  }

  return null;
}
