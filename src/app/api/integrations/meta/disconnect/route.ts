import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  try {
    const db = createAdminClient();
    await db
      .from("meta_connections")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .neq("status", "disconnected");
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
