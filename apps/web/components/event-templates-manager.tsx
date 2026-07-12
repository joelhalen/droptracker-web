"use client";

/**
 * "Saved templates" management card for the events index pages — rename,
 * flip public/private, and delete the group's own event templates
 * ("Saving/Rerunning Events"). Creating events FROM templates lives in the
 * create form (EventTemplatePicker); saving one lives in the EventManager
 * header (EventTemplateSaver).
 */

import { useState, useTransition } from "react";
import type { EventTemplateSummary } from "@droptracker/api-types";
import { deleteEventTemplate, updateEventTemplate } from "@/app/(admin)/groups/[id]/events/actions";
import { getErrorMessage } from "@/lib/errors";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-2 py-1 text-sm outline-none";

export function EventTemplatesManager({
  groupId,
  initial,
}: {
  groupId: number | null;
  initial: EventTemplateSummary[];
}) {
  const [templates, setTemplates] = useState(initial);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!templates.length) return null;

  const patch = (id: number, changes: Partial<EventTemplateSummary>) =>
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));

  const onRename = (tmpl: EventTemplateSummary) => {
    const name = renameValue.trim();
    if (!name || name === tmpl.name) {
      setRenamingId(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      const before = tmpl.name;
      patch(tmpl.id, { name }); // optimistic + rollback
      setRenamingId(null);
      try {
        await updateEventTemplate(groupId, tmpl.id, { name });
      } catch (err) {
        patch(tmpl.id, { name: before });
        setError(getErrorMessage(err, "Couldn't rename the template."));
      }
    });
  };

  const onToggleVisibility = (tmpl: EventTemplateSummary) => {
    const next = tmpl.visibility === "public" ? ("private" as const) : ("public" as const);
    setError(null);
    startTransition(async () => {
      const before = tmpl.visibility;
      patch(tmpl.id, { visibility: next });
      try {
        await updateEventTemplate(groupId, tmpl.id, { visibility: next });
      } catch (err) {
        patch(tmpl.id, { visibility: before });
        setError(getErrorMessage(err, "Couldn't change the template's visibility."));
      }
    });
  };

  const onDelete = (tmpl: EventTemplateSummary) => {
    setError(null);
    startTransition(async () => {
      const before = templates;
      setTemplates((prev) => prev.filter((t) => t.id !== tmpl.id));
      setConfirmingDeleteId(null);
      try {
        await deleteEventTemplate(groupId, tmpl.id);
      } catch (err) {
        setTemplates(before);
        setError(getErrorMessage(err, "Couldn't delete the template."));
      }
    });
  };

  return (
    <section>
      <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
        Saved templates
      </h2>
      <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
        Reusable event structures saved from past events. Start one from the “New event” form;
        deleting a template never touches events created from it.
      </p>
      {error && <p className="text-osrs-red mb-2 text-xs">{error}</p>}
      <ul className="divide-osrs-bronze/20 divide-y">
        {templates.map((tmpl) => (
          <li key={tmpl.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            {renamingId === tmpl.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onRename(tmpl);
                }}
                className="flex flex-1 items-center gap-2"
              >
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={120}
                  autoFocus
                  className={`${field} flex-1`}
                />
                <button
                  type="submit"
                  disabled={pending || !renameValue.trim()}
                  className="text-osrs-gold-bright text-xs hover:underline disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="text-osrs-parchment-dark/60 text-xs hover:underline"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{tmpl.name}</span>
                  <span className="text-osrs-parchment-dark/60 block text-xs">
                    {tmpl.task_count} task{tmpl.task_count === 1 ? "" : "s"}
                    {tmpl.has_bingo ? ` · ${tmpl.board_size}×${tmpl.board_size} board` : ""}
                    {tmpl.times_used ? ` · used ${tmpl.times_used}×` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onToggleVisibility(tmpl)}
                  disabled={pending}
                  className={`rounded border px-1.5 py-0.5 text-[10px] uppercase disabled:opacity-50 ${
                    tmpl.visibility === "private"
                      ? "border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-gold"
                      : "border-osrs-gold/40 text-osrs-gold/90 hover:border-osrs-bronze"
                  }`}
                  title={
                    tmpl.visibility === "private"
                      ? "Private — click to share with every clan"
                      : "Public — click to make it clan-only"
                  }
                >
                  {tmpl.visibility}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(tmpl.id);
                    setRenameValue(tmpl.name);
                    setConfirmingDeleteId(null);
                  }}
                  className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs"
                >
                  Rename
                </button>
                {confirmingDeleteId === tmpl.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onDelete(tmpl)}
                      disabled={pending}
                      className="text-osrs-red text-xs font-semibold hover:underline disabled:opacity-50"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      className="text-osrs-parchment-dark/60 text-xs hover:underline"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(tmpl.id)}
                    className="text-osrs-red/70 hover:text-osrs-red text-xs"
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
