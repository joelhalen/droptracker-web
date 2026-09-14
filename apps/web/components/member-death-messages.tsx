"use client";

/**
 * "Your death message" on /settings: what a member's clans see when they die.
 *
 * One list of up to five messages per linked account; the bot picks one per
 * death, in every group that turned on members' own death messages. The same
 * messages are editable with /settings in Discord and in the RuneLite plugin.
 * Rows validate as they are typed against the same rules the backend enforces
 * (`memberDeathMessagesIssue`), and each account lists its groups with whether
 * the message posts there — otherwise a member who saves a message in a clan
 * that has the feature off is left wondering why nothing changed.
 */
import { useState, useTransition } from "react";
import {
  normalizeMemberDeathMessages,
  memberDeathMessagesIssue,
  type MyDeathMessages,
  type MyDeathMessagesPlayer,
} from "@droptracker/api-types";
import { saveMyDeathMessages } from "@/app/(site)/(dashboard)/settings/actions";
import { formatInline } from "@/components/components-v2-preview";
import { Alert, Badge, Button, Input, Select } from "@/components/ui";
import { SUGGESTED_DEATH_MESSAGES } from "@/lib/death-placeholders";
import { getErrorMessage } from "@/lib/errors";
import {
  deathMessagesChanged,
  groupPostingState,
  previewDeathMessage,
} from "@/lib/member-death-messages";

