import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { fetchInsights } from "@/lib/meta-api";

export async function POST() {
  const db = createAdminClient();

  // Fetch active connection
  const { data: conn } = await db
    .from("meta_connections")
    .select("id, access_token, token_expires_at, status")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: "Sem conexão Meta ativa" }, { status: 400 });
  }

  // Token expiry check
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at as string) : null;
  if (expiresAt && expiresAt < new Date()) {
    await db
      .from("meta_connections")
      .update({ status: "expired" })
      .eq("id", conn.id);
    return NextResponse.json(
      { error: "Token expirado. Reconecte sua conta Meta." },
      { status: 401 },
    );
  }

  // Get selected ad accounts
  const { data: accounts } = await db
    .from("meta_ad_accounts")
    .select("account_id")
    .eq("connection_id", conn.id)
    .eq("is_selected", true);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma conta de anúncios selecionada" },
      { status: 400 },
    );
  }

  // Sync last 30 days
  const today   = new Date();
  const fromDay = new Date();
  fromDay.setDate(today.getDate() - 30);
  const dateFrom = fromDay.toISOString().split("T")[0];
  const dateTo   = today.toISOString().split("T")[0];

  let totalRecords = 0;

  try {
    for (const { account_id: accountId } of accounts) {
      const insights = await fetchInsights(
        conn.access_token as string,
        accountId as string,
        dateFrom,
        dateTo,
      );
      if (insights.length === 0) continue;

      const rows = insights.map(d => ({
        date:          d.date,
        source:        "meta",
        ad_account_id: accountId,
        spend:         d.spend,
        impressions:   d.impressions,
        clicks:        d.clicks,
        leads:         d.leads,
        conversions:   d.conversions,
        cpm:           d.cpm,
        ctr:           d.ctr,
        cpc:           d.cpc,
        cpl:           d.leads > 0 ? Math.round((d.spend / d.leads) * 100) / 100 : 0,
        updated_at:    new Date().toISOString(),
      }));

      await db
        .from("traffic_data")
        .upsert(rows, { onConflict: "date,source,ad_account_id" });

      totalRecords += rows.length;
    }

    await db
      .from("meta_connections")
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", conn.id);

    await db.from("meta_sync_logs").insert({
      connection_id:  conn.id,
      status:         "success",
      records_synced: totalRecords,
    });

    return NextResponse.json({ success: true, recordsSynced: totalRecords });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";

    await db
      .from("meta_connections")
      .update({ last_error: msg })
      .eq("id", conn.id);

    await db.from("meta_sync_logs").insert({
      connection_id:  conn.id,
      status:         "error",
      records_synced: totalRecords,
      error_message:  msg,
    });

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
