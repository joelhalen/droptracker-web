"use client";

/**
 * "Start from a template" — browse saved event templates (public + the
 * clan's own private saves), preview one, and instantiate it as a fresh
 * draft event ("Saving/Rerunning Events"). Rendered as the alternative
 * branch of the event-create flow; the sibling of EventTaskLibraryPicker,
 * one level up.
 *
 * Instantiation is lenient server-side: tasks that no longer validate
 * (renamed items/NPCs) are skipped and reported — when that happens we show
 * the report before navigating so the admin knows what to rebind.
 */

import type { Route } from "next";
import { useEffect, useState, useTransition } from "react";
import type {
  EventTemplateDetail,
  EventTemplateInstantiateResult,
  EventTemplateSummary,
} from "@droptracker/api-types";
import {
  getEventTemplate,
  instantiateEventTemplate,
  searchEventTemplates,
} from "@/app/(admin)/groups/[id]/events/actions";
import { getErrorMessage } from "@/lib/errors";
import { TASK_TYPE_LABELS } from "@/lib/events";
import { Alert } from "@/components/ui";
import { TimezoneNote } from "@/components/local-time";
import Link from "next/link";
import { useRouter } from "next/navigation";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

const toUnix = (v: string): number | null => (v ? Math.floor(new Date(v).getTime() / 1000) : null);

function eventPath(groupId: number | null, eventId: number): Route {
  return (
    groupId == null ? `/admin/events/${eventId}` : `/groups/${groupId}/events/${eventId}`
  ) as Route;
}

