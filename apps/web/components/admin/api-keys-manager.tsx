"use client";

import { useMemo, useState, useTransition } from "react";
import type { ApiKey, ApiKeyTier, ApiUsageWindow } from "@droptracker/api-types";
import {
  deleteApiKeyTier,
  mintApiKey,
  putApiKeyTier,
  updateApiKey,
} from "@/app/(site)/(admin)/admin/api-keys/actions";
import { Alert, Card } from "@/components/ui";

/**
 * Staff surface for the external Data API (v2).
 *
 * Three things live here because they are one workflow, not three: you look at
 * what a key is spending, decide whether it has earned more room, and grant it
 * — either by moving it to a richer tier or by overriding one limit on that key
 * alone. Splitting them across pages would mean holding a key id in your head
 * between screens.
 *
 * Tier limits apply to every key on that tier the moment they are saved; the
 * data API resolves them per request and caches nothing.
 */

const LIMIT_FIELDS = [
  { key: "requests_per_min", label: "Requests / min" },
  { key: "cost_units_per_min", label: "Cost units / min" },
  { key: "requests_per_day", label: "Requests / day" },
  { key: "max_concurrency", label: "Concurrent" },
] as const;

type LimitField = (typeof LIMIT_FIELDS)[number]["key"];

function num(value: number | undefined | null): string {
  return value == null ? "—" : value.toLocaleString();
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ApiKeysManager({
  initialKeys,
  initialTiers,
  usage,
}: {
  initialKeys: ApiKey[];
  initialTiers: ApiKeyTier[];
  usage: ApiUsageWindow;
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [tiers, setTiers] = useState(initialTiers);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Shown once, in the page, immediately after minting — the API never returns
  // it again and there is nowhere else it could be recovered from.
  const [freshToken, setFreshToken] = useState<{ id: number; token: string } | null>(null);

  const usageByKey = useMemo(
    () => new Map(usage.keys.map((u) => [u.key_id, u])),
    [usage.keys],
  );

  function run<T>(action: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>,
                  onOk: (value: T) => void) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.ok) onOk(result.value);
      else setError(result.error);
    });
  }

  function replaceKey(updated: ApiKey) {
    setKeys((all) => all.map((k) => (k.id === updated.id ? { ...updated } : k)));
  }

  return (
    <div className="space-y-8">
      {error && <Alert variant="error">{error}</Alert>}

      {freshToken && (
        <Card>
          <h2 className="text-osrs-gold mb-2 font-semibold">
            Key #{freshToken.id} created — copy it now
          </h2>
          <p className="text-osrs-parchment-dark/70 mb-3 text-sm">
            This is the only time the token is shown. Only its hash is stored, so if it is lost
            the key has to be revoked and replaced.
          </p>
          <code className="block overflow-x-auto rounded border border-white/10 bg-black/60 px-3 py-2 text-sm text-emerald-100">
            {freshToken.token}
          </code>
          <button
            type="button"
            onClick={() => setFreshToken(null)}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright mt-3 text-xs underline"
          >
            I&apos;ve stored it — hide
          </button>
        </Card>
      )}

      <MintForm
        tiers={tiers}
        pending={pending}
        onMint={(input) =>
          run(
            () => mintApiKey(input),
            (key) => {
              setKeys((all) => [key, ...all]);
              if (key.token) setFreshToken({ id: key.id, token: key.token });
            },
          )
        }
      />

      <UsagePanel usage={usage} />

      <section>
        <h2 className="text-osrs-gold mb-1 text-lg font-semibold">Keys</h2>
        <p className="text-osrs-parchment-dark/70 mb-3 text-sm">
          Promote a key by moving it to another tier. Override a single limit only when a
          consumer needs a shape no tier describes — blank means &ldquo;use the tier&rdquo;.
        </p>
        {keys.length === 0 ? (
          <Card>
            <p className="text-osrs-parchment-dark/70 text-sm">
              No keys yet. Mint one above, or from the box with{" "}
              <code>scripts/mint_api_key.py</code>.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <KeyCard
                key={key.id}
                apiKey={key}
                tiers={tiers}
                usage={usageByKey.get(key.id)}
                pending={pending}
                onChange={(input) => run(() => updateApiKey(key.id, input), replaceKey)}
              />
            ))}
          </div>
        )}
      </section>

      <TierEditor
        tiers={tiers}
        pending={pending}
        onSave={(tierKey, input) =>
          run(
            () => putApiKeyTier(tierKey, input),
            (tier) =>
              setTiers((all) => {
                const next = all.some((t) => t.tier_key === tier.tier_key)
                  ? all.map((t) => (t.tier_key === tier.tier_key ? tier : t))
                  : [...all, tier];
                return next.sort((a, b) => a.sort_order - b.sort_order);
              }),
          )
        }
        onDelete={(tierKey) =>
          run(
            () => deleteApiKeyTier(tierKey),
            () => setTiers((all) => all.filter((t) => t.tier_key !== tierKey)),
          )
        }
      />
    </div>
  );
}

