import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";
import { ScrollPanel } from "@/components/scroll-panel";
import {
  API_BASE,
  BUDGETS,
  ENDPOINTS,
  ERRORS,
  requestCost,
  sectionsByCategory,
} from "@/lib/api-reference";

export const metadata: Metadata = {
  title: "Data API",
  description:
    "Read DropTracker player and group data from your own app: authentication, rate limits, endpoints and the full section catalogue.",
};

// Repo-versioned rather than CMS-authored, for the same reason as /privacy: it
// documents code, so it should change in the same review as the code does.

const CONTENTS = [
  { href: "#quickstart", label: "Quickstart" },
  { href: "#auth", label: "Authentication" },
  { href: "#limits", label: "Rate limits" },
  { href: "#cost", label: "How requests are priced" },
  { href: "#endpoints", label: "Endpoints" },
  { href: "#sections", label: "Sections" },
  { href: "#paging", label: "Paging a roster" },
  { href: "#errors", label: "Errors" },
  { href: "#notes", label: "Notes on the data" },
];

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="ink-heading ink-rule mb-3 mt-10 border-b pb-1 text-xl font-semibold">
      {children}
    </h2>
  );
}

export default function DataApiPage() {
  // Worked from the same arithmetic the server uses, so the numbers quoted in
  // the prose cannot drift from the cost table above them.
  const cheapPage = requestCost(["identity", "loot"], 100);
  const everythingPage = requestCost(
    sectionsByCategory().flatMap((g) => g.sections.map((s) => s.key)),
    100,
  );

  return (
    <ScrollPanel>
      <header className="mb-6">
        <h1 className="ink-heading text-2xl font-bold sm:text-3xl">Data API</h1>
        <p className="ink-muted mt-2">
          Read your clan&apos;s DropTracker data from your own app — stats, collection logs, combat
          achievements, personal bests, loot and more. Everything here needs an API key, and keys
          are free.
        </p>
      </header>

      <nav aria-label="On this page" className="ink-rule mb-8 rounded-md border p-4">
        <div className="ink-muted mb-2 text-xs font-semibold uppercase tracking-wide">
          On this page
        </div>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {CONTENTS.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="ink-link">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Heading id="quickstart">Quickstart</Heading>
      <ol className="ink-muted mb-4 list-decimal space-y-2 pl-5 text-sm">
        <li>
          Create a key. Group admins make one from their group settings; individual supporters can
          make one from account settings.
        </li>
        <li>Copy it when it is shown — it is displayed once and cannot be retrieved again.</li>
        <li>Send it as a bearer token on every request.</li>
      </ol>
      <CodeBlock
        label="Your first call"
        code={`export DT_API_KEY="dtk_12_your_key_here"

curl -H "Authorization: Bearer $DT_API_KEY" \\
  "${API_BASE}/meta"`}
      />
      <p className="ink-muted mt-3 text-sm">
        That returns your key&apos;s scope and its current limits. Once it works, ask for some real
        data:
      </p>
      <CodeBlock
        code={`curl -H "Authorization: Bearer $DT_API_KEY" \\
  "${API_BASE}/players/Crawlicious?include=identity,stats,loot"`}
      />

      <Heading id="auth">Authentication</Heading>
      <p className="ink-muted text-sm">
        Every endpoint except <code>/v2/health</code> needs a key, sent as{" "}
        <code>Authorization: Bearer dtk_…</code>. There is no query-parameter form — a key in a URL
        ends up in server logs, browser history and <code>Referer</code> headers, so the header is
        the only way in.
      </p>
      <p className="ink-muted mt-3 text-sm">
        A key sees exactly what its owner could see on the website and nothing more. A{" "}
        <strong>group key</strong> reads that group&apos;s members; a <strong>user key</strong>{" "}
        reads the accounts that user has claimed. A player who is hidden — or whose account owner is
        hidden — is invisible here just as they are on the site.
      </p>
      <p className="ink-muted mt-3 text-sm">
        Missing, malformed, unknown, revoked and expired keys all return the same{" "}
        <code>401</code>. That is deliberate: the id inside a token must not become a way to find
        out which keys exist.
      </p>

      <Heading id="limits">Rate limits</Heading>
      <p className="ink-muted text-sm">
        Limits belong to the <em>key</em>, not to any subscription. Every key starts on the same
        entry tier, including keys owned by premium groups. Higher tiers are granted by staff once a
        consumer&apos;s traffic has proven well-behaved — so build something that works first, then
        ask for more room.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="ink-rule ink-heading border-b">
              <th className="py-2 pr-4 font-semibold">Budget</th>
              <th className="py-2 font-semibold">What it caps</th>
            </tr>
          </thead>
          <tbody className="ink-muted">
            {BUDGETS.map((budget) => (
              <tr key={budget.name} className="ink-rule border-b last:border-0">
                <td className="py-2 pr-4 align-top">
                  <code>{budget.name}</code>
                </td>
                <td className="py-2 align-top">{budget.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ink-muted mt-4 text-sm">
        Read your own limits from <code>GET /v2/meta</code> at runtime rather than hardcoding them;
        they change when a key is promoted. Every response also carries them as headers:
      </p>
      <CodeBlock
        code={`X-RateLimit-Limit            60
X-RateLimit-Remaining        59
X-RateLimit-Reset            1787837280
X-RateLimit-Cost             34400
X-RateLimit-Cost-Limit       200000
X-RateLimit-Cost-Remaining   165600`}
      />
      <p className="ink-muted mt-3 text-sm">
        Going over any budget returns <code>429</code> with <code>Retry-After</code> and a{" "}
        <code>limit</code> field naming which one you hit.
      </p>

      <Heading id="cost">How requests are priced</Heading>
      <p className="ink-muted text-sm">
        Not all requests are equal. One player&apos;s loot total is a single cached lookup; a
        hundred players&apos; full collection logs is hundreds of thousands of rows. So instead of
        counting requests alone, we price them:
      </p>
      <CodeBlock code={`cost = number of players x sum of the cost of each requested section`} />
      <p className="ink-muted mt-3 text-sm">
        The cost is charged <strong>before</strong> the query runs, so an over-budget request is
        refused rather than executed and billed afterwards. That is what stops one integration
        slowing the service down for everyone — including you.
      </p>
      <div className="ink-rule mt-4 rounded-md border p-4">
        <div className="ink-heading mb-2 text-sm font-semibold">Worked examples</div>
        <ul className="ink-muted space-y-1.5 text-sm">
          <li>
            One player, <code>include=identity,loot</code> → costs{" "}
            <strong>{requestCost(["identity", "loot"], 1)}</strong>.
          </li>
          <li>
            A 100-player page of <code>identity,loot</code> → costs <strong>{cheapPage}</strong>.
          </li>
          <li>
            A 100-player page of <code>all</code> → costs{" "}
            <strong>{everythingPage.toLocaleString()}</strong>.
          </li>
          <li>
            <strong>A whole 400-member roster, every section</strong> — four pages — costs{" "}
            <strong>{(everythingPage * 4).toLocaleString()}</strong>, which fits inside one minute
            on the entry tier with room to spare. Measured end to end: about 10 seconds and 1.1 MB
            of compressed JSON.
          </li>
        </ul>
      </div>
      <p className="ink-muted mt-4 text-sm">
        The prices are measured, not estimated — one unit is roughly 0.05 ms of server work per
        player. That is why the spread is so wide: <code>clog_slots</code> genuinely costs 161x
        what <code>loot</code> does, and pricing them closer together would mean cheap requests
        subsidising expensive ones.
      </p>

      <Heading id="endpoints">Endpoints</Heading>
      <p className="ink-muted mb-4 text-sm">
        Base URL: <code>{API_BASE}</code>
      </p>
      <div className="space-y-5">
        {ENDPOINTS.map((endpoint) => (
          <article key={endpoint.path} className="ink-rule rounded-md border p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="rounded bg-emerald-900/30 px-2 py-0.5 text-xs font-bold tracking-wide text-emerald-900">
                {endpoint.method}
              </span>
              <code className="ink-heading text-sm font-semibold">{endpoint.path}</code>
              {!endpoint.auth && (
                <span className="ink-muted text-xs italic">no key required</span>
              )}
            </div>
            <div className="ink-heading mt-2 text-sm font-semibold">{endpoint.title}</div>
            <p className="ink-muted mt-1 text-sm">{endpoint.summary}</p>

            {endpoint.params && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="ink-rule ink-heading border-b">
                      <th className="py-1.5 pr-4 font-semibold">Parameter</th>
                      <th className="py-1.5 pr-4 font-semibold">Default</th>
                      <th className="py-1.5 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="ink-muted">
                    {endpoint.params.map((param) => (
                      <tr key={param.name} className="ink-rule border-b last:border-0">
                        <td className="py-1.5 pr-4 align-top">
                          <code>{param.name}</code>
                        </td>
                        <td className="py-1.5 pr-4 align-top">
                          {param.default ? <code>{param.default}</code> : "—"}
                        </td>
                        <td className="py-1.5 align-top">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {endpoint.example && (
              <div className="mt-3">
                <CodeBlock code={endpoint.example} />
              </div>
            )}
          </article>
        ))}
      </div>

      <Heading id="sections">Sections</Heading>
      <p className="ink-muted text-sm">
        <code>?include=</code> takes a comma-separated list, or <code>all</code>. Ask for a section
        that does not exist and you get a <code>400</code> naming it — rather than a response
        quietly missing the data you wanted. If one section fails while the others succeed, it comes
        back as <code>{'{"error": "unavailable"}'}</code> and the rest of the response is still
        served.
      </p>
      <p className="ink-muted mt-3 text-sm">
        This table is documentation; <code>GET /v2/sections</code> is the authoritative list for
        whatever version is running.
      </p>
      {sectionsByCategory().map((group) => (
        <section key={group.category} className="mt-5">
          <h3 className="ink-heading mb-2 text-sm font-semibold uppercase tracking-wide">
            {group.category}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="ink-rule ink-heading border-b">
                  <th className="py-1.5 pr-4 font-semibold">Section</th>
                  <th className="py-1.5 pr-4 font-semibold">Cost</th>
                  <th className="py-1.5 font-semibold">Contains</th>
                </tr>
              </thead>
              <tbody className="ink-muted">
                {group.sections.map((section) => (
                  <tr key={section.key} className="ink-rule border-b last:border-0">
                    <td className="py-1.5 pr-4 align-top">
                      <code>{section.key}</code>
                    </td>
                    <td className="py-1.5 pr-4 align-top tabular-nums">{section.cost}</td>
                    <td className="py-1.5 align-top">{section.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <div className="ink-rule mt-6 rounded-md border p-4">
        <div className="ink-heading mb-2 text-sm font-semibold">
          The shape of <code>clog_slots</code>
        </div>
        <p className="ink-muted text-sm">
          Most collection log slots have a quantity of 1, so repeating that for every slot would
          triple the response for no information. Slots come back as a sorted id array plus a
          sparse map of the quantities that are <em>not</em> 1:
        </p>
        <div className="mt-3">
          <CodeBlock
            code={`"clog_slots": {
  "items": [995, 1149, 11802, 22981],
  "quantities": { "995": 40, "22981": 3 }
}
// 1149 and 11802 are absent from "quantities", so both are 1.`}
          />
        </div>
      </div>

      <Heading id="paging">Paging a roster</Heading>
      <p className="ink-muted text-sm">
        Group listings page by cursor, not by offset — a deep offset makes the database walk and
        throw away every row it skips, so page 50 would cost fifty pages of work. Pass the{" "}
        <code>next_cursor</code> from each response back as <code>cursor</code>. It is{" "}
        <code>null</code> on the last page.
      </p>
      <CodeBlock
        label="Walking a whole roster"
        code={`cursor=""
while : ; do
  page=$(curl -s -H "Authorization: Bearer $DT_API_KEY" \\
    "${API_BASE}/groups/19/players?include=identity,loot&limit=100&cursor=$cursor")
  echo "$page" | jq -c '.players[]'
  cursor=$(echo "$page" | jq -r '.next_cursor // empty')
  [ -z "$cursor" ] && break
done`}
      />

      <Heading id="errors">Errors</Heading>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="ink-rule ink-heading border-b">
              <th className="py-2 pr-4 font-semibold">Status</th>
              <th className="py-2 pr-4 font-semibold">Meaning</th>
              <th className="py-2 font-semibold">What to do</th>
            </tr>
          </thead>
          <tbody className="ink-muted">
            {ERRORS.map((error) => (
              <tr key={error.status} className="ink-rule border-b last:border-0">
                <td className="py-2 pr-4 align-top">
                  <code>{error.status}</code>
                </td>
                <td className="py-2 pr-4 align-top">{error.meaning}</td>
                <td className="py-2 align-top">{error.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Heading id="notes">Notes on the data</Heading>
      <ul className="ink-muted list-disc space-y-2 pl-5 text-sm">
        <li>
          Loot totals come from the same source as the site&apos;s leaderboards, so the two can
          never disagree.
        </li>
        <li>
          <code>loot_npcs</code> and <code>loot_items</code> are served from hourly rollups. They
          aggregate whole hours, so a drop from a few minutes ago may not appear immediately.
        </li>
        <li>
          Collection log <code>obtained</code> and <code>total</code> come from the game&apos;s own
          counter, which knows about slots we hold no row for. <code>tracked_items</code> is our row
          count and will usually be lower — that is expected, not a discrepancy.
        </li>
        <li>Timestamps are UTC, ISO-8601.</li>
        <li>
          A collection log slot&apos;s first-seen date is when <em>we</em> recorded it, never when
          the player obtained it.
        </li>
      </ul>

      <footer className="ink-rule mt-10 border-t pt-4">
        <p className="ink-muted text-sm">
          Need a higher tier, or think something here is wrong?{" "}
          <Link href="/docs" className="ink-link">
            Browse the rest of the docs
          </Link>{" "}
          or open a support ticket from your dashboard.
        </p>
      </footer>
    </ScrollPanel>
  );
}
