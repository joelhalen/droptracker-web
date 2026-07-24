/** Live-edit retroactivity helpers (web68a).
 *
 * A scoring-affecting task edit on an ACTIVE event must carry the editor's
 * explicit choice: re-score recorded progress against the new goal, or keep
 * it and apply forward-only. These pure predicates decide when the UI shows
 * that choice; the backend enforces the same rule with a 422
 * `retro_required` as the backstop.
 */

/** Task types with no automatic ledger to re-fold — manual-only, so a live
 * change is inherently forward-only and no retro choice is asked. */
export const FORWARD_ONLY_TASK_TYPES = ["custom", "ehp_target", "ehb_target"] as const;

/** Whether a live edit of this task can NEVER be retroactively recomputed —
 * manual-only types, or any task on a board-game event (progress there is
 * entangled with turn state; coins/rolls must never be retro-granted). */
export function isForwardOnlyTask(
  taskType: string,
  eventKind?: string | null,
): boolean {
  return (
    (FORWARD_ONLY_TASK_TYPES as readonly string[]).includes(taskType) ||
    (eventKind ?? "standard") === "board_game"
  );
}

type ScoringFields = {
  target?: string | null;
  target_value?: number | null;
  points?: number | null;
  config?: string | null;
};

/** Whether an edit touches the fields that drive scoring (goal/points/config).
 * String-compares `config` JSON — client-rebuilt configs can differ textually
 * from the stored one while meaning the same thing, which at worst shows the
 * retro prompt unnecessarily (never skips it when it matters: the backend
 * compares post-normalization and 422s `retro_required` as the backstop). */
export function taskScoringDirty(input: ScoringFields, initial: ScoringFields): boolean {
  return (
    (input.target ?? null) !== (initial.target ?? null) ||
    (input.target_value ?? null) !== (initial.target_value ?? null) ||
    (input.points ?? 0) !== (initial.points ?? 0) ||
    (input.config ?? null) !== (initial.config ?? null)
  );
}
