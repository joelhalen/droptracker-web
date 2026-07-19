"use client";

import { useState, useTransition } from "react";
import type { AdminEventType } from "@droptracker/api-types";
import {
  addEventTypeTestGroup,
  patchEventType,
  removeEventTypeTestGroup,
  searchTestGroups,
} from "@/app/(site)/(admin)/admin/event-types/actions";
import { Alert, Card } from "@/components/ui";

/**
 * Superadmin registry of event formats (web43a): per-kind enabled /
 * staff-only switches plus the test-group allowlist that lets chosen clans
 * beta a restricted kind. One card per kind, seasonal-toggle styling.
 */
export function EventTypesManager({ initial }: { initial: AdminEventType[] }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const applyRow = (row: AdminEventType) =>
    setRows((prev) => prev.map((r) => (r.key === row.key ? row : r)));

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      {rows.map((t) => (
        <TypeCard key={t.key} row={t} onUpdated={applyRow} onError={setError} />
      ))}
      {rows.length === 0 && (
        <Card padding="p-6">
          <p className="text-osrs-parchment-dark/60 text-sm">
            No event types found... nothing to see here.
          </p>
        </Card>
      )}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="text-osrs-parchment block text-sm font-medium">{label}</span>
        <span className="text-osrs-parchment-dark/60 block text-xs">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-osrs-gold" : "bg-osrs-stone/50"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

function TypeCard({
  row,
  onUpdated,
  onError,
}: {
  row: AdminEventType;
  onUpdated: (row: AdminEventType) => void;
  onError: (msg: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: number; name: string }[] | null>(null);

  const patch = (p: { enabled?: boolean; admin_only?: boolean }) => {
    onError(null);
    startTransition(async () => {
      const res = await patchEventType(row.key, p);
      if (res.ok) onUpdated(res.row);
      else onError(res.error);
    });
  };

  const addGroup = (groupId: number) => {
    onError(null);
    setResults(null);
    setQ("");
    startTransition(async () => {
      const res = await addEventTypeTestGroup(row.key, groupId);
      if (res.ok) onUpdated(res.row);
      else onError(res.error);
    });
  };

  const removeGroup = (groupId: number) => {
    onError(null);
    startTransition(async () => {
      const res = await removeEventTypeTestGroup(row.key, groupId);
      if (res.ok) onUpdated(res.row);
      else onError(res.error);
    });
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    startTransition(async () => {
      setResults(await searchTestGroups(trimmed));
    });
  };

  // The allowlist only binds while the kind is restricted.
  const restricted = !row.enabled || row.admin_only;

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold flex-1 rounded border px-3 py-2 text-sm outline-none";

  return (
    <Card padding="p-6">
      <div className="mb-4">
        <h2 className="text-osrs-gold text-lg font-semibold">{row.label}</h2>
        {row.description && (
          <p className="text-osrs-parchment-dark/60 mt-1 text-sm">{row.description}</p>
        )}
      </div>

      <div className="space-y-3">
        <Toggle
          checked={row.enabled}
          disabled={pending}
          onChange={() => patch({ enabled: !row.enabled })}
          label="Enabled"
          hint="Off: nobody outside staff and the test groups below can create this type. Existing events keep running."
        />
        <Toggle
          checked={row.admin_only}
          disabled={pending}
          onChange={() => patch({ admin_only: !row.admin_only })}
          label="Staff testing only"
          hint="On (even while enabled): creation stays limited to superadmins and the test groups below — how a new format ships dark."
        />
      </div>

      <div className={`mt-5 ${restricted ? "" : "opacity-60"}`}>
        <h3 className="text-osrs-parchment text-sm font-semibold">
          Test groups
          <span className="text-osrs-parchment-dark/50 ml-2 text-xs font-normal">
            {restricted
              ? "these clans may create this type despite the restriction"
              : "no effect while the type is enabled for everyone"}
          </span>
        </h3>

        {row.test_groups.length > 0 ? (
          <ul className="border-osrs-bronze/20 divide-osrs-bronze/20 mt-2 divide-y rounded border">
            {row.test_groups.map((g) => (
              <li key={g.group_id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {g.group_name}
                  <span className="text-osrs-parchment-dark/50 ml-2 text-xs">#{g.group_id}</span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeGroup(g.group_id)}
                  className="text-osrs-red/80 hover:text-osrs-red text-xs disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-osrs-parchment-dark/50 mt-2 text-xs">No test groups.</p>
        )}

        <form onSubmit={onSearch} className="mt-2 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add a group (name or ID)…"
            aria-label={`Add test group for ${row.label}`}
            className={field}
          />
          <button
            type="submit"
            disabled={pending || !q.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Find
          </button>
        </form>
        {results && (
          <ul className="border-osrs-bronze/20 divide-osrs-bronze/20 mt-2 divide-y rounded border">
            {results.length === 0 ? (
              <li className="text-osrs-parchment-dark/60 px-3 py-2 text-sm">No groups found.</li>
            ) : (
              results.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => addGroup(g.id)}
                    className="hover:bg-osrs-bronze/10 flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                  >
                    <span>
                      {g.name}
                      <span className="text-osrs-parchment-dark/50 ml-2 text-xs">#{g.id}</span>
                    </span>
                    <span className="text-osrs-gold text-xs">Add</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </Card>
  );
}
