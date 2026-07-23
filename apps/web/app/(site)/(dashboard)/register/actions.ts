"use server";

import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";

async function assertSignedIn() {
  const user = await getUser();
  if (!user) throw new Error("You must be signed in to claim an account.");
  return user;
}

function unwrap(err: unknown): never {
  if (err instanceof ApiError) throw new Error(err.message);
  throw err;
}

/** Read-only claim status for an RSN (as-you-type feedback). */
export async function claimPreview(rsn: string) {
  await assertSignedIn();
  try {
    return await api.claimPreview(rsn);
  } catch (err) {
    unwrap(err);
  }
}

/** Claim an RSN for the signed-in user (mirrors Discord /claim-rsn). */
export async function claimRsn(input: { rsn: string }) {
  await assertSignedIn();
  try {
    return await api.claimPlayer({ rsn: input.rsn });
  } catch (err) {
    unwrap(err);
  }
}

/** Unlink an owned player (mirrors Discord /unclaim-rsn). */
export async function unclaimRsn(playerId: number) {
  await assertSignedIn();
  try {
    return await api.unclaimPlayer(playerId);
  } catch (err) {
    unwrap(err);
  }
}
