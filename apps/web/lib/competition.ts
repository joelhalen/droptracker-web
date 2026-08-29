/** Pure SOTW/BOTW helpers — kind labels, gained/points formatting, bonus-rule
 * wording. Mirrors the backend's services/competition.py display helpers so
 * the wizard preview, the web leaderboard and the Discord messages all say
 * the same thing. Keep logic here, not in components (unit-tested). */
import type {
  CompetitionBonusRule,
  CompetitionEventKind,
  CompetitionRankingMode,
  EventCompetition,
  EventCompetitionInput,
  EventKind,
} from "@droptracker/api-types";
import { COMPETITION_EVENT_KINDS } from "@droptracker/api-types";
import { OSRS_SKILLS } from "@/lib/events";

export function isCompetitionKind(kind: EventKind | string | null | undefined): kind is CompetitionEventKind {
  return (COMPETITION_EVENT_KINDS as readonly string[]).includes(kind ?? "");
}

export const COMPETITION_KIND_LABELS: Record<CompetitionEventKind, string> = {
  sotw: "Skill of the Week",
  botw: "Boss of the Week",
};

/** Duration-agnostic subcopy — the name is tradition, the length is yours. */
export const COMPETITION_KIND_HELP: Record<CompetitionEventKind, string> = {
  sotw:
    "Race the clan in one skill — most XP gained wins. Runs for any length you choose; " +
    "“of the Week” is just the tradition.",
  botw:
    "Race kills at one boss — most KC gained wins, with optional bonus points for pets " +
    "and fast kill times. Any length you choose.",
};

/** The skill picker's entries: `key` is what the backend validates
 * (lowercase; wom_skill_metric normalizes), `display` what renders.
 * "Overall" is deliberately absent — v1 races one real skill. */
export const COMPETITION_SKILLS = OSRS_SKILLS.map((display) => ({
  key: display.toLowerCase(),
  display,
}));

/** `2_481_034` → "2.48M XP" / `312` → "312 KC" (backend format_gained). */
export function formatGained(value: number, metricKind: "skill" | "boss" | null | undefined): string {
  const v = Math.max(Math.floor(value || 0), 0);
  let num: string;
  if (v >= 1_000_000_000) num = `${trimZeros((v / 1_000_000_000).toFixed(2))}B`;
  else if (v >= 1_000_000) num = `${trimZeros((v / 1_000_000).toFixed(2))}M`;
  else if (v >= 100_000) num = `${trimZeros((v / 1_000).toFixed(1))}K`;
  else num = v.toLocaleString("en-US");
  return `${num} ${metricKind === "skill" ? "XP" : "KC"}`;
}

function trimZeros(s: string): string {
  return s.replace(/\.?0+$/, "");
}

/** The ranked number, worded for the event's ranking mode. */
export function scoreText(
  value: number,
  rankingMode: CompetitionRankingMode,
  metricKind: "skill" | "boss" | null | undefined,
): string {
  if (rankingMode === "points") return `${Math.max(Math.floor(value || 0), 0).toLocaleString("en-US")} pts`;
  return formatGained(value, metricKind);
}

/** `91_800` → "1:31.8" — OSRS kill-time style (tick precision keeps at most
 * one decimal; whole seconds drop it). Mirrors the backend format_time_ms. */
export function formatTimeMs(ms: number): string {
  const v = Math.max(Math.floor(ms || 0), 0);
  const totalSeconds = Math.floor(v / 1000);
  const remMs = v % 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const base = `${minutes}:${String(seconds).padStart(2, "0")}`;
  return remMs ? `${base}.${Math.floor(remMs / 100)}` : base;
}

/** "1:31.8" / "1:31" / "91.8" (seconds) → ms, snapped to nothing (the
 * backend validates the range; ticks are the plugin's concern). Null on
 * garbage. */
export function parseTimeToMs(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const m = /^(?:(\d+):)?(\d{1,2}(?:\.\d)?)$/.exec(v);
  if (!m || m[2] === undefined) return null;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  const seconds = parseFloat(m[2]);
  if (!Number.isFinite(seconds) || seconds >= 60) {
    // No minute part means the whole value is seconds ("91.8").
    if (m[1]) return null;
    const asSeconds = parseFloat(v);
    return Number.isFinite(asSeconds) ? Math.round(asSeconds * 1000) : null;
  }
  return Math.round((minutes * 60 + seconds) * 1000);
}

