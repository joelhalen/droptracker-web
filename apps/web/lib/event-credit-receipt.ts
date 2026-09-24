/**
 * Before/after receipt for an organizer's manual credit on an event.
 *
 * The backend reads the team score, the task's progress and (when a player
 * is named) that player's points inside the award/confirm transaction, once
 * before the row is applied and once after, and returns them as
 * `score_change`. This turns that into the lines the Review panel shows, so
 * an organizer can see the credit landed without checking the standings.
 */
import { z } from "zod";

const UnitSchema = z.enum(["points", "xp", "kills"]).catch("points");

const PairSchema = z.object({ before: z.number(), after: z.number(), delta: z.number() });

export const EventScoreChangeSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string().nullable(),
    unit: UnitSchema,
    score: PairSchema.nullable(),
  }),
  task: z.object({
    id: z.number(),
    label: z.string().nullable(),
    progress: PairSchema.nullable(),
    threshold: z.number().nullable(),
    completed_before: z.boolean().nullable(),
    completed_after: z.boolean().nullable(),
  }),
  player: z
    .object({ id: z.number(), name: z.string(), unit: UnitSchema, value: PairSchema.nullable() })
    .nullable(),
});

/** How the award/confirm responses carry it: missing, null, or malformed all
 * come out as null, because the credit itself already succeeded. */
export const ScoreChangeFieldSchema = EventScoreChangeSchema.nullable().optional().catch(null);

export type EventScoreChange = z.infer<typeof EventScoreChangeSchema>;
export type ScoreChangeUnit = EventScoreChange["team"]["unit"];
export type ScoreChangePair = z.infer<typeof PairSchema>;

export type ReceiptLine = {
  key: "team" | "player" | "task";
  label: string;
  before: string;
  after: string;
  delta: string;
  moved: boolean;
};

const UNIT_LABEL: Record<ScoreChangeUnit, string> = { points: "pts", xp: "XP", kills: "kills" };

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function signed(n: number): string {
  if (n === 0) return "±0";
  return `${n > 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
}

function line(
  key: ReceiptLine["key"],
  label: string,
  pair: ScoreChangePair,
  unit: string,
  of?: number | null,
): ReceiptLine {
  const suffix = unit ? ` ${unit}` : "";
  const target = of ? ` / ${fmt(of)}` : "";
  return {
    key,
    label,
    before: `${fmt(pair.before)}${target}`,
    after: `${fmt(pair.after)}${target}${suffix}`,
    delta: `${signed(pair.delta)}${suffix}`,
    moved: pair.delta !== 0,
  };
}

/** The rows to show, in reading order: team score, player, task progress.
 * A number the backend couldn't read is left out rather than shown as 0. */
export function receiptLines(change: EventScoreChange): ReceiptLine[] {
  const out: ReceiptLine[] = [];
  const { team, player, task } = change;
  if (team.score) {
    out.push(line("team", team.name ?? "Team", team.score, UNIT_LABEL[team.unit] ?? ""));
  }
  if (player?.value) {
    out.push(line("player", player.name, player.value, UNIT_LABEL[player.unit] ?? ""));
  }
  if (task.progress) {
    out.push(line("task", task.label ?? "Task progress", task.progress, "", task.threshold));
  }
  return out;
}

/** True when the task went from not done to done with this credit. */
export function completedNow(change: EventScoreChange): boolean {
  return change.task.completed_before === false && change.task.completed_after === true;
}

/** Nothing the receipt could read moved. Worth flagging: the credit was
 * recorded but did not change the standings (for example, a task that was
 * already complete, or progress too small to finish it). */
export function nothingMoved(change: EventScoreChange): boolean {
  const lines = receiptLines(change);
  return lines.length > 0 && lines.every((l) => !l.moved);
}
