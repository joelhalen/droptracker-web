"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import type { ToolListing, ToolListingInput } from "@/lib/tools-directory";

// The Web API decides who may do what (staff vs a listing's maintainers), so
// these only make sure there is a session and turn API errors into messages.

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  await requireUser("/tools");
  try {
    const value = await fn();
    revalidatePath("/tools");
    return { ok: true, value };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function createToolListing(input: ToolListingInput): Promise<Result<ToolListing>> {
  return run(() => api.createToolListing(input));
}

export async function updateToolListing(
  id: number,
  patch: Partial<ToolListingInput>,
): Promise<Result<ToolListing>> {
  return run(() => api.updateToolListing(id, patch));
}

export async function deleteToolListing(id: number): Promise<Result<{ ok: true }>> {
  return run(() => api.deleteToolListing(id));
}

export async function addToolMaintainer(id: number, userId: number): Promise<Result<ToolListing>> {
  return run(() => api.addToolMaintainer(id, userId));
}

export async function removeToolMaintainer(
  id: number,
  userId: number,
): Promise<Result<ToolListing>> {
  return run(() => api.removeToolMaintainer(id, userId));
}
