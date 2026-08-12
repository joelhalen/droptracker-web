"use client";

/**
 * EventTaskForm + the "try describing a task instead" panel.
 *
 * Drop-in replacement for a bare <EventTaskForm> anywhere in the builder: it
 * renders the same form with an optional collapsible describe-box above it.
 * Describing a task generates a draft, which pre-fills the form for review —
 * nothing is saved until the admin submits the form themselves, so a wrong
 * guess costs a click, not a bad task.
 *
 * The form hydrates `initial` only as useState initialisers (mount-only), so
 * a generation swaps it in by bumping `formKey` to force a remount. That is
 * also why the panel lives here rather than inside EventTaskForm: a component
 * cannot remount itself.
 *
 * The panel hides itself entirely when the group's tier has no allowance, so
 * tiers without the feature see exactly the form they see today.
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import type { EventTask, EventTaskInput } from "@droptracker/api-types";
import { EventTaskForm } from "@/components/event-task-form";
import { Alert } from "@/components/ui";
import {
  fetchAiTaskQuota,
  generateTaskFromDescription,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

type Props = React.ComponentProps<typeof EventTaskForm>;

/** Draft input dressed up as an EventTask so the form hydrates from it (the
 * id is never used — the form is in create/draft mode either way). */
function taskFromDraft(input: EventTaskInput): EventTask {
  return {
    id: -1,
    ...input,
    target: input.target ?? null,
    target_value: input.target_value ?? null,
    points: input.points ?? 0,
    requires_confirmation: input.requires_confirmation ?? false,
    visibility: input.visibility ?? "public",
    difficulty: input.difficulty ?? null,
    config: input.config ?? null,
  };
}

const PLACEHOLDER = 'e.g. "a full set of Justiciar from ToB, or any ToB weapon"';

export function EventTaskFormWithAi(props: Props) {
  const { groupId, initial } = props;
  // Editing an existing task keeps the plain form: regenerating over someone's
  // saved task would quietly discard their configuration.
  const editable = initial == null;

  const [quota, setQuota] = useState<{ limit: number; remaining: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [generated, setGenerated] = useState<EventTask | null>(null);
  const [notes, setNotes] = useState("");
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, startGenerating] = useTransition();

  useEffect(() => {
    if (!editable) return;
    let live = true;
    fetchAiTaskQuota(groupId)
      .then((q) => {
        if (live) setQuota({ limit: q.limit, remaining: q.remaining });
      })
      .catch(() => {
        // Quota unknown → leave the panel hidden rather than offering a
        // button that will fail.
      });
    return () => {
      live = false;
    };
  }, [groupId, editable]);

  const generate = useCallback(() => {
    setError(null);
    startGenerating(async () => {
      const res = await generateTaskFromDescription(groupId, description);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGenerated(taskFromDraft(res.input));
      setNotes(res.notes);
      setUnresolved([...res.unresolvedItems, ...res.unresolvedNpcs]);
      setFormKey((n) => n + 1);
      if (res.quota) setQuota({ limit: res.quota.limit, remaining: res.quota.remaining });
    });
  }, [groupId, description]);

  const offered = editable && quota != null && quota.limit > 0;

  return (
    <div className="space-y-3">
      {offered ? (
        <div className="border-osrs-bronze/30 bg-osrs-brown-dark/20 rounded-lg border">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-osrs-parchment-dark/80 hover:text-osrs-gold flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
          >
            <span>✨ Try describing a task instead</span>
            <span className="text-osrs-parchment-dark/50 text-xs">
              {quota.remaining} of {quota.limit} left today {open ? "▲" : "▼"}
            </span>
          </button>

          {open ? (
            <div className="space-y-3 px-3 pb-3">
              <p className="text-osrs-parchment-dark/60 text-xs">
                Describe what players need to do and we&apos;ll build the task for you. Check the
                result — especially item names — before adding it.
              </p>
              <textarea
                className="border-osrs-bronze/40 bg-osrs-surface-2 focus:border-osrs-gold focus:ring-osrs-gold/20 min-h-20 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2"
                maxLength={1000}
                placeholder={PLACEHOLDER}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending || quota.remaining <= 0}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={generate}
                  disabled={pending || description.trim().length < 5 || quota.remaining <= 0}
                  className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {pending ? "Generating…" : generated ? "Regenerate" : "Generate task"}
                </button>
                {quota.remaining <= 0 ? (
                  <span className="text-osrs-parchment-dark/60 text-xs">
                    No generations left today — the form below still works as normal.
                  </span>
                ) : null}
              </div>

              {error ? <Alert>{error}</Alert> : null}
              {notes && !error ? (
                <p className="text-osrs-parchment-dark/70 text-xs whitespace-pre-wrap">{notes}</p>
              ) : null}
              {unresolved.length ? (
                <Alert>
                  These names aren&apos;t in the game database — fix them below before adding:{" "}
                  {unresolved.join(", ")}
                </Alert>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <EventTaskForm {...props} key={formKey} initial={generated ?? initial} />
    </div>
  );
}
