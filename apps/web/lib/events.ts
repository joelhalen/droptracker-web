import type { EventTask } from "@droptracker/api-types";

export const TASK_TYPE_LABELS: Record<EventTask["type"], string> = {
  item_collection: "Item",
  kc_target: "Kill count",
  xp_target: "XP",
  ehp_target: "EHP",
  ehb_target: "EHB",
  pb_target: "Personal best",
  skill_target: "Skill",
};

/** Human-readable goal for a task, e.g. "Vorkath · 50". */
export function taskGoal(task: EventTask): string {
  const parts: string[] = [];
  if (task.target) parts.push(task.target);
  if (task.target_value != null) parts.push(task.target_value.toLocaleString());
  return parts.join(" · ");
}
