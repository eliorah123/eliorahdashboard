import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-admin";
import { exchangeCodeForToken, fetchAdAccounts } from "@/lib/meta-api";

export async function GET(request: NextRequest) {
  const origin       = new URL(request.url).origin;
  const redirectBase = `${origin}/traffic/integrations`;

  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${redirectBase}?error=access_denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?error=invalid_callback`);
  }

  // Validate CSRF state
  const cookieStore  = await cookies();
  const storedState  = cookieStore.get("_meta_oauth_state")?.value;
  cookieStore.delete("_meta_oauth_state");

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${redirectBase}?error=state_mismatch`);
  }

  try {
    const { accessToken, expiresAt, userId, userName } = await exchangeCodeForToken(code);
    const db = createAdminClient();

    // Upsert connection keyed on meta_user_id
    const { data: conn, error: connErr } = await db
      .from("meta_connections")
      .upsert(
        {
          access_token:     accessToken,
          token_expires_at: expiresAt.toISOString(),
          meta_user_id:     userId,
          meta_user_name:   userName,
          status:           "active",
          last_error:       null,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: "meta_user_id" },
      )
      .select("id")
      .single();

    if (connErr || !conn) throw new Error("Falha ao salvar conexão no banco de dados");

    // Refresh ad accounts list
    const accounts = await fetchAdAccounts(accessToken);
    await db.from("meta_ad_accounts").delete().eq("connection_id", conn.id);

    if (accounts.length > 0) {
      await db.from("meta_ad_accounts").insert(
        accounts.map((a, i) => ({
          connection_id: conn.id,
          account_id:   a.id,
          account_name: a.name,
          currency:     a.currency,
          is_selected:  accounts.length === 1 || i === 0,
        })),
      );
    }

    return NextResponse.redirect(`${redirectBase}?connected=true`);
  } catch (e) {
    console.error("[Meta OAuth callback]", e);
    return NextResponse.redirect(`${redirectBase}?error=connection_failed`);
  }
}
