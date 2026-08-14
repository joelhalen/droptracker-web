/**
 * Shared Web API v1 request plumbing for the BFF client modules. Every
 * `lib/api/<domain>` module goes through these helpers; they forward the
 * caller's `dt_session` cookie, apply Next.js cache options, and normalize
 * non-OK responses into `ApiError`.
 */
import { cookies } from "next/headers";
import { env, SESSION_COOKIE } from "../env";

type FetchOpts = {
  /** Forward the caller's session cookie to the Web API (authed routes). */
  authed?: boolean;
  /** Next.js cache revalidation window in seconds (ISR for public reads). */
  revalidate?: number;
  /**
   * Internal render token (X-Board-Image-Token) — lets the chrome-less
   * board-image route read ANY event (incl. private/draft) for the Discord
   * screenshot, bypassing the viewer-visibility gate on the backend.
   */
  internalToken?: string;
  /** Next cache tags — lets publish actions revalidateTag() a whole tenant
   *  site (`site:{sub}`) without touching other groups' caches. */
  tags?: string[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Parsed RFC-7807 body when the error response was JSON. Extension
     * members live here — e.g. the buy-in confirm-on-disable 409 carries
     * `{ type: "buyins-present", count, total }`. */
    public problem?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Machine-readable reason code from an ApiError's problem body (the `code`
 * extension member — e.g. "event_private", "event_draft", "staff_required"),
 * or null. Lets pages branch on WHY access was denied without string-matching
 * human-readable titles. */
export function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const code = err.problem?.code;
  return typeof code === "string" ? code : null;
}

/** Build an ApiError from a non-OK response, parsing the RFC-7807 body once so
 * both the human message and any extension members (`count`/`total`/`type`)
 * are available to callers. */
async function apiError(res: Response, context: string): Promise<ApiError> {
  let problem: Record<string, unknown> | undefined;
  let message = `Web API ${res.status} for ${context}`;
  try {
    const body = (await res.clone().json()) as Record<string, unknown>;
    problem = body;
    if (typeof body?.detail === "string") message = body.detail;
    else if (typeof body?.title === "string") message = body.title;
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, message, problem);
}

export async function apiGet(path: string, opts: FetchOpts = {}): Promise<unknown> {
  const url = `${env.webApiInternalUrl}/api/v1${path}`;
  const headers: Record<string, string> = { accept: "application/json" };

  if (opts.authed) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  }
  if (opts.internalToken) headers["x-board-image-token"] = opts.internalToken;

  const res = await fetch(url, {
    headers,
    next:
      opts.revalidate != null || opts.tags
        ? { revalidate: opts.revalidate, tags: opts.tags }
        : undefined,
  });

  if (!res.ok) throw await apiError(res, path);
  return res.json();
}

export async function apiSend(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body: unknown,
): Promise<unknown> {
  const url = `${env.webApiInternalUrl}/api/v1${path}`;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiError(res, `${method} ${path}`);
  return res.status === 204 ? null : res.json();
}

/** Multipart variant of apiSend — lets fetch set the multipart boundary header. */
export async function apiSendForm(method: "POST" | "PUT", path: string, form: FormData): Promise<unknown> {
  const url = `${env.webApiInternalUrl}/api/v1${path}`;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
    },
    body: form,
  });
  if (!res.ok) throw await apiError(res, `${method} ${path}`);
  return res.status === 204 ? null : res.json();
}

/** True when the caller holds a session cookie (real or dev-mock). */
export async function hasSessionCookie(): Promise<boolean> {
  return Boolean((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Run `fetcher`; if the Web API is down and mocks are enabled, use `fallback`. */
export async function withFallback<T>(fetcher: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await fetcher();
  } catch (err) {
    if (env.useMockApi) {
      console.warn(`[api] falling back to mock data:`, (err as Error).message);
      return fallback();
    }
    throw err;
  }
}
