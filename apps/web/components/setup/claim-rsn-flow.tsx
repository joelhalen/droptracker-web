"use client";

/**
 * Shared RSN claim flow — the ONE implementation rendered by the site
 * (dashboard card, /register) and the Discord Activity (home/me cards).
 * Transport and navigation are injected via ports.ts; see the rules there.
 *
 * Mirrors the Discord /claim-rsn constraints: a player must already exist
 * (created by plugin submissions), claimed accounts are refused with ticket
 * guidance, and a successful claim can attach the player to the launch
 * guild's group (Activity) exactly like running the command in that server.
 */
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import type { ClaimPreview, ClaimResult, ClaimRsnClient, SetupEnv } from "./ports";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";
const primaryBtn =
  "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50";

const PLUGIN_URL = "https://www.droptracker.io/runelite";
const DISCORD_URL = "https://www.droptracker.io/discord";

export function ClaimRsnFlow({
  client,
  env,
  guildId = null,
  onClaimed,
  compact = false,
}: {
  client: ClaimRsnClient;
  env: SetupEnv;
  /** Discord guild context (Activity launch guild) — the backend attaches the
   * claimed player to that guild's group, like /claim-rsn run in-server. */
  guildId?: string | null;
  onClaimed?: (result: ClaimResult) => void;
  /** Tighter spacing for inline cards (dashboard / activity panels). */
  compact?: boolean;
}) {
  const [rsn, setRsn] = useState("");
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Drop stale debounced responses (the player-add-input sequence trick).
  const seq = useRef(0);

  useEffect(() => {
    const name = rsn.trim();
    setResult(null);
    setError(null);
    if (name.length < 1) {
      setPreview(null);
      setChecking(false);
      return;
    }
    const mySeq = ++seq.current;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const p = await client.preview(name, guildId ?? undefined);
        if (seq.current === mySeq) setPreview(p);
      } catch {
        // Preview is best-effort feedback; the claim itself still validates.
        if (seq.current === mySeq) setPreview(null);
      } finally {
        if (seq.current === mySeq) setChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rsn, guildId]);

  const onClaim = async () => {
    const name = rsn.trim();
    if (!name || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      const res = await client.claim({ rsn: name, guild_id: guildId ?? undefined });
      setResult(res);
      if (res.status === "claimed") {
        setPreview(null);
        onClaimed?.(res);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't claim that account. Please try again."));
    } finally {
      setClaiming(false);
    }
  };

  // A completed claim replaces the form with the outcome.
  if (result?.status === "claimed") {
    return (
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <Alert variant="success">
          <span>
            <strong>{result.player?.name}</strong> is now linked to your account.
            {result.group ? (
              <>
                {" "}
                You&apos;ve also been added to <strong>{result.group.name}</strong>.
              </>
            ) : null}
          </span>
        </Alert>
      </div>
    );
  }

  const status = result?.status ?? preview?.status ?? null;
  const shownName = preview?.player?.name ?? rsn.trim();

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">RuneScape name</span>
        <input
          value={rsn}
          onChange={(e) => setRsn(e.target.value)}
          placeholder="Exactly as it appears in-game"
          maxLength={12}
          className={field}
        />
      </label>

      {checking && <p className="text-osrs-parchment-dark/60 text-xs">Checking…</p>}

      {!checking && status === "not_found" && (
        <Alert variant="info">
          <span>
            We haven&apos;t tracked <strong>{rsn.trim()}</strong> yet. Install the{" "}
            <button
              type="button"
              className="text-osrs-gold-bright underline"
              onClick={() => env.openLink(PLUGIN_URL)}
            >
              DropTracker RuneLite plugin
            </button>{" "}
            and receive some loot in-game — then come back and claim it.
          </span>
        </Alert>
      )}

      {!checking && status === "claimed_by_other" && (
        <Alert variant="error">
          <span>
            <strong>{shownName}</strong> is already claimed by another Discord account. If this is
            your account,{" "}
            <button
              type="button"
              className="text-osrs-gold-bright underline"
              onClick={() => env.openLink(DISCORD_URL)}
            >
              open a support ticket in our Discord
            </button>{" "}
            and we&apos;ll sort it out.
          </span>
        </Alert>
      )}

      {!checking && status === "already_yours" && (
        <Alert variant="success">
          <span>
            <strong>{shownName}</strong> is already linked to your account.
          </span>
        </Alert>
      )}

      {!checking && status === "claimable" && preview && (
        <p className="text-osrs-green text-sm">
          Found <strong>{preview.player?.name}</strong> — unclaimed and ready to link.
          {preview.group ? (
            <>
              {" "}
              Claiming also joins you to <strong>{preview.group.name}</strong>.
            </>
          ) : null}
        </p>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <button
        onClick={onClaim}
        disabled={claiming || checking || !rsn.trim() || (status !== null && status !== "claimable")}
        className={primaryBtn}
      >
        {claiming ? "Claiming…" : "Claim this RSN"}
      </button>
    </div>
  );
}
