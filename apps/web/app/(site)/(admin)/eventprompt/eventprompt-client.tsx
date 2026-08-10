"use client";

/**
 * AI event-task generator (temporary superadmin tool).
 *
 * Describe a task → a headless Claude session builds an EventTaskInput → the
 * result hydrates the ordinary EventTaskForm (draft mode) for full manual
 * editing → saving stores it as a task-library preset, reusable from every
 * event's library picker.
 */
import { useState, useTransition } from "react";
import type { EventTask, EventTaskInput } from "@droptracker/api-types";
import { EventTaskForm } from "@/components/event-task-form";
import { Alert, Card, fieldInputClass } from "@/components/ui";
import { createTaskPreset } from "../admin/task-library/actions";
import { generateEventTask, type GeneratedTask } from "./actions";

/** Draft input dressed up as an EventTask so the form hydrates from it (the
 * id is never used in draft mode) — same trick as the bingo cell editor. */
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

const EXAMPLES = [
  "A full set of Justiciar from ToB, or any ToB weapon",
  "500 Zulrah kill count as a team",
  "10m GP worth of loot from Vorkath",
  "Any 3 unique drops from the Chambers of Xeric",
];

export function EventPromptClient() {
  const [description, setDescription] = useState("");
  const [generation, setGeneration] = useState<GeneratedTask | null>(null);
  const [genCount, setGenCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [generating, startGenerating] = useTransition();
  const [saving, startSaving] = useTransition();

  const generate = () => {
    setError(null);
    setSavedId(null);
    startGenerating(async () => {
      const res = await generateEventTask(description);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGeneration(res);
      setGenCount((n) => n + 1);
    });
  };

  const saveDraft = (input: EventTaskInput) => {
    setError(null);
    startSaving(async () => {
      const res = await createTaskPreset({
        name: input.label.slice(0, 120),
        description: description.trim().slice(0, 2000) || null,
        type: input.type,
        target: input.target ?? null,
        target_value: input.target_value ?? null,
        default_points: input.points ?? 0,
        difficulty: input.difficulty ?? null,
        config: input.config ?? null,
        visibility: input.visibility,
      });
      if ("error" in res) {
        setError(res.error ?? "Couldn't save the preset.");
        return;
      }
      setSavedId(res.item.id);
    });
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-heading text-osrs-gold text-2xl">AI task generator</h1>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Describe an event task in plain English; a locked-down Claude session turns it into a
          ready-to-edit task. Review every field — especially item names — before saving. Saved
          tasks land in the site task library, so any event can pull them in.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <label className="text-osrs-parchment-dark/80 text-sm font-medium" htmlFor="task-desc">
          Task description
        </label>
        <textarea
          id="task-desc"
          className={`${fieldInputClass} min-h-24 w-full resize-y`}
          maxLength={1000}
          placeholder={`e.g. "${EXAMPLES[0]}"`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={generating}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={generate}
            disabled={generating || description.trim().length < 5}
          >
            {generating
              ? "Generating… (can take up to a minute)"
              : generation
                ? "Regenerate"
                : "Generate task"}
          </button>
          <span className="text-osrs-parchment-dark/50 text-xs">
            Examples:{" "}
            {EXAMPLES.map((ex, i) => (
              <button
                key={ex}
                type="button"
                className="hover:text-osrs-gold underline decoration-dotted"
                onClick={() => setDescription(ex)}
              >
                {i + 1}
              </button>
            ))}
          </span>
        </div>
        {error ? <Alert>{error}</Alert> : null}
      </Card>

      {generation ? (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="font-heading text-osrs-gold text-lg">Generated task</h2>
            {generation.notes ? (
              <p className="text-osrs-parchment-dark/70 mt-1 text-sm whitespace-pre-wrap">
                {generation.notes}
              </p>
            ) : null}
          </div>

          {generation.unresolvedItems.length || generation.unresolvedNpcs.length ? (
            <Alert>
              These names aren&apos;t in the game database — fix them below before saving:{" "}
              {[...generation.unresolvedItems, ...generation.unresolvedNpcs].join(", ")}
            </Alert>
          ) : (
            <Alert variant="success">Every item/NPC name matched the game database.</Alert>
          )}

          {savedId != null ? (
            <Alert variant="success">
              Saved to the task library (#{savedId}).{" "}
              <a className="underline" href="/admin/task-library">
                Open the task library
              </a>{" "}
              or generate another task.
            </Alert>
          ) : (
            <EventTaskForm
              key={genCount}
              groupId={null}
              eventId={0}
              initial={taskFromDraft(generation.input)}
              onDraftSubmit={saveDraft}
              submitLabel={saving ? "Saving…" : "Save to task library"}
            />
          )}

          <details className="text-xs">
            <summary className="text-osrs-parchment-dark/50 cursor-pointer">
              Raw generated JSON
            </summary>
            <pre className="bg-osrs-surface-2 mt-2 overflow-x-auto rounded p-3">
              {JSON.stringify(generation.input, null, 2)}
            </pre>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
