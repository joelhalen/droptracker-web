"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { GuildStatus, WomGroupPreview } from "@droptracker/api-types";
import { checkGuild, createGroup, lookupWom } from "@/app/(admin)/groups/new/actions";

type Step = 1 | 2 | 3;

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";
const btn =
  "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50";

export function GroupWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [womId, setWomId] = useState("");
  const [guildId, setGuildId] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [wom, setWom] = useState<WomGroupPreview | null>(null);
  const [guild, setGuild] = useState<GuildStatus | null>(null);

  const onLookupWom = () =>
    startTransition(async () => {
      setError(null);
      const preview = await lookupWom(Number(womId));
      setWom(preview);
      if (!name) setName(preview.name);
      if (preview.already_registered) {
        setError("This WOM group is already registered with DropTracker.");
      } else {
        setStep(2);
      }
    });

  const onCheckGuild = () =>
    startTransition(async () => {
      setError(null);
      const status = await checkGuild(guildId);
      setGuild(status);
      if (!status.bot_present) {
        setError("The DropTracker bot is not in that server. Invite it, then retry.");
      } else if (status.owns_group) {
        setError("That server already owns a group.");
      } else {
        setStep(3);
      }
    });

  const onCreate = () =>
    startTransition(async () => {
      setError(null);
      const res = await createGroup({
        name,
        wom_id: Number(womId),
        guild_id: guildId,
        discord_url: discordUrl,
      });
      router.push(`/groups/${res.id}/admin`);
    });

  return (
    <div className="space-y-6">
      <ol className="flex gap-2 text-xs">
        {(["WOM group", "Discord server", "Confirm"] as const).map((label, i) => (
          <li
            key={label}
            className={`rounded px-2 py-1 ${
              step === i + 1
                ? "bg-osrs-bronze text-osrs-parchment"
                : step > i + 1
                  ? "text-osrs-green"
                  : "text-osrs-parchment-dark/50"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && <p className="text-osrs-red text-sm">{error}</p>}

      {step === 1 && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Wise Old Man group ID</span>
            <input
              value={womId}
              onChange={(e) => setWomId(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 1234"
              inputMode="numeric"
              className={field}
            />
          </label>
          {wom && (
            <p className="text-osrs-parchment-dark/70 text-sm">
              Found <strong>{wom.name}</strong> · {wom.member_count} members
            </p>
          )}
          <button onClick={onLookupWom} disabled={pending || !womId} className={btn}>
            {pending ? "Looking up…" : "Look up"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Discord server (guild) ID</span>
            <input
              value={guildId}
              onChange={(e) => setGuildId(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 207526562331885568"
              inputMode="numeric"
              className={field}
            />
          </label>
          {guild?.bot_present && (
            <p className="text-osrs-green text-sm">Bot is present in this server. ✓</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="text-osrs-parchment-dark/70 text-sm">
              ← Back
            </button>
            <button onClick={onCheckGuild} disabled={pending || !guildId} className={btn}>
              {pending ? "Checking…" : "Check server"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Group name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Discord invite URL (optional)</span>
            <input
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.gg/…"
              className={field}
            />
          </label>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="text-osrs-parchment-dark/70 text-sm">
              ← Back
            </button>
            <button onClick={onCreate} disabled={pending || !name} className={btn}>
              {pending ? "Creating…" : "Create group"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
