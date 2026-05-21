"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import type { MetaConnectionInfo, TrafficDayData } from "@/types/integrations";
import type { TrafficPeriod } from "@/types/traffic";

// ─── Read connection status ───────────────────────────────────────────────────

export async function getMetaConnectionStatus(): Promise<MetaConnectionInfo | null> {
  try {
    const db = createAdminClient();

    const { data: conn } = await db
      .from("meta_connections")
      .select("id, status, meta_user_name, last_synced_at, last_error")
      .neq("status", "disconnected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conn) return null;

    const { data: accounts } = await db
      .from("meta_ad_accounts")
      .select("id, account_id, account_name, currency, is_selected")
      .eq("connection_id", conn.id);

    const rawStatus = conn.status as string;
    const status =
      rawStatus === "active"       ? "connected"     :
      rawStatus === "expired"      ? "token_expired" :
      rawStatus === "error"        ? "error"          :
      "not_connected";

    return {
      id:            conn.id as string,
      status,
      metaUserName:  conn.meta_user_name as string | null,
      lastSyncedAt:  conn.last_synced_at as string | null,
      lastError:     conn.last_error     as string | null,
      adAccounts: (accounts ?? []).map(a => ({
        id:          a.id          as string,
        accountId:   a.account_id  as string,
        accountName: (a.account_name as string | null) ?? (a.account_id as string),
        currency:    (a.currency   as string | null) ?? "BRL",
        isSelected:  a.is_selected as boolean,
      })),
    };
  } catch {
    return null;
  }
}

// ─── Select ad accounts ───────────────────────────────────────────────────────

export async function selectAdAccounts(
  connectionId: string,
  selectedIds:  string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = createAdminClient();

    await db
      .from("meta_ad_accounts")
      .update({ is_selected: false })
      .eq("connection_id", connectionId);

    if (selectedIds.length > 0) {
      await db
        .from("meta_ad_accounts")
        .update({ is_selected: true })
        .eq("connection_id", connectionId)
        .in("account_id", selectedIds);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ─── Read synced traffic data ─────────────────────────────────────────────────

export async function getTrafficDataFromDB(
  period: TrafficPeriod,
): Promise<TrafficDayData[] | null> {
  try {
    const db   = createAdminClient();
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;

    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromISO = from.toISOString().split("T")[0];

    const { data, error } = await db
      .from("traffic_data")
      .select("date,spend,impressions,clicks,leads,conversions,cpm,ctr,cpc,cpl")
      .eq("source", "meta")
      .gte("date", fromISO)
      .order("date", { ascending: true });

    if (error || !data || data.length === 0) return null;

    return data.map(d => ({
      date:        d.date        as string,
      spend:       Number(d.spend)       || 0,
      impressions: Number(d.impressions) || 0,
      clicks:      Number(d.clicks)      || 0,
      leads:       Number(d.leads)       || 0,
      conversions: Number(d.conversions) || 0,
      cpm:         Number(d.cpm)         || 0,
      ctr:         Number(d.ctr)         || 0,
      cpc:         Number(d.cpc)         || 0,
      cpl:         Number(d.cpl)         || 0,
    }));
  } catch {
    return null;
  }
}
