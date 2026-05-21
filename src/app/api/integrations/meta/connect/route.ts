import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { buildOAuthUrl } from "@/lib/meta-api";

export async function GET() {
  if (!process.env.META_APP_ID || !process.env.META_REDIRECT_URI) {
    return NextResponse.json(
      { error: "META_APP_ID e META_REDIRECT_URI não configurados em .env.local" },
      { status: 500 },
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("_meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    maxAge:   600,
    path:     "/",
  });

  return NextResponse.redirect(buildOAuthUrl(state));
}
