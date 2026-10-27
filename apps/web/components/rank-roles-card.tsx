"use client";

/**
 * Clan rank roles (group settings): map the in-game clan ranks WiseOldMan
 * reports to roles in the group's Discord server. The core bot applies the
 * map to every member who has claimed their RSN, and keeps it applied.
 * Rendered as a section of the settings page by the config editor; this is the
 * section body only, and it saves on its own (like the blacklist panel).
 *
 * Row order is rank priority, highest first: WOM reports a rank's name but not
 * where it sits in the clan, so the leader sets the order. Pure shaping lives
 * in lib/rank-roles.ts. Backend: web_api/routes/rank_roles.py.
 */

import { useMemo, useState, useTransition } from "react";
import type { RankRoleMode, RankRoles } from "@droptracker/api-types";
import { Alert, Button, Checkbox, Input, Select } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";
import {
  CREATE_CHOICE,
  applyRoleChoice,
  buildRows,
  fallbackLabel,
  moveRow,
  roleChoice,
  statusSummary,
  toConfig,
  type RankRow,
} from "@/lib/rank-roles";
import {
  loadRankRoles,
  saveRankRoles,
  syncRankRoles,
} from "@/app/(site)/(admin)/groups/[id]/settings/actions";

const MODE_OPTIONS: { value: RankRoleMode; label: string }[] = [
  { value: "single", label: "One role: the role for their rank" },
  { value: "cumulative", label: "Ladder: their rank's role and every rank role below it" },
];

