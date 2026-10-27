/**
 * Pure shaping for the clan rank roles panel (components/rank-roles-card.tsx).
 * Unit-tested; keep React out of here.
 */
import type {
  RankRoleConfig,
  RankRoleEntry,
  RankRoleRank,
  RankRoles,
  RankRoleStatus,
} from "@droptracker/api-types";

/** One row of the editor: a rank, its members, and what it maps to. */
export interface RankRow extends RankRoleEntry {
  label: string;
  icon_url: string | null;
  members: number;
  linked_members: number;
}

/** The rank list the editor shows: the backend's order (saved order first,
 * then new ranks), each merged with its saved entry. */
export function buildRows(data: Pick<RankRoles, "ranks" | "config">): RankRow[] {
  const saved = new Map(data.config.ranks.map((e) => [e.rank, e]));
  return data.ranks.map((r: RankRoleRank) => {
    const entry = saved.get(r.rank);
    return {
      rank: r.rank,
      role_id: entry?.role_id ?? null,
      name: entry?.name || r.label,
      create: entry?.create ?? false,
      created: entry?.created ?? false,
      delete_when_empty: entry?.delete_when_empty ?? false,
      label: r.label,
      icon_url: r.icon_url,
      members: r.members,
      linked_members: r.linked_members,
    };
  });
}

/** Rows back to the config the API stores; row order is rank priority. */
export function toConfig(
  base: Pick<RankRoleConfig, "enabled" | "mode" | "create_roles" | "exempt_role_id">,
  rows: readonly RankRow[],
): RankRoleConfig {
  return {
    enabled: base.enabled,
    mode: base.mode,
    create_roles: base.create_roles,
    exempt_role_id: base.exempt_role_id || null,
    ranks: rows.map((r) => ({
      rank: r.rank,
      role_id: r.role_id,
      name: r.name.trim() || r.label,
      create: base.create_roles && !r.role_id && r.create,
      created: r.created,
      delete_when_empty: r.delete_when_empty && (r.created || (!r.role_id && r.create)),
    })),
  };
}

export const CREATE_CHOICE = "__create__";

/** The role picker's value for a row: a role id, "create", or "" for none. */
export function roleChoice(row: Pick<RankRow, "role_id" | "create">): string {
  if (row.role_id) return row.role_id;
  return row.create ? CREATE_CHOICE : "";
}

/** Apply a picker choice to a row. Picking a role drops the "created" mark
 * unless it is the role we made. */
export function applyRoleChoice<T extends RankRow>(row: T, choice: string): T {
  if (choice === CREATE_CHOICE) return { ...row, role_id: null, create: true, created: false };
  if (!choice)
    return { ...row, role_id: null, create: false, created: false, delete_when_empty: false };
  const keepCreated = row.created && row.role_id === choice;
  return {
    ...row,
    role_id: choice,
    create: false,
    created: keepCreated,
    delete_when_empty: keepCreated ? row.delete_when_empty : false,
  };
}

/** Move a row one place up (-1) or down (+1). */
export function moveRow<T>(rows: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (to < 0 || to >= rows.length) return [...rows];
  const next = [...rows];
  const [row] = next.splice(index, 1);
  next.splice(to, 0, row as T);
  return next;
}

/** Which rank's role a row's members fall back to when it has none. */
export function fallbackLabel(rows: readonly RankRow[], index: number): string | null {
  for (let i = index + 1; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.role_id || r.create) return r.label;
  }
  return null;
}

/** Plain-language summary of the last pass. */
export function statusSummary(status: RankRoleStatus | null): {
  tone: "ok" | "warn" | "error";
  text: string;
} {
  if (!status)
    return {
      tone: "warn",
      text: "The bot hasn't run a sync yet. It runs within a minute of saving.",
    };
  switch (status.state) {
    case "ok":
      return { tone: "ok", text: syncCounts(status) };
    case "problems":
      return { tone: "warn", text: `${syncCounts(status)} Some ranks need attention.` };
    case "held_back":
    case "waiting_for_ranks":
    case "conflict":
    case "no_guild":
    case "missing_permission":
      return { tone: "warn", text: status.message || "The last sync couldn't run." };
    case "disabled":
      return { tone: "warn", text: "Rank roles are off." };
    default:
      return {
        tone: "error",
        text: status.message || "The last sync failed. It will try again shortly.",
      };
  }
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function syncCounts(s: RankRoleStatus): string {
  const parts = [`Checked ${plural(s.checked, "member")}`];
  if (s.added) parts.push(`gave ${plural(s.added, "role")}`);
  if (s.removed) parts.push(`took ${plural(s.removed, "role")} off`);
  let text = parts.join(", ") + ".";
  if (s.not_in_server) {
    text += ` ${plural(s.not_in_server, "linked member")} ${s.not_in_server === 1 ? "isn't" : "aren't"} in your server.`;
  }
  if (s.created.length) text += ` Created: ${s.created.join(", ")}.`;
  if (s.deleted.length) text += ` Deleted (empty): ${s.deleted.join(", ")}.`;
  return text;
}