function MintForm({
  tiers,
  pending,
  onMint,
}: {
  tiers: ApiKeyTier[];
  pending: boolean;
  onMint: (input: {
    owner_user_id?: number | null;
    group_id?: number | null;
    scope?: "user" | "group" | "global";
    label?: string;
    tier?: string;
  }) => void;
}) {
  const [ownerKind, setOwnerKind] = useState<"group" | "user" | "global">("group");
  const [ownerId, setOwnerId] = useState("");
  const [label, setLabel] = useState("");
  const [tier, setTier] = useState(tiers[0]?.tier_key ?? "standard");

  const id = Number(ownerId);
  // A global key has no owner, so there is no id to validate.
  const valid =
    ownerKind === "global" || (ownerId.trim() !== "" && Number.isInteger(id) && id >= 0);

  return (
    <Card>
      <h2 className="text-osrs-gold mb-1 text-lg font-semibold">Create a key</h2>
      <p className="text-osrs-parchment-dark/70 mb-4 text-sm">
        Self-serve minting is disabled site-wide, so this and the CLI are the only ways a key
        comes into existence. A key created here works immediately.
      </p>
      {ownerKind === "global" && (
        <div className="mb-3">
          <Alert variant="info">
            A global key reads <strong>every group and every player</strong> — for a
            third-party site tying into our data. It still cannot see players who hid
            themselves, or whose account owner is hidden; those stay invisible exactly as
            they are on the website.
          </Alert>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Owner</span>
          <select
            value={ownerKind}
            onChange={(e) => setOwnerKind(e.target.value as "group" | "user" | "global")}
            className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5"
          >
            <option value="group">Group</option>
            <option value="user">User</option>
            <option value="global">Global — all data</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">
            {ownerKind === "global" ? "Owner" : ownerKind === "group" ? "Group id" : "User id"}
          </span>
          <input
            value={ownerKind === "global" ? "" : ownerId}
            disabled={ownerKind === "global"}
            onChange={(e) => setOwnerId(e.target.value)}
            inputMode="numeric"
            placeholder={ownerKind === "global" ? "none — reads everything" : "e.g. 275"}
            className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 disabled:opacity-50"
          />
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What is it for?"
            className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block">Tier</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5"
          >
            {tiers.map((t) => (
              <option key={t.tier_key} value={t.tier_key}>
                {t.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        disabled={!valid || pending}
        onClick={() =>
          onMint(
            ownerKind === "global"
              ? { scope: "global", label: label.trim(), tier }
              : {
                  scope: ownerKind,
                  [ownerKind === "group" ? "group_id" : "owner_user_id"]: id,
                  label: label.trim(),
                  tier,
                },
          )
        }
        className="bg-osrs-bronze/40 hover:bg-osrs-bronze/60 mt-4 rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40"
      >
        {pending ? "Working…" : "Create key"}
      </button>
    </Card>
  );
}

function KeyCard({
  apiKey,
  tiers,
  usage,
  pending,
  onChange,
}: {
  apiKey: ApiKey;
  tiers: ApiKeyTier[];
  usage?: ApiUsageWindow["keys"][number];
  pending: boolean;
  onChange: (input: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const tone =
    apiKey.state === "active"
      ? "text-emerald-300"
      : apiKey.state === "revoked"
        ? "text-red-300"
        : "text-amber-300";

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <code className="text-osrs-gold text-sm">{apiKey.display}</code>
          <span className="text-osrs-parchment-dark/70 ml-2 text-sm">
            {apiKey.label || <em>no label</em>}
          </span>
        </div>
        <div className="text-osrs-parchment-dark/60 flex items-center gap-3 text-xs">
          <span className={tone}>{apiKey.state}</span>
          <span className={apiKey.scope === "global" ? "text-amber-300" : undefined}>
            {apiKey.scope === "global"
              ? "GLOBAL — all data"
              : apiKey.scope === "group"
                ? `group ${apiKey.group_id}`
                : `user ${apiKey.owner_user_id}`}
          </span>
          <span>used {ago(apiKey.last_used_at)}</span>
        </div>
      </div>

      {usage && (
        <div className="text-osrs-parchment-dark/70 mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span>{num(usage.requests)} requests</span>
          <span>{num(usage.cost)} cost</span>
          <span>avg {usage.avg_ms ?? "—"}ms</span>
          <span>peak {num(usage.max_ms)}ms</span>
          {usage.errors > 0 && <span className="text-amber-300">{usage.errors} errors</span>}
          {usage.limited > 0 && (
            <span className="text-amber-300">{usage.limited} rate-limited</span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="text-osrs-parchment-dark/70 mr-2">Tier</span>
          <select
            value={apiKey.tier}
            disabled={pending}
            onChange={(e) => onChange({ tier: e.target.value })}
            className="rounded border border-white/15 bg-black/30 px-2 py-1"
          >
            {tiers.map((t) => (
              <option key={t.tier_key} value={t.tier_key}>
                {t.display_name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs underline"
        >
          {open ? "Hide overrides" : "Overrides"}
          {Object.keys(apiKey.overrides).length > 0 && " •"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => onChange({ revoked: apiKey.state !== "revoked" })}
          className="ml-auto rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
        >
          {apiKey.state === "revoked" ? "Un-revoke" : "Revoke"}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-4">
          {LIMIT_FIELDS.map((field) => (
            <OverrideInput
              key={field.key}
              label={field.label}
              value={apiKey.overrides[field.key as LimitField]}
              placeholder={String(
                tiers.find((t) => t.tier_key === apiKey.tier)?.[field.key as LimitField] ?? "",
              )}
              pending={pending}
              onCommit={(value) => onChange({ [field.key]: value })}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function OverrideInput({
  label,
  value,
  placeholder,
  pending,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  pending: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));

  return (
    <label className="text-sm">
      <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">{label}</span>
      <input
        value={text}
        disabled={pending}
        inputMode="numeric"
        // Blank commits null, which clears the override and returns the key to
        // its tier — that is the only way back, so it must be reachable.
        placeholder={placeholder ? `tier: ${Number(placeholder).toLocaleString()}` : ""}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const trimmed = text.trim();
          if (trimmed === "") {
            if (value != null) onCommit(null);
            return;
          }
          const parsed = Number(trimmed);
          if (Number.isInteger(parsed) && parsed > 0 && parsed !== value) onCommit(parsed);
        }}
        className="w-full rounded border border-white/15 bg-black/30 px-2 py-1"
      />
    </label>
  );
}

function TierEditor({
  tiers,
  pending,
  onSave,
  onDelete,
}: {
  tiers: ApiKeyTier[];
  pending: boolean;
  onSave: (tierKey: string, input: Record<string, unknown>) => void;
  onDelete: (tierKey: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <section>
      <h2 className="text-osrs-gold mb-1 text-lg font-semibold">Tiers</h2>
      <p className="text-osrs-parchment-dark/70 mb-3 text-sm">
        A tier&apos;s limits apply to every key on it the moment they are saved. Cost units are
        the real budget — one unit is roughly 0.05&nbsp;ms of server work per player, so a
        100-player page of every section costs about 34,400.
      </p>
      <div className="space-y-3">
        {tiers.map((tier) => (
          <Card key={tier.tier_key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-osrs-gold font-semibold">{tier.display_name}</span>
                <code className="text-osrs-parchment-dark/60 ml-2 text-xs">{tier.tier_key}</code>
                {!tier.enabled && (
                  <span className="ml-2 text-xs text-amber-300">disabled</span>
                )}
              </div>
              <span className="text-osrs-parchment-dark/60 text-xs">
                {num(tier.active_keys)} active key{tier.active_keys === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {LIMIT_FIELDS.map((field) => (
                <label key={field.key} className="text-sm">
                  <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                    {field.label}
                  </span>
                  <input
                    defaultValue={tier[field.key as LimitField]}
                    disabled={pending}
                    inputMode="numeric"
                    onBlur={(e) => {
                      const parsed = Number(e.target.value.trim());
                      if (
                        Number.isInteger(parsed) &&
                        parsed > 0 &&
                        parsed !== tier[field.key as LimitField]
                      ) {
                        onSave(tier.tier_key, { [field.key]: parsed });
                      }
                    }}
                    className="w-full rounded border border-white/15 bg-black/30 px-2 py-1"
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => onSave(tier.tier_key, { enabled: !tier.enabled })}
                className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
              >
                {tier.enabled ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                disabled={pending || (tier.active_keys ?? 0) > 0}
                title={
                  (tier.active_keys ?? 0) > 0
                    ? "Move its keys to another tier first — a key whose tier vanished drops to the hard floor."
                    : undefined
                }
                onClick={() => onDelete(tier.tier_key)}
                className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </Card>
        ))}

        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                New tier key
              </span>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. trusted"
                className="rounded border border-white/15 bg-black/30 px-2 py-1"
              />
            </label>
            <button
              type="button"
              disabled={pending || !/^[a-z][a-z0-9_]{1,31}$/.test(draft)}
              onClick={() => {
                // A new tier needs every limit, so seed it from the entry tier
                // and let it be edited down — an empty tier cannot be saved.
                const base = tiers[0];
                onSave(draft, {
                  display_name: draft,
                  requests_per_min: base?.requests_per_min ?? 60,
                  cost_units_per_min: base?.cost_units_per_min ?? 200_000,
                  requests_per_day: base?.requests_per_day ?? 10_000,
                  max_concurrency: base?.max_concurrency ?? 4,
                  sort_order: tiers.length,
                });
                setDraft("");
              }}
              className="bg-osrs-bronze/40 hover:bg-osrs-bronze/60 rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              Add tier
            </button>
            <span className="text-osrs-parchment-dark/50 text-xs">
              Lowercase letters, digits and underscores. Starts from the entry tier&apos;s
              limits.
            </span>
          </div>
        </Card>
      </div>
    </section>
  );
}

function UsagePanel({ usage }: { usage: ApiUsageWindow }) {
  if (!usage.available) {
    return (
      <Alert variant="info">
        Usage metering is unavailable (Redis unreachable). Keys still work — only these counters
        are missing, so an empty table here does not mean nobody is calling.
      </Alert>
    );
  }
  const totals = usage.totals ?? {};
  const endpoints = Object.entries(usage.endpoints ?? {}).slice(0, 6);

  return (
    <section>
      <h2 className="text-osrs-gold mb-1 text-lg font-semibold">
        Usage — last {usage.hours}h
      </h2>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Requests", totals.requests],
          ["Cost units", totals.cost],
          ["Avg latency", totals.avg_ms],
          ["Rate-limited", totals.limited],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <div className="text-osrs-parchment-dark/60 text-xs">{label}</div>
            <div className="text-osrs-gold text-xl font-semibold tabular-nums">
              {num(typeof value === "number" ? value : undefined)}
              {label === "Avg latency" && typeof value === "number" ? "ms" : ""}
            </div>
          </Card>
        ))}
      </div>
      {endpoints.length > 0 && (
        <p className="text-osrs-parchment-dark/60 mt-2 text-xs">
          Busiest:{" "}
          {endpoints.map(([name, count], i) => (
            <span key={name}>
              {i > 0 && ", "}
              <code>{name}</code> {num(count)}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
