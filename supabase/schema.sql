-- ============================================================
-- ELIORAH SYSTEM — Database Schema v1
-- Execute no Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 0. EXTENSÕES
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─────────────────────────────────────────────────────────────
-- 1. TIPOS
-- ─────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'gestor', 'vendedor');


-- ─────────────────────────────────────────────────────────────
-- 2. TABELAS
-- ─────────────────────────────────────────────────────────────

-- 2.1  profiles
-- Usuários internos do sistema. Criado automaticamente via trigger
-- quando alguém se registra no Supabase Auth.
-- ------------------------------------------------------------------
CREATE TABLE profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT '',
  email        TEXT        NOT NULL DEFAULT '',
  role         user_role   NOT NULL DEFAULT 'vendedor',
  avatar_color TEXT        NOT NULL DEFAULT '#22c55e',

  -- Vínculo opcional: para usuários com role='vendedor', aponta para
  -- o registro em sellers. Permite que o RLS restrinja acesso.
  seller_id    UUID        NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  profiles                IS 'Usuários internos do sistema (espelha auth.users)';
COMMENT ON COLUMN profiles.seller_id      IS 'FK para sellers — obrigatório para role=vendedor';
COMMENT ON COLUMN profiles.avatar_color   IS 'Cor hex para o avatar gerado por iniciais';


-- 2.2  sellers
-- Membros da equipe de vendas.
-- Pode existir sem um usuário associado (vendedor cadastrado sem login).
-- ------------------------------------------------------------------
CREATE TABLE sellers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  avatar_color TEXT        NOT NULL DEFAULT '#22c55e',
  role         user_role   NOT NULL DEFAULT 'vendedor',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sellers_name_not_empty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE sellers IS 'Equipe de vendas — pode ou não ter login no sistema';


-- Adicionamos a FK de profiles → sellers aqui, após sellers existir
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_seller
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL;


-- 2.3  sales_records
-- Registro operacional diário. Cada linha representa os números de
-- um dia (podendo estar vinculada a um vendedor específico ou ao time).
-- ------------------------------------------------------------------
CREATE TABLE sales_records (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE           NOT NULL,
  seller_id   UUID           NULL REFERENCES sellers(id) ON DELETE SET NULL,

  -- Métricas brutas (nunca derivadas aqui — computar na aplicação)
  investment  NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (investment  >= 0),
  leads       INTEGER        NOT NULL DEFAULT 0 CHECK (leads       >= 0),
  sales       INTEGER        NOT NULL DEFAULT 0 CHECK (sales       >= 0),
  revenue     NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (revenue     >= 0),
  notes       TEXT           NOT NULL DEFAULT '',

  -- Auditoria
  created_by  UUID           NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  sales_records             IS 'Registros diários de operação (time ou por vendedor)';
COMMENT ON COLUMN sales_records.seller_id   IS 'NULL = registro do time; preenchido = atribuído a um vendedor';
COMMENT ON COLUMN sales_records.investment  IS 'Investimento em tráfego pago (BRL)';
COMMENT ON COLUMN sales_records.revenue     IS 'Receita gerada no dia (BRL)';


-- 2.4  monthly_goals
-- Metas mensais da operação. Uma linha por mês/ano.
-- ------------------------------------------------------------------
CREATE TABLE monthly_goals (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  year              SMALLINT       NOT NULL,
  month             SMALLINT       NOT NULL CHECK (month BETWEEN 1 AND 12),

  investment_target NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (investment_target >= 0),
  leads_target      INTEGER        NOT NULL DEFAULT 0 CHECK (leads_target      >= 0),
  sales_target      INTEGER        NOT NULL DEFAULT 0 CHECK (sales_target      >= 0),
  revenue_target    NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (revenue_target    >= 0),

  created_by        UUID           NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT monthly_goals_unique_month UNIQUE (year, month)
);

COMMENT ON TABLE monthly_goals IS 'Metas mensais da operação — máximo 1 registro por (ano, mês)';


-- ─────────────────────────────────────────────────────────────
-- 3. FUNÇÕES E TRIGGERS
-- ─────────────────────────────────────────────────────────────

-- 3.1  Auto-atualização de updated_at
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sellers_updated_at
  BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sales_records_updated_at
  BEFORE UPDATE ON sales_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_monthly_goals_updated_at
  BEFORE UPDATE ON monthly_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.2  Auto-criação de profile no cadastro
-- Executado pelo Supabase Auth quando um usuário se registra.
-- Lê name e role do user_metadata passado no signUp().
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.email, ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'gestor', 'vendedor')
      THEN (NEW.raw_user_meta_data->>'role')::user_role
      ELSE 'vendedor'::user_role
    END
  )
  ON CONFLICT (id) DO NOTHING; -- idempotente: evita duplicata se trigger rodar 2x
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- 3.3  Helpers de RLS (SECURITY DEFINER = bypass RLS ao ler profiles)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_seller_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT seller_id FROM profiles WHERE id = auth.uid();
$$;


-- ─────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_goals  ENABLE ROW LEVEL SECURITY;


-- ── profiles ──────────────────────────────────────────────────

-- Usuário vê o próprio perfil; admin e gestor veem todos
CREATE POLICY "profiles: leitura"
  ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR get_my_role() IN ('admin', 'gestor')
  );

-- Qualquer usuário atualiza apenas o próprio perfil
CREATE POLICY "profiles: atualização própria"
  ON profiles FOR UPDATE TO authenticated
  USING     (id = auth.uid())
  WITH CHECK(id = auth.uid());

-- Somente admin insere/deleta perfis manualmente
CREATE POLICY "profiles: inserção admin"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "profiles: exclusão admin"
  ON profiles FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');


