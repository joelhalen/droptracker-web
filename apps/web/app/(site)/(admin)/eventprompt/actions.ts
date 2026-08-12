"use server";

/**
 * AI event-task generation (temporary staff tool — developer or superadmin).
 *
 * Auth wrapper only: the pipeline itself lives in lib/ai-task-gen.ts, shared
 * with the group-facing "try describing a task instead" panel in the task
 * builder. Staff use here is deliberately un-quota'd — the group-facing entry
 * point is the one that charges against a tier allowance.
 */
import { requireDeveloper } from "@/lib/auth";
import {
  generateFromDescription,
  validateDescription,
  type GenerateResult,
} from "@/lib/ai-task-gen";

export type { GeneratedTask, GenerateResult } from "@/lib/ai-task-gen";

export async function generateEventTask(description: string): Promise<GenerateResult> {
  await requireDeveloper("/eventprompt");
  const check = validateDescription(description);
  if (!check.ok) return check;
  return generateFromDescription(check.desc);
}
