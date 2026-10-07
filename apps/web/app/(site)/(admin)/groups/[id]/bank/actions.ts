"use server";

import { revalidatePath } from "next/cache";
import type { BankEntryStatus, BankRecordableKind, GroupBankLedger } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

async function assertAdmin(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
}

function revalidate(groupId: number) {
  revalidatePath(`/groups/${groupId}/bank`);
  revalidatePath(`/groups/${groupId}`);
}

/** Backend 4xx details are written for people ("Turn on this event's prize
 * pot first"), so they're shown as-is; anything else still throws. */
async function attempt<T extends object>(groupId: number, fn: () => Promise<T>): Promise<Result<T>> {
  await assertAdmin(groupId);
  try {
    const out = await fn();
    revalidate(groupId);
    return { ok: true, ...out };
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) return { ok: false, message: err.message };
    throw err;
  }
}

export async function loadBankLedger(
  groupId: number,
  opts: { status?: BankEntryStatus | "all"; beforeId?: number | null },
): Promise<GroupBankLedger> {
  await assertAdmin(groupId);
  return api.groupBankLedger(groupId, opts);
}

export async function recordBankEntry(
  groupId: number,
  input: {
    kind: BankRecordableKind;
    amount: number;
    player_id?: number | null;
    rsn?: string | null;
    note?: string | null;
    proof_key?: string | null;
  },
) {
  return attempt(groupId, () => api.recordGroupBankEntry(groupId, input));
}

export async function updateBankEntry(
  groupId: number,
  entryId: number,
  patch: {
    amount?: number;
    status?: "confirmed" | "rejected" | "pending";
    note?: string | null;
    review_note?: string | null;
    proof_key?: string | null;
  },
) {
  return attempt(groupId, () => api.updateGroupBankEntry(groupId, entryId, patch));
}

export async function deleteBankEntry(groupId: number, entryId: number) {
  return attempt(groupId, () => api.deleteGroupBankEntry(groupId, entryId));
}

export async function transferBankToEvent(
  groupId: number,
  input: { event_id: number; amount: number; note?: string | null },
) {
  return attempt(groupId, async () => {
    const out = await api.transferGroupBankToEvent(groupId, input);
    revalidatePath(`/events/${input.event_id}`);
    return out;
  });
}