export function MemberDeathMessages({ initial }: { initial: MyDeathMessages }) {
  const [data, setData] = useState(initial);
  const [selectedId, setSelectedId] = useState<number | null>(initial.players[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<number, string[]>>({});
  const [focusIndex, setFocusIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const player = data.players.find((p) => p.id === selectedId) ?? data.players[0];
  const rows = player ? (drafts[player.id] ?? player.messages) : [];
  // Cheap enough to run every render; the rows are at most five short lines.
  const issue = memberDeathMessagesIssue(rows);

  if (!player) return null;

  const setRows = (next: string[]) => {
    setSaved(false);
    setError(null);
    setDrafts((d) => ({ ...d, [player.id]: next }));
  };

  const dirty = deathMessagesChanged(rows, player.messages);
  const atLimit = rows.length >= data.max_messages;
  const previewSource = rows[Math.min(focusIndex, rows.length - 1)] ?? "";

  const insertToken = (token: string) => {
    if (rows.length === 0) {
      setRows([token]);
      setFocusIndex(0);
      return;
    }
    const index = Math.min(focusIndex, rows.length - 1);
    const current = rows[index] ?? "";
    const spaced = current && !current.endsWith(" ") ? `${current} ${token}` : `${current}${token}`;
    setRows(rows.map((row, i) => (i === index ? spaced : row)));
  };

  const addSuggestions = () => {
    const existing = new Set(rows.map((r) => r.trim()));
    const fresh = SUGGESTED_DEATH_MESSAGES.filter(
      (m) => !existing.has(m) && memberDeathMessagesIssue([m]) === null,
    );
    setRows([...rows.filter((r) => r.trim()), ...fresh].slice(0, data.max_messages));
  };

  const save = () => {
    if (issue) {
      setError(issue);
      return;
    }
    const messages = normalizeMemberDeathMessages(rows);
    startTransition(async () => {
      try {
        const result = await saveMyDeathMessages(player.id, messages);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setData(result.data);
        setDrafts((d) => {
          const next = { ...d };
          delete next[player.id];
          return next;
        });
        setFocusIndex(0);
        setSaved(true);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save your death messages. Please try again."));
      }
    });
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
          Your death message
        </h2>
        <p className="text-osrs-parchment-dark/70 text-sm">
          Write what your clan sees when you die. One of your messages is picked at random for each
          death, in every clan whose leaders let members write their own. You can also edit these
          with <code>/settings</code> in Discord, or in the RuneLite plugin.
        </p>
      </div>

      {data.players.length > 1 && (
        <label className="block max-w-xs">
          <span className="text-osrs-parchment-dark/80 mb-1 block text-xs">Account</span>
          <Select
            value={player.id}
            onChange={(e) => {
              setSelectedId(Number(e.target.value));
              setFocusIndex(0);
              setError(null);
              setSaved(false);
            }}
            disabled={pending}
          >
            {data.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {drafts[p.id] && deathMessagesChanged(drafts[p.id]!, p.messages) ? " (unsaved)" : ""}
              </option>
            ))}
          </Select>
        </label>
      )}

      <GroupStatus player={player} />

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="text"
              value={row}
              maxLength={data.max_length}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? e.target.value : r)))}
              onFocus={() => setFocusIndex(i)}
              disabled={pending}
              className="w-full"
              placeholder="{player_name} forgot to pray against {killer}"
              aria-label={`Death message ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => {
                setRows(rows.filter((_, j) => j !== i));
                setFocusIndex((f) => Math.max(0, Math.min(f, rows.length - 2)));
              }}
              disabled={pending}
              className="text-osrs-parchment-dark/60 hover:text-osrs-parchment shrink-0 px-1 text-sm disabled:cursor-not-allowed"
              aria-label={`Remove message ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-osrs-parchment-dark/60 text-xs italic">
            No messages yet — your clans post their own death message for you.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => {
            setRows([...rows, ""]);
            setFocusIndex(rows.length);
          }}
          disabled={pending || atLimit}
        >
          + Add message
        </Button>
        {rows.length < data.max_messages && (
          <Button type="button" variant="ghost" size="xs" onClick={addSuggestions} disabled={pending}>
            Add suggested messages
          </Button>
        )}
        <span className="text-osrs-parchment-dark/60 text-xs">
          Up to {data.max_messages} messages, {data.max_length} characters each. No links or
          mentions.
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.tokens.map((t) => (
          <button
            key={t.token}
            type="button"
            onClick={() => insertToken(t.token)}
            disabled={pending || (rows.length === 0 && atLimit)}
            title={`${t.help} — e.g. ${t.sample}`}
            className="border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:text-osrs-parchment hover:border-osrs-bronze/60 rounded border px-1.5 py-0.5 font-mono text-[11px] disabled:cursor-not-allowed"
          >
            {t.token}
          </button>
        ))}
      </div>
      <p className="text-osrs-parchment-dark/60 text-xs">
        A message that names something the bot doesn&apos;t know for a death — say {"{killer}"} when
        nothing attacked you — is skipped for that death.
      </p>

      {previewSource.trim() !== "" && !issue && (
        <div>
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">
            Example, with sample values
          </span>
          <div className="rounded-lg bg-[#313338] px-4 py-3 font-sans text-sm text-[#dbdee1]">
            {formatInline(previewDeathMessage(previewSource, data.tokens, player.name), "mdm")}
          </div>
        </div>
      )}

      {issue && rows.some((r) => r.trim()) && <Alert variant="error">{issue}</Alert>}
      {error && !issue && <Alert variant="error">{error}</Alert>}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending || !dirty || issue !== null}>
          {pending ? "Saving…" : "Save messages"}
        </Button>
        {dirty && !pending && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDrafts((d) => {
                const next = { ...d };
                delete next[player.id];
                return next;
              });
              setError(null);
            }}
          >
            Discard changes
          </Button>
        )}
        {saved && !dirty && <span className="text-osrs-green text-sm">Saved.</span>}
      </div>
    </section>
  );
}

/** Where this account's message is posted, and why not everywhere. */
function GroupStatus({ player }: { player: MyDeathMessagesPlayer }) {
  if (player.groups.length === 0) {
    return (
      <p className="text-osrs-parchment-dark/60 text-xs">
        {player.name} isn&apos;t in any clans on DropTracker yet.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-osrs-parchment-dark/70 mr-1 text-xs">Posted in:</span>
      {player.groups.map((group) => {
        const state = groupPostingState(group);
        if (state === "posting") {
          return (
            <Badge key={group.id} variant="green" title="This clan posts members' own death messages.">
              {group.name}
            </Badge>
          );
        }
        if (state === "blocked") {
          return (
            <Badge
              key={group.id}
              variant="red"
              title="This clan's leaders have blocked your own messages; it uses its own death message."
            >
              {group.name} · blocked
            </Badge>
          );
        }
        return (
          <Badge
            key={group.id}
            variant="neutral"
            title="This clan hasn't turned on members' own death messages, so it uses its own."
          >
            {group.name} · off
          </Badge>
        );
      })}
    </div>
  );
}