/** One rule as a sentence — the wizard's live preview, the "How points work"
 * card and the Discord award line all render exactly this shape. */
export function bonusRuleSentence(rule: {
  type: CompetitionBonusRule["type"];
  points: number;
  max_awards?: number | null;
  pets?: string[] | null;
  npc?: string | null;
  threshold_ms?: number | null;
}): string {
  const cap = rule.max_awards && rule.max_awards > 1 ? `, up to ${rule.max_awards}× per player` : "";
  if (rule.type === "pet") {
    const pets = rule.pets ?? [];
    const what = pets.length === 1 ? `a new ${pets[0]}` : "a new pet";
    return `+${rule.points.toLocaleString("en-US")} pts for ${what}${cap}`;
  }
  const npc = rule.npc ? `${rule.npc} ` : "";
  const time = formatTimeMs(rule.threshold_ms ?? 0);
  return `+${rule.points.toLocaleString("en-US")} pts for a ${npc}kill under ${time}${cap}`;
}

/** "**Boss** Zulrah — most kills gained wins" without the markdown (web copy). */
export function metricSummary(competition: Pick<EventCompetition, "metric"> | null | undefined): string | null {
  const metric = competition?.metric;
  if (!metric) return null;
  if (metric.kind === "skill" && metric.skill) {
    return `${titleCase(metric.skill)} — most XP gained wins`;
  }
  if (metric.kind === "boss") {
    const npcs = metric.npcs ?? [];
    if (!npcs.length) return null;
    const names = npcs.slice(0, 3).map(titleCase).join(", ");
    const extra = npcs.length > 3 ? ` (+${npcs.length - 3} more)` : "";
    return `${names}${extra} — most kills gained wins`;
  }
  return null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Points-mode conversion preview: "Every 10,000 XP = 1 pt". */
export function rateSentence(
  gainedPerPoint: number | undefined,
  metricKind: "skill" | "boss" | null | undefined,
): string {
  const per = Math.max(gainedPerPoint ?? (metricKind === "boss" ? 1 : 10_000), 1);
  const unit = metricKind === "skill" ? "XP" : per === 1 ? "kill" : "kills";
  return `Every ${per.toLocaleString("en-US")} ${unit} = 1 pt`;
}

/** The detail payload's competition block → the PATCH input shape (what the
 * wizard/manager edit). Absent block = fresh defaults. */
export function competitionBlockToInput(
  block: EventCompetition | null | undefined,
): EventCompetitionInput {
  if (!block) return { participation: "whole_clan", ranking: { mode: "gained" } };
  return {
    ...(block.metric.kind === "skill" && block.metric.skill
      ? { metric: { key: block.metric.skill } }
      : {}),
    ...(block.metric.kind === "boss" && block.metric.npcs?.length
      ? { npcs: block.metric.npcs }
      : {}),
    ranking: {
      mode: block.ranking.mode,
      ...(block.ranking.gained_per_point != null
        ? { gained_per_point: block.ranking.gained_per_point }
        : {}),
    },
    bonus_rules: block.bonus_rules.map((r) => ({
      type: r.type,
      points: r.points,
      max_awards: r.max_awards,
      ...(r.pets?.length ? { pets: r.pets } : {}),
      ...(r.npc ? { npc: r.npc } : {}),
      ...(r.threshold_ms != null ? { threshold_ms: r.threshold_ms } : {}),
    })),
    participation: block.participation ?? "whole_clan",
  };
}

/** Human copy for the link validator's machine problems. */
export const WOM_LINK_PROBLEM_COPY: Record<string, string> = {
  not_found: "No WiseOldMan competition found for that link.",
  team_competition: "That's a team competition — DropTracker mirrors classic (individual) ones.",
  multi_metric: "That competition tracks several metrics at once, which DropTracker can't mirror yet.",
  unsupported_metric: "That competition's metric isn't a skill or boss KC race.",
  metric_kind_mismatch: "That competition tracks a different kind of metric — switch the event format or pick another competition.",
  finished: "That competition already ended — pick one that's upcoming or still running.",
  already_linked: "That competition is already linked to another DropTracker event.",
};
