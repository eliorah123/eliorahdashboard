export type IntegrationStatus =
  | "not_connected"
  | "connected"
  | "syncing"
  | "error"
  | "token_expired";

export interface MetaAdAccount {
  id: string;
  accountId: string;
  accountName: string;
  currency: string;
  isSelected: boolean;
}

export interface MetaConnectionInfo {
  id: string;
  status: IntegrationStatus;
  metaUserName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  adAccounts: MetaAdAccount[];
}

export interface TrafficDayData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  cpm: number;
  ctr: number;
  cpc: number;
  cpl: number;
}
