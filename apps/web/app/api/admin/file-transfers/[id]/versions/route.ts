/**
 * BFF: staff reply to a file transfer (web95a) — stores an updated copy as the
 * transfer's next version and pushes its retention window out.
 *
 * A Route Handler, not the Server Action its neighbouring delete uses, purely
 * because of size: these uploads run to 25 MB and `serverActions.bodySizeLimit`
 * is 3 MB. The role check that matters is the Web API's own `assert_developer`;
 * `requireDeveloper` here just fails fast with a real 401/403 instead of
 * pushing 25 MB up to be rejected.
 */
import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!user.is_developer && !user.is_superadmin) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const { id } = await params;
  const transferId = Number(id);
  if (!Number.isInteger(transferId)) {
    return NextResponse.json({ error: "Bad transfer id." }, { status: 400 });
  }

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
    return NextResponse.json(await api.addFileTransferVersion(transferId, form));
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Couldn't upload the new version." }, { status: 502 });
  }
}