export function EventTemplatePicker({ groupId }: { groupId: number | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventTemplateSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected template: summary immediately, detail (preview) fetched lazily.
  const [selected, setSelected] = useState<EventTemplateSummary | null>(null);
  const [detail, setDetail] = useState<EventTemplateDetail | null>(null);

  // Instantiate form.
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [includeTeams, setIncludeTeams] = useState(true);
  const [pending, startTransition] = useTransition();
  // Set when instantiation skipped tasks — show the report before navigating.
  const [created, setCreated] = useState<EventTemplateInstantiateResult | null>(null);

  const doSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearching(true);
    setError(null);
    try {
      setResults(await searchEventTemplates(groupId, { query: query.trim() || undefined }));
    } catch (err) {
      setError(getErrorMessage(err, "Template search failed. Please try again."));
    } finally {
      setSearching(false);
    }
  };

  // List everything up front — the catalogue is small and browsing beats
  // guessing search terms.
  useEffect(() => {
    void doSearch();
  }, []);

  const pick = (tmpl: EventTemplateSummary) => {
    setSelected(tmpl);
    setDetail(null);
    setName(tmpl.name);
    setIncludeTeams(true);
    setCreated(null);
    setError(null);
    getEventTemplate(groupId, tmpl.id)
      .then(setDetail)
      .catch(() => setDetail(null)); // preview is a nicety, not a blocker
  };

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await instantiateEventTemplate(groupId, selected.id, {
          name: name.trim(),
          starts_at: toUnix(startsAt),
          ends_at: toUnix(endsAt),
          include_teams: includeTeams,
        });
        if (res.skipped_tasks.length) {
          setCreated(res); // surface the report; navigate on click
        } else {
          router.push(eventPath(groupId, res.id));
        }
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't create the event. Please try again."));
      }
    });
  };

  if (created) {
    return (
      <div className="space-y-3">
        <Alert variant="info">
          The event was created, but {created.skipped_tasks.length} task
          {created.skipped_tasks.length === 1 ? "" : "s"} from the template no longer validate and
          {created.skipped_tasks.length === 1 ? " was" : " were"} skipped. Their bingo cells (if
          any) are unbound — rebind or replace them in the event manager.
        </Alert>
        <ul className="border-osrs-bronze/20 divide-osrs-bronze/10 divide-y rounded border text-sm">
          {created.skipped_tasks.map((t) => (
            <li key={t.index} className="px-3 py-2">
              <span className="font-medium">{t.label}</span>
              <span className="text-osrs-parchment-dark/60 block text-xs">{t.reason}</span>
            </li>
          ))}
        </ul>
        <Link
          href={eventPath(groupId, created.id)}
          className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold-bright inline-block rounded px-4 py-2 text-sm font-semibold"
        >
          Open the new event →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <form onSubmit={doSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates by name…"
          className={`${field} flex-1`}
        />
        <button
          type="submit"
          disabled={searching}
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {results && (
        <ul className="border-osrs-bronze/20 max-h-72 space-y-0 overflow-y-auto rounded border">
          {results.length ? (
            results.map((tmpl) => (
              <li key={tmpl.id}>
                <button
                  type="button"
                  onClick={() => pick(tmpl)}
                  className={`hover:bg-osrs-bronze/10 block w-full px-3 py-2 text-left text-sm ${
                    selected?.id === tmpl.id ? "bg-osrs-bronze/15" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{tmpl.name}</span>
                    <span
                      className={`rounded border px-1 text-[10px] uppercase ${
                        tmpl.visibility === "private"
                          ? "border-osrs-bronze/40 text-osrs-parchment-dark/70"
                          : "border-osrs-gold/40 text-osrs-gold/90"
                      }`}
                      title={
                        tmpl.visibility === "private"
                          ? "Saved privately — only your clan sees it"
                          : "Shared publicly — any clan can run it"
                      }
                    >
                      {tmpl.visibility}
                    </span>
                    {tmpl.times_used > 0 && (
                      <span className="text-osrs-parchment-dark/50 ml-auto text-xs">
                        used {tmpl.times_used}×
                      </span>
                    )}
                  </span>
                  <span className="text-osrs-parchment-dark/60 block text-xs">
                    {tmpl.task_count} task{tmpl.task_count === 1 ? "" : "s"}
                    {tmpl.has_bingo ? ` · ${tmpl.board_size}×${tmpl.board_size} bingo board` : ""}
                    {tmpl.team_count
                      ? ` · ${tmpl.team_count} team${tmpl.team_count === 1 ? "" : "s"}`
                      : ""}
                    {tmpl.description ? ` — ${tmpl.description}` : ""}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">
              No templates yet. Open a finished event and use “Save as template” to create one.
            </li>
          )}
        </ul>
      )}

      {selected && (
        <form
          onSubmit={onCreate}
          className="border-osrs-bronze/25 bg-osrs-brown-dark/30 grid gap-3 rounded-lg border p-4"
        >
          <h4 className="text-osrs-gold text-sm font-semibold">New event from “{selected.name}”</h4>
          {detail && (
            <div className="text-osrs-parchment-dark/70 space-y-1 text-xs">
              {detail.preview.tasks.length > 0 && (
                <p className="line-clamp-3">
                  <span className="text-osrs-parchment-dark/50">Tasks:</span>{" "}
                  {detail.preview.tasks
                    .map((t) =>
                      t.label
                        ? `${t.label}`
                        : ((TASK_TYPE_LABELS as Record<string, string>)[t.type] ?? t.type),
                    )
                    .join(", ")}
                </p>
              )}
              {detail.preview.teams.length > 0 && (
                <p>
                  <span className="text-osrs-parchment-dark/50">Teams:</span>{" "}
                  {detail.preview.teams.join(", ")}
                </p>
              )}
            </div>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Event name"
            className={field}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Starts</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Ends</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={field}
              />
            </label>
          </div>
          <TimezoneNote className="text-osrs-parchment-dark/60 block text-xs" />
          {selected.team_count > 0 && (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeTeams}
                onChange={(e) => setIncludeTeams(e.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>
                Create the template&apos;s teams ({selected.team_count})
                <span className="text-osrs-parchment-dark/50 block text-xs">
                  Empty teams with the saved names — members always start fresh.
                </span>
              </span>
            </label>
          )}
          <p className="text-osrs-parchment-dark/50 text-xs">
            The new event starts as a draft — tweak anything (tasks, board, teams, Discord) before
            activating it.
          </p>
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark justify-self-start rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create event from template"}
          </button>
        </form>
      )}
    </div>
  );
}
