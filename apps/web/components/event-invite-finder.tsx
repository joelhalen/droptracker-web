"use client";

import { useState, useTransition } from "react";
import type { EventInviteCandidate } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Button, Checkbox, Input, Select } from "@/components/ui";
import {
  bulkInviteEventParticipants,
  fetchEventInviteCandidates,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

type Sort = "active" | "members" | "loot" | "name";

/** One invite call can carry at most this many clans (the backend's cap for
 * staff-hosted events). */
const MAX_PER_INVITE = 200;

/**
 * Staff invite finder for a global clan-vs-clan event (web119a): filter every
 * clan on the site by size and activity, tick the ones to ask, and invite them
 * in one go. Each invited clan's leaders get a DM and the invite shows in
 * their inbox. Clans already invited or taking part are left out.
 */
export function EventInviteFinder({
  eventId,
  onInvited,
}: {
  eventId: number;
  /** Called after a successful invite so the roster above can reload. */
  onInvited?: () => void;
}) {
  const [minMembers, setMinMembers] = useState("10");
  const [minActive, setMinActive] = useState("5");
  const [minLootM, setMinLootM] = useState("");
  const [requireGuild, setRequireGuild] = useState(true);
  const [includeNoAdmins, setIncludeNoAdmins] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("active");

  const [rows, setRows] = useState<EventInviteCandidate[] | null>(null);
  const [total, setTotal] = useState(0);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const num = (v: string) => {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
  };

  const search = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const lootM = num(minLootM);
        const res = await fetchEventInviteCandidates(eventId, {
          minMembers: num(minMembers),
          minActive: num(minActive),
          minMonthlyLoot: lootM ? lootM * 1_000_000 : undefined,
          requireGuild,
          requireAdmins: !includeNoAdmins,
          q: q.trim() || undefined,
          sort,
          limit: 500,
        });
        setRows(res.rows);
        setTotal(res.total);
        setPicked(new Set());
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load clans."));
      }
    });
  };

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allPicked = rows != null && rows.length > 0 && rows.every((r) => picked.has(r.group_id));
  const toggleAll = () =>
    setPicked(allPicked ? new Set() : new Set((rows ?? []).map((r) => r.group_id)));

  const invite = () => {
    const ids = [...picked];
    if (!ids.length) return;
    if (ids.length > MAX_PER_INVITE) {
      setError(`Invite at most ${MAX_PER_INVITE} clans at a time.`);
      return;
    }
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await bulkInviteEventParticipants(null, eventId, ids);
        const invited = new Set(res.invited.map((c) => c.group_id));
        setRows((prev) => (prev ?? []).filter((r) => !invited.has(r.group_id)));
        setPicked(new Set());
        setNotice(
          `Invited ${res.invited.length} clan${res.invited.length === 1 ? "" : "s"}.` +
            (res.skipped.length ? ` Skipped ${res.skipped.length}.` : ""),
        );
        onInvited?.();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't send the invites."));
      }
    });
  };

  return (
    <section className="border-osrs-bronze/30 mt-6 min-w-0 rounded border p-4">
      <h4 className="text-osrs-gold mb-1 font-semibold">Find clans to invite</h4>
      <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
        Active means members with loot tracked this month. Each invited clan&apos;s leaders get a DM
        and see the invite on the site.
      </p>

      <form onSubmit={search} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-osrs-parchment-dark/70 min-w-0 text-xs">
          Min members
          <Input
            fieldSize="sm"
            inputMode="numeric"
            value={minMembers}
            onChange={(e) => setMinMembers(e.target.value)}
            className="mt-1 w-full"
          />
        </label>
        <label className="text-osrs-parchment-dark/70 min-w-0 text-xs">
          Min active
          <Input
            fieldSize="sm"
            inputMode="numeric"
            value={minActive}
            onChange={(e) => setMinActive(e.target.value)}
            className="mt-1 w-full"
          />
        </label>
        <label className="text-osrs-parchment-dark/70 min-w-0 text-xs">
          Min loot this month (M gp)
          <Input
            fieldSize="sm"
            inputMode="numeric"
            placeholder="Any"
            value={minLootM}
            onChange={(e) => setMinLootM(e.target.value)}
            className="mt-1 w-full"
          />
        </label>
        <label className="text-osrs-parchment-dark/70 min-w-0 text-xs">
          Sort by
          <Select
            fieldSize="sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="mt-1 w-full"
          >
            <option value="active">Most active</option>
            <option value="members">Most members</option>
            <option value="loot">Most loot</option>
            <option value="name">Name</option>
          </Select>
        </label>
        <label className="text-osrs-parchment-dark/70 col-span-2 min-w-0 text-xs">
          Name contains
          <Input
            fieldSize="sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full"
          />
        </label>
        <div className="col-span-2 flex flex-wrap items-end gap-x-4 gap-y-2 text-xs">
          <label className="text-osrs-parchment-dark/80 flex items-center gap-2">
            <Checkbox checked={requireGuild} onChange={(e) => setRequireGuild(e.target.checked)} />
            Linked Discord only
          </label>
          <label className="text-osrs-parchment-dark/80 flex items-center gap-2">
            <Checkbox
              checked={includeNoAdmins}
              onChange={(e) => setIncludeNoAdmins(e.target.checked)}
            />
            Include clans with no admins
          </label>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            Search
          </Button>
        </div>
      </form>

      {error && (
        <div className="mt-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {notice && (
        <div className="mt-3">
          <Alert variant="success">{notice}</Alert>
        </div>
      )}

      {rows != null && (
        <div className="mt-4 min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-osrs-parchment-dark/70">
              {total} {total === 1 ? "clan matches" : "clans match"}
              {total > rows.length ? `, showing ${rows.length}` : ""}
            </span>
            <Button size="sm" onClick={invite} disabled={pending || picked.size === 0}>
              Invite {picked.size || ""} {picked.size === 1 ? "clan" : "clans"}
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="text-osrs-parchment-dark/60 text-sm">No clans match these filters.</p>
          ) : (
            <div className="max-h-[28rem] overflow-auto rounded border border-osrs-bronze/20">
              <table className="w-full text-sm">
                <thead className="bg-osrs-brown-dark/60 text-osrs-parchment-dark/70 sticky top-0 text-xs">
                  <tr>
                    <th className="px-2 py-2 text-left">
                      <Checkbox
                        checked={allPicked}
                        onChange={toggleAll}
                        aria-label="Select every clan shown"
                      />
                    </th>
                    <th className="px-2 py-2 text-left">Clan</th>
                    <th className="px-2 py-2 text-right">Members</th>
                    <th className="px-2 py-2 text-right">Active</th>
                    <th className="hidden px-2 py-2 text-right sm:table-cell">Loot this month</th>
                    <th className="hidden px-2 py-2 text-right sm:table-cell">Admins</th>
                  </tr>
                </thead>
                <tbody className="divide-osrs-bronze/10 divide-y">
                  {rows.map((r) => (
                    <tr key={r.group_id} className="hover:bg-osrs-bronze/5">
                      <td className="px-2 py-1.5">
                        <Checkbox
                          checked={picked.has(r.group_id)}
                          onChange={() => toggle(r.group_id)}
                          aria-label={`Select ${r.group_name ?? `clan ${r.group_id}`}`}
                        />
                      </td>
                      <td className="max-w-[12rem] truncate px-2 py-1.5">
                        {r.group_name ?? `Clan ${r.group_id}`}
                        {r.event_status && (
                          <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                            {r.event_status}
                          </span>
                        )}
                        {!r.has_guild && (
                          <span className="text-osrs-parchment-dark/40 ml-2 text-xs">
                            no Discord
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.members}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.active}</td>
                      <td className="hidden px-2 py-1.5 text-right tabular-nums sm:table-cell">
                        {r.monthly_loot.value_formatted}
                      </td>
                      <td
                        className={`hidden px-2 py-1.5 text-right tabular-nums sm:table-cell ${r.admins ? "" : "text-osrs-red"}`}
                      >
                        {r.admins}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