export function RankRolesPanel({
  groupId,
  initial,
}: {
  groupId: number;
  initial: RankRoles | null;
}) {
  const [data, setData] = useState<RankRoles | null>(initial);
  const [enabled, setEnabled] = useState(initial?.config.enabled ?? false);
  const [mode, setMode] = useState<RankRoleMode>(initial?.config.mode ?? "single");
  const [createRoles, setCreateRoles] = useState(initial?.config.create_roles ?? false);
  const [exemptRoleId, setExemptRoleId] = useState(initial?.config.exempt_role_id ?? "");
  const [rows, setRows] = useState<RankRow[]>(initial ? buildRows(initial) : []);
  const [preview, setPreview] = useState<RankRoles["preview"] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const config = useMemo(
    () =>
      toConfig(
        { enabled, mode, create_roles: createRoles, exempt_role_id: exemptRoleId || null },
        rows,
      ),
    [enabled, mode, createRoles, exemptRoleId, rows],
  );

  if (!data) {
    return <Alert>Couldn&apos;t load rank roles. Refresh the page to try again.</Alert>;
  }

  const roles = data.roles;
  const status = statusSummary(data.status);
  const turningOn = enabled && !data.config.enabled;

  function reset(next: RankRoles) {
    setData(next);
    setEnabled(next.config.enabled);
    setMode(next.config.mode);
    setCreateRoles(next.config.create_roles);
    setExemptRoleId(next.config.exempt_role_id ?? "");
    setRows(buildRows(next));
  }

  function edit(fn: () => void) {
    fn();
    setPreview(null);
    setConfirming(false);
    setMessage(null);
  }

  function updateRow(index: number, patch: (row: RankRow) => RankRow) {
    edit(() => setRows((prev) => prev.map((r, i) => (i === index ? patch(r) : r))));
  }

  function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(getErrorMessage(err, fallback));
      }
    });
  }

  function onPreview() {
    run(async () => {
      const result = await saveRankRoles(groupId, config, true);
      setPreview(result.preview);
    }, "Couldn't preview the changes.");
  }

  function onSave() {
    // Turning the sync on shows who gets what first, then asks to confirm.
    if (turningOn && !confirming) {
      run(async () => {
        const result = await saveRankRoles(groupId, config, true);
        setPreview(result.preview);
        setConfirming(true);
      }, "Couldn't preview the changes.");
      return;
    }
    run(async () => {
      const result = await saveRankRoles(groupId, config);
      reset(result);
      setPreview(null);
      setConfirming(false);
      setMessage(
        result.config.enabled
          ? "Saved. The bot will update roles within a minute or two."
          : "Saved. Rank roles are off, and the bot leaves members' roles as they are.",
      );
    }, "Couldn't save rank roles.");
  }

  function onSyncNow() {
    run(async () => {
      await syncRankRoles(groupId);
      setMessage("The bot will run a full sync within a minute.");
    }, "Couldn't start a sync.");
  }

  function onRefresh() {
    run(async () => {
      const next = await loadRankRoles(groupId);
      setData(next);
    }, "Couldn't refresh.");
  }

  const blockers: string[] = [];
  if (!data.guild_linked) blockers.push("Link a Discord server to this group first.");
  if (!data.wom_linked) blockers.push("Link a WiseOldMan group first. Clan ranks come from it.");
  if (data.conflict) {
    blockers.push(
      `${data.conflict.group_name || "Another group"} already syncs rank roles in this Discord server. Only one group per server can.`,
    );
  }

  return (
    <div className="space-y-5">
      {blockers.length > 0 && (
        <Alert variant="info">
          {blockers.map((b) => (
            <span key={b} className="block">
              {b}
            </span>
          ))}
        </Alert>
      )}

      {data.config.enabled && (
        <div className="border-osrs-bronze/15 bg-osrs-surface-2/50 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="block font-medium">
                Last sync{" "}
                <span className="text-osrs-parchment-dark/60 font-normal">
                  {data.status ? formatRelativeTime(data.status.at) : "not yet"}
                </span>
              </span>
              <span
                className={`mt-0.5 block text-xs ${
                  status.tone === "ok"
                    ? "text-osrs-parchment-dark/70"
                    : status.tone === "warn"
                      ? "text-osrs-gold"
                      : "text-osrs-red"
                }`}
              >
                {status.text}
              </span>
              {data.status?.problems.map((p, i) => (
                <span key={i} className="text-osrs-gold mt-0.5 block text-xs">
                  {p.rank ? `${rows.find((r) => r.rank === p.rank)?.label ?? p.rank}: ` : ""}
                  {p.reason}
                </span>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={pending}
              onClick={onSyncNow}
            >
              Sync now
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SwitchRow
          label="Sync rank roles"
          help="Give members the Discord role for their clan rank, and keep it matched as ranks change."
          value={enabled}
          onChange={(v) => edit(() => setEnabled(v))}
        />
        <SwitchRow
          label="Create missing roles"
          help="Let the bot create a role for a rank you set to “Create a new role”. New roles have no permissions."
          value={createRoles}
          onChange={(v) => edit(() => setCreateRoles(v))}
        />
        <label className="block">
          <span className="block text-sm font-medium">Roles per member</span>
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">
            A ladder lets you lock channels to a rank and everyone above it.
          </span>
          <Select
            value={mode}
            onChange={(e) => edit(() => setMode(e.target.value as RankRoleMode))}
          >
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium">Exempt role</span>
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">
            Members with this role are left alone, so staff can hand out rank roles themselves.
          </span>
          <Select
            value={exemptRoleId}
            onChange={(e) => edit(() => setExemptRoleId(e.target.value))}
          >
            <option value="">None</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <p className="text-osrs-parchment-dark/60 text-xs">
        Ranks come from your WiseOldMan group, which updates when someone syncs it from the
        WiseOldMan plugin in game. Only members who have claimed their RSN can get a role:{" "}
        <span className="text-osrs-parchment">
          {data.roster.linked} of {data.roster.members}
        </span>{" "}
        accounts have. A member with several accounts gets the role for their highest rank. Roles
        you don&apos;t map here are never touched.
      </p>

      {!data.has_rank_data && data.wom_linked && (
        <Alert variant="info">
          No clan ranks from WiseOldMan yet. They arrive with the hourly member sync once your
          WiseOldMan group has been synced in game.
        </Alert>
      )}
      {data.roles_stale && (
        <Alert variant="info">
          The bot is still loading your server&apos;s roles.{" "}
          <button
            type="button"
            className="text-osrs-gold underline"
            onClick={onRefresh}
            disabled={pending}
          >
            Refresh
          </button>
        </Alert>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Ranks, highest first</span>
          <span className="text-osrs-parchment-dark/50 text-xs">
            Use the arrows to match your clan&apos;s order
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="text-osrs-parchment-dark/60 text-sm">No ranks yet.</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((row, i) => (
              <RankRowEditor
                key={row.rank}
                row={row}
                index={i}
                count={rows.length}
                roles={roles}
                createRoles={createRoles}
                fallback={fallbackLabel(rows, i)}
                previewCount={preview ? (preview.by_rank[row.rank] ?? null) : null}
                graceDays={data.limits.delete_grace_days}
                maxName={data.limits.max_role_name}
                onMove={(delta) => edit(() => setRows((prev) => moveRow(prev, i, delta)))}
                onChange={(patch) => updateRow(i, patch)}
              />
            ))}
          </ol>
        )}
      </div>

      {preview && (
        <Alert variant="info">
          {preview.with_role} of {preview.linked} linked members would get a rank role. The counts
          next to each rank show how many.
          {confirming && " Press Confirm to turn the sync on."}
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" type="button" disabled={pending} onClick={onPreview}>
          Preview
        </Button>
        <Button size="sm" type="button" disabled={pending} onClick={onSave}>
          {pending ? "Working…" : confirming ? "Confirm and turn on" : "Save rank roles"}
        </Button>
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="border-osrs-bronze/15 hover:border-osrs-gold/40 bg-osrs-surface-2/50 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-osrs-parchment-dark/60 mt-0.5 block text-xs">{help}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? "bg-osrs-gold" : "bg-osrs-stone/50"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function RankRowEditor({
  row,
  index,
  count,
  roles,
  createRoles,
  fallback,
  previewCount,
  graceDays,
  maxName,
  onMove,
  onChange,
}: {
  row: RankRow;
  index: number;
  count: number;
  roles: RankRoles["roles"];
  createRoles: boolean;
  fallback: string | null;
  previewCount: number | null;
  graceDays: number;
  maxName: number;
  onMove: (delta: -1 | 1) => void;
  onChange: (patch: (row: RankRow) => RankRow) => void;
}) {
  const choice = roleChoice(row);
  const creating = choice === CREATE_CHOICE;
  const canDelete = row.created || creating;
  return (
    <li className="border-osrs-bronze/15 bg-osrs-surface-2/40 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            aria-label={`Move ${row.label} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold px-1 text-xs leading-none disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={`Move ${row.label} down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold px-1 text-xs leading-none disabled:opacity-30"
          >
            ▼
          </button>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {row.icon_url ? (
            <img src={row.icon_url} alt="" width={18} height={18} className="shrink-0" />
          ) : (
            <span className="inline-block size-[18px] shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{row.label}</span>
            <span className="text-osrs-parchment-dark/50 block text-xs">
              {row.members} in clan, {row.linked_members} linked
              {previewCount !== null && (
                <span className="text-osrs-gold">, {previewCount} would get this role</span>
              )}
            </span>
          </span>
        </div>
        <div className="w-full sm:w-64">
          <Select
            aria-label={`Role for ${row.label}`}
            value={choice}
            onChange={(e) => onChange((r) => applyRoleChoice(r, e.target.value))}
          >
            <option value="">{fallback ? `No role (use ${fallback}'s)` : "No role"}</option>
            {(createRoles || creating) && <option value={CREATE_CHOICE}>Create a new role</option>}
            {roles.map((r) => (
              <option key={r.id} value={r.id} disabled={Boolean(r.blocked)}>
                {r.name}
                {r.blocked ? ` (can't sync: ${r.blocked})` : ""}
              </option>
            ))}
            {row.role_id && !roles.some((r) => r.id === row.role_id) && (
              <option value={row.role_id}>Unknown role {row.role_id}</option>
            )}
          </Select>
        </div>
      </div>
      {(creating || canDelete) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 pl-7">
          {creating && (
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs">
              <span className="text-osrs-parchment-dark/60 shrink-0">Role name</span>
              <Input
                value={row.name}
                maxLength={maxName}
                onChange={(e) => {
                  const name = e.target.value;
                  onChange((r) => ({ ...r, name }));
                }}
              />
            </label>
          )}
          {canDelete && (
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={row.delete_when_empty}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange((r) => ({ ...r, delete_when_empty: checked }));
                }}
              />
              <span>Delete the role after {graceDays} days with no members</span>
            </label>
          )}
        </div>
      )}
    </li>
  );
}
