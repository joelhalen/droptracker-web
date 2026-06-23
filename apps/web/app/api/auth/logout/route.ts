import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { clearSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  await clearSession();
  const redirectTo = req.nextUrl.searchParams.get("redirect") ?? "/";
  return NextResponse.redirect(new URL(redirectTo, env.siteUrl));
}

export const POST = GET;
