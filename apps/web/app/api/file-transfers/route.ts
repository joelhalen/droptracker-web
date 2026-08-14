/**
 * BFF: start a file transfer (web95a). The browser POSTs the file here (same
 * origin) and we forward it to the Web API, which stores it in B2 server-side.
 *
 * A Route Handler rather than a Server Action for the same reason the proof
 * uploader is one: `serverActions.bodySizeLimit` is 3 MB, and these files run
 * to 25 MB.
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
    return NextResponse.json({ error: "No file was provided." }, { status: 400 });
  }

  try {
    return NextResponse.json(await api.createFileTransfer(form));
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Couldn't upload the file." }, { status: 502 });
  }
}
