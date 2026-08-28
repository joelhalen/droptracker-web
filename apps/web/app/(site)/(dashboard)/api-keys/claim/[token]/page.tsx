import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";
import { Alert, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Your API key",
  // Never indexed, never previewed: the page renders a credential.
  robots: { index: false, follow: false },
};

// The whole point is that the answer changes after the first request.
export const dynamic = "force-dynamic";

/**
 * Claim a one-time API key link.
 *
 * Lives under `(dashboard)` so its layout requires a session — the link alone
 * is not authorisation, and the backend re-checks the audience regardless.
 * Opening this page *spends* the link, which is why nothing here prefetches
 * and why the route is force-dynamic.
 */
export default async function ClaimApiKeyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Return them to this exact link after signing in — someone clicking the DM
  // while signed out would otherwise land on the dashboard having lost it.
  // Nothing is spent before the session exists: the claim happens below.
  await requireUser(`/api-keys/claim/${token}`);
  const result = await api.claimApiKeyReveal(token);

  if (!result.ok) {
    return (
      <Card>
        <h1 className="text-osrs-gold mb-2 text-xl font-semibold">
          {result.spent ? "This link has already been opened" : "This link isn't available"}
        </h1>
        <p className="text-osrs-parchment-dark/70 text-sm">
          {result.spent
            ? "API keys are shown exactly once, so the link is spent even if you did not manage to copy it. Ask staff for a new one — the old key can be revoked."
            : "It may have expired, already been used, or belong to a different account. If you were expecting a key, check you are signed in as the account it was sent to."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-osrs-gold mb-1 text-xl font-semibold">Your API key</h1>
        <p className="text-osrs-parchment-dark/70 text-sm">
          {result.label ? `“${result.label}” · ` : ""}
          {result.scope === "global"
            ? "reads every group and player"
            : result.group_id
              ? `scoped to group ${result.group_id}`
              : "scoped to your account"}
          {result.tier ? ` · ${result.tier} tier` : ""}
        </p>
      </Card>

      <Alert variant="error">
        This link is now spent and the key is not recoverable. Copy it somewhere safe before
        you leave this page — if you lose it, the key has to be revoked and replaced.
      </Alert>

      <CodeBlock label="API key" code={result.token} />

      <Card>
        <h2 className="text-osrs-gold mb-2 text-sm font-semibold">Using it</h2>
        <CodeBlock
          code={`curl -H "Authorization: Bearer ${result.token}" \\
  "https://api.droptracker.io/v2/meta"`}
        />
        <p className="text-osrs-parchment-dark/70 mt-3 text-sm">
          <code>/v2/meta</code> reports your scope and current limits. The full reference is at{" "}
          <a href="/docs/api" className="text-osrs-gold-bright underline">
            /docs/api
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
