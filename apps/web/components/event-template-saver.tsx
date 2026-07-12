"use client";

/**
 * "Save as template" — snapshot an event's structure (config, tasks, bingo
 * layout, team names) as a reusable template, shared publicly or kept for
 * the clan ("Saving/Rerunning Events"). Inline expandable panel, rendered in
 * the EventManager header. Re-saving under the same name updates the
 * existing template (task-library upsert semantics).
 */

import { useState, useTransition } from "react";
import { saveEventTemplate } from "@/app/(admin)/groups/[id]/events/actions";
import { getErrorMessage } from "@/lib/errors";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

export function EventTemplateSaver({
  groupId,
  eventId,
  eventName,
}: {
  groupId: number | null;
  eventId: number;
  eventName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(eventName);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [includeTeams, setIncludeTeams] = useState(true);
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveEventTemplate(groupId, eventId, {
          name: name.trim(),
          description: description.trim() || undefined,
          visibility,
          include_teams: includeTeams,
        });
        setSavedAs(name.trim());
        setOpen(false);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the template. Please try again."));
      }
    });
  };

  if (!open) {
    return (
      <span className="flex items-center gap-2">
        {savedAs && (
          <span className="text-osrs-gold-bright/80 text-xs" role="status">
            Saved as “{savedAs}” ✓
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setSavedAs(null);
            setOpen(true);
          }}
          className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm"
          title="Save this event's structure (tasks, board, team names) to reuse or share"
        >
          Save as template
        </button>
      </span>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="border-osrs-bronze/25 bg-osrs-brown-dark/30 grid w-full gap-3 rounded-lg border p-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-osrs-gold text-sm font-semibold">Save as template</h4>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
        >
          Close
        </button>
      </div>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Saves the event&apos;s structure — settings, tasks, bingo board and team names — so it can
        be rerun later or shared. Dates, rosters, scores and Discord settings are never saved.
      </p>
      {error && <p className="text-osrs-red text-xs">{error}</p>}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        placeholder="Template name"
        className={field}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Description (optional — shown in the template picker)"
        className={field}
      />
      <div className="grid gap-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="template-visibility"
            checked={visibility === "private"}
            onChange={() => setVisibility("private")}
            className="mt-0.5"
          />
          <span>
            Private — save for {groupId == null ? "site staff" : "this clan"} only
            <span className="text-osrs-parchment-dark/50 block text-xs">
              Only {groupId == null ? "superadmins" : "your clan's admins"} see it in the picker.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="template-visibility"
            checked={visibility === "public"}
            onChange={() => setVisibility("public")}
            className="mt-0.5"
          />
          <span>
            Public — any clan can run it
            <span className="text-osrs-parchment-dark/50 block text-xs">
              Appears in every clan&apos;s template picker.
            </span>
          </span>
        </label>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeTeams}
          onChange={(e) => setIncludeTeams(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span>
          Include team names
          <span className="text-osrs-parchment-dark/50 block text-xs">
            Team names only — members are never saved.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save template"}
        </button>
        <span className="text-osrs-parchment-dark/50 text-xs">
          Re-saving with the same name updates the existing template.
        </span>
      </div>
    </form>
  );
}
