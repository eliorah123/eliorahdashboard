-- ============================================================
-- Tráfego Pago – Integrações
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Requires: get_my_role() function (already in supabase/schema.sql)
-- ============================================================

-- Meta Ads connection (one active connection per workspace)
CREATE TABLE IF NOT EXISTS meta_connections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL    DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL    DEFAULT now(),
  connected_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  access_token          TEXT        NOT NULL,
  token_expires_at      TIMESTAMPTZ,
  meta_user_id          TEXT        UNIQUE,
  meta_user_name        TEXT,
  status                TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'error', 'disconnected')),
  last_error            TEXT,
  last_synced_at        TIMESTAMPTZ,
  sync_interval_minutes INTEGER     NOT NULL DEFAULT 30
);

-- Ad accounts linked to a connection
CREATE TABLE IF NOT EXISTS meta_ad_accounts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  connection_id UUID        NOT NULL REFERENCES meta_connections(id) ON DELETE CASCADE,
  account_id    TEXT        NOT NULL,
  account_name  TEXT,
  currency      TEXT        DEFAULT 'BRL',
  is_selected   BOOLEAN     NOT NULL DEFAULT false
);

-- Sync history and error logs
CREATE TABLE IF NOT EXISTS meta_sync_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  connection_id  UUID        NOT NULL REFERENCES meta_connections(id) ON DELETE CASCADE,
  status         TEXT        NOT NULL CHECK (status IN ('success', 'error')),
  records_synced INTEGER     NOT NULL DEFAULT 0,
  error_message  TEXT
);

-- Aggregated daily traffic data (source-agnostic, ready for Google Ads etc.)
CREATE TABLE IF NOT EXISTS traffic_data (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  date          DATE         NOT NULL,
  source        TEXT         NOT NULL DEFAULT 'meta',
  ad_account_id TEXT,
  spend         NUMERIC(12,2) NOT NULL DEFAULT 0,
  impressions   INTEGER       NOT NULL DEFAULT 0,
  clicks        INTEGER       NOT NULL DEFAULT 0,
  leads         INTEGER       NOT NULL DEFAULT 0,
  conversions   INTEGER       NOT NULL DEFAULT 0,
  cpm           NUMERIC(10,4) NOT NULL DEFAULT 0,
  ctr           NUMERIC(10,6) NOT NULL DEFAULT 0,
  cpc           NUMERIC(10,4) NOT NULL DEFAULT 0,
  cpl           NUMERIC(10,4) NOT NULL DEFAULT 0,
  UNIQUE (date, source, ad_account_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE meta_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_sync_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_data      ENABLE ROW LEVEL SECURITY;

-- Read: admin and gestor only (all writes go through service role / API routes)
CREATE POLICY "integration_read_connections" ON meta_connections
  FOR SELECT USING (get_my_role() IN ('admin', 'gestor'));

CREATE POLICY "integration_read_ad_accounts" ON meta_ad_accounts
  FOR SELECT USING (get_my_role() IN ('admin', 'gestor'));

CREATE POLICY "integration_read_sync_logs" ON meta_sync_logs
  FOR SELECT USING (get_my_role() IN ('admin', 'gestor'));

CREATE POLICY "integration_read_traffic_data" ON traffic_data
  FOR SELECT USING (get_my_role() IN ('admin', 'gestor'));

-- ── Triggers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meta_connections_updated_at
  BEFORE UPDATE ON meta_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_traffic_data_updated_at
  BEFORE UPDATE ON traffic_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
