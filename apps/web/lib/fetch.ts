import { notFound } from "next/navigation";

/**
 * Await a BFF fetch, translating a Web API 404 into Next's `notFound()` (a real
 * 404 page) while letting other failures bubble to the nearest `error.tsx`
 * boundary. Use for by-id resource loads (players, groups, events).
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof Error && /\b404\b/.test(err.message)) notFound();
    throw err;
  }
}