-- ── sellers ───────────────────────────────────────────────────

-- Todos autenticados visualizam vendedores (necessário para dropdowns)
CREATE POLICY "sellers: leitura pública"
  ON sellers FOR SELECT TO authenticated
  USING (TRUE);

-- Admin e gestor gerenciam vendedores
CREATE POLICY "sellers: escrita admin/gestor"
  ON sellers FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'gestor'));

CREATE POLICY "sellers: atualização admin/gestor"
  ON sellers FOR UPDATE TO authenticated
  USING     (get_my_role() IN ('admin', 'gestor'));

-- Apenas admin pode excluir (proteção de dados históricos)
CREATE POLICY "sellers: exclusão admin"
  ON sellers FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');


-- ── sales_records ─────────────────────────────────────────────

-- Admin e gestor: acesso total
CREATE POLICY "sales_records: acesso total admin/gestor"
  ON sales_records FOR ALL TO authenticated
  USING     (get_my_role() IN ('admin', 'gestor'))
  WITH CHECK(get_my_role() IN ('admin', 'gestor'));

-- Vendedor: apenas registros vinculados ao próprio seller_id
CREATE POLICY "sales_records: vendedor acessa próprios"
  ON sales_records FOR ALL TO authenticated
  USING (
    get_my_role() = 'vendedor'
    AND seller_id IS NOT NULL
    AND seller_id = get_my_seller_id()
  )
  WITH CHECK (
    get_my_role() = 'vendedor'
    AND seller_id IS NOT NULL
    AND seller_id = get_my_seller_id()
  );


-- ── monthly_goals ─────────────────────────────────────────────

-- Todos autenticados visualizam metas (exibido no dashboard)
CREATE POLICY "monthly_goals: leitura"
  ON monthly_goals FOR SELECT TO authenticated
  USING (TRUE);

-- Admin e gestor definem metas
CREATE POLICY "monthly_goals: escrita admin/gestor"
  ON monthly_goals FOR ALL TO authenticated
  USING     (get_my_role() IN ('admin', 'gestor'))
  WITH CHECK(get_my_role() IN ('admin', 'gestor'));


-- ─────────────────────────────────────────────────────────────
-- 5. ÍNDICES DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────

-- sales_records — consultas mais frequentes do dashboard
CREATE INDEX idx_sr_date
  ON sales_records (date DESC);

CREATE INDEX idx_sr_seller
  ON sales_records (seller_id)
  WHERE seller_id IS NOT NULL;

-- Composite: filtragem por período + vendedor (ranking mensal, histórico)
CREATE INDEX idx_sr_date_seller
  ON sales_records (date DESC, seller_id);

-- Auditoria: quem criou cada registro
CREATE INDEX idx_sr_created_by
  ON sales_records (created_by)
  WHERE created_by IS NOT NULL;

-- sellers — listagens rápidas de equipe ativa
CREATE INDEX idx_sellers_active
  ON sellers (active)
  WHERE active = TRUE;

-- profiles — agrupamento por perfil (admin panel)
CREATE INDEX idx_profiles_role
  ON profiles (role);

-- FK de profiles → sellers (joins do RLS)
CREATE INDEX idx_profiles_seller_id
  ON profiles (seller_id)
  WHERE seller_id IS NOT NULL;

-- monthly_goals — a constraint UNIQUE já cria o índice composto (year, month)


-- ─────────────────────────────────────────────────────────────
-- 6. VIEW DE MÉTRICAS DERIVADAS (opcional, para relatórios)
-- As métricas computadas nunca são armazenadas — sempre derivadas.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_sales_metrics
WITH (security_invoker = TRUE) -- respeita o RLS do usuário chamador
AS
SELECT
  sr.id,
  sr.date,
  sr.seller_id,
  s.name                                                       AS seller_name,
  sr.investment,
  sr.leads,
  sr.sales,
  sr.revenue,
  sr.notes,
  sr.created_by,

  -- Métricas derivadas
  sr.revenue - sr.investment                                   AS profit,

  CASE WHEN sr.leads      > 0
       THEN ROUND(sr.investment / sr.leads,   2)       ELSE 0 END AS cpl,

  CASE WHEN sr.leads      > 0
       THEN ROUND((sr.sales::numeric / sr.leads) * 100, 2)
                                                       ELSE 0 END AS conversion_rate,

  CASE WHEN sr.investment > 0
       THEN ROUND(sr.revenue / sr.investment, 2)       ELSE 0 END AS roas,

  CASE WHEN sr.sales      > 0
       THEN ROUND(sr.revenue / sr.sales,      2)       ELSE 0 END AS avg_ticket

FROM sales_records sr
LEFT JOIN sellers s ON s.id = sr.seller_id;

COMMENT ON VIEW v_sales_metrics IS
  'Métricas derivadas de sales_records — nunca armazenar, sempre computar';


-- ─────────────────────────────────────────────────────────────
-- 7. CONFIGURAÇÕES RECOMENDADAS (executar no Supabase Dashboard)
-- ─────────────────────────────────────────────────────────────

-- ⚠  Para ferramentas internas, desative a confirmação de e-mail:
--    Authentication → Email → "Confirm email" → OFF
--
-- ⚠  Para promover o primeiro usuário a admin após o cadastro:
--    UPDATE profiles SET role = 'admin' WHERE email = 'seu@email.com';
--
-- ⚠  Para vincular um usuário vendedor ao seu registro em sellers:
--    UPDATE profiles SET seller_id = '<uuid do seller>' WHERE id = '<uuid do user>';


-- ─────────────────────────────────────────────────────────────
-- FIM DO SCHEMA
-- ─────────────────────────────────────────────────────────────
