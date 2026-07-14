/**
 * BFF: proof-screenshot upload for manual submissions. The browser POSTs the
 * image here (same origin) and we forward it to the Web API, which stores it in
 * B2 server-side and returns `{ key, public_url }`. The submit form then sends
 * `key` back as `proof_upload_key` on the submission.
 *
 * This replaces a direct browser→B2 presigned PUT: Backblaze's bucket CORS
 * policy only permits GET/HEAD, so the cross-origin PUT failed its preflight
 * and surfaced to users as a "Failed to fetch" TypeError. Routing the bytes
 * through our own origin avoids CORS entirely. A Route Handler (not a Server
 * Action) is used so the 10 MB image isn't bounded by `serverActions.body
 * SizeLimit` (3 MB).
 */
import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No image was provided." }, { status: 400 });
  }

  try {
    const res = await api.uploadProof(form);
    return NextResponse.json(res);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Couldn't upload the image." }, { status: 502 });
  }
}
