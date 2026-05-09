/**
 * Canonical data model for the Sales Performance SaaS.
 *
 * This file is the single source of truth for every entity.
 * No business logic lives here — only shapes.
 *
 * When a real database is added, the ORM types and this file
 * must stay in sync. API request/response payloads derive from
 * these interfaces via Omit/Pick — never duplicate by hand.
 *
 * Multi-tenancy strategy: every table carries organization_id.
 * Row-level security (RLS) policies will enforce isolation at
 * the DB layer. The app layer always scopes queries by org.
 */

// ─── Scalar aliases ────────────────────────────────────────────────────────────
// Give semantic meaning to primitive types so refactors are explicit.

type UUID        = string;
type ISODate     = string; // "YYYY-MM-DD"
type ISODateTime = string; // "YYYY-MM-DDTHH:mm:ssZ"
type BRL         = number; // monetary value in BRL, stored as NUMERIC(12,2)

// ─── Enumerations ──────────────────────────────────────────────────────────────

export type UserRole = "admin" | "manager" | "viewer";
// admin   — full access, manage users and settings
// manager — manage all data, cannot change org settings or billing
// viewer  — read-only access to dashboards

export type PlanTier = "free" | "pro" | "enterprise";
// free        — single user, 30-day history
// pro         — up to 10 users, full history, seller module
// enterprise  — unlimited, custom integrations, white-label

// ─── Base mixin ────────────────────────────────────────────────────────────────

interface Timestamps {
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ─── 1. Organizations ──────────────────────────────────────────────────────────
//
// Multi-tenant root. Every other entity belongs to one org.
// slug is used in URLs: app.domain.com/org-slug/dashboard
//
// Index: slug (UNIQUE), plan (for billing queries)

export interface Organization extends Timestamps {
  id:       UUID;
  name:     string;
  slug:     string;
  plan:     PlanTier;
  settings: OrganizationSettings;
}

export interface OrganizationSettings {
  currency:        string; // "BRL" — ISO 4217
  timezone:        string; // "America/Sao_Paulo" — IANA tz
  week_starts_on:  0 | 1; // 0 = Sunday, 1 = Monday
  revenue_label:   string; // "Faturamento" — customizable per org
}

// ─── 2. Users ──────────────────────────────────────────────────────────────────
//
// System users who log in and operate the platform.
// Distinct from Sellers — a seller may not have a login.
//
// Index: email (UNIQUE), (organization_id, role)

export interface User extends Timestamps {
  id:              UUID;
  organization_id: UUID;  // → organizations.id
  email:           string;
  name:            string;
  role:            UserRole;
  last_login_at:   ISODateTime | null;
}

// ─── 3. Sellers ────────────────────────────────────────────────────────────────
//
// Members of the sales team. May or may not have a system login.
// When a seller is deactivated, historical records are preserved.
//
// Index: (organization_id), (organization_id, active)
// Constraint: UNIQUE (organization_id, name)

export interface Seller extends Timestamps {
  id:              UUID;
  organization_id: UUID;     // → organizations.id
  name:            string;
  email:           string | null; // optional — for future self-service login
  active:          boolean;
}

// ─── 4. DailyMetrics ──────────────────────────────────────────────────────────
//
// One row per organization per calendar day.
// Represents the team's consolidated daily result.
// Seller breakdown lives in sales_by_seller.
//
// Constraint: UNIQUE (organization_id, date)
// Index: (organization_id, date DESC) — drives every dashboard query

export interface DailyMetric extends Timestamps {
  id:              UUID;
  organization_id: UUID;     // → organizations.id
  date:            ISODate;  // "2026-05-02"

  // Raw inputs — entered by a user manually
  investment:      BRL;      // total ad spend that day
  leads:           number;   // total leads captured
  sales:           number;   // total sales closed
  revenue:         BRL;      // total revenue generated
  notes:           string;   // free-text observations

  // Audit
  created_by:      UUID;     // → users.id (who entered this record)
}

// ─── 5. SalesBySeller ─────────────────────────────────────────────────────────
//
// Per-seller breakdown for a given day.
// Sums of (leads + sales + revenue) across all sellers for a given
// daily_metric_id should be consistent with the parent DailyMetric totals.
// Validation is enforced at the application layer.
//
// Constraint: UNIQUE (daily_metric_id, seller_id)
// Index: (organization_id, seller_id, date via JOIN)
// organization_id is denormalized here to avoid a JOIN in ranking queries.

export interface SalesBySeller extends Timestamps {
  id:               UUID;
  daily_metric_id:  UUID;     // → daily_metrics.id
  seller_id:        UUID;     // → sellers.id
  organization_id:  UUID;     // → organizations.id (denormalized)

  leads:            number;   // leads attributed to this seller
  sales:            number;   // sales closed by this seller
  revenue:          BRL;      // revenue closed by this seller
}

// ─── 6. Goals ─────────────────────────────────────────────────────────────────
//
// Monthly targets per organization.
// One record per (organization, year, month).
// Weekly targets are derived: weekly_target = monthly_target / weeks_in_month
//
// Constraint: UNIQUE (organization_id, year, month)
// Index: (organization_id, year, month)

export interface Goal extends Timestamps {
  id:                UUID;
  organization_id:   UUID;   // → organizations.id
  year:              number;
  month:             number; // 1–12

  investment_target: BRL;
  leads_target:      number;
  sales_target:      number;
  revenue_target:    BRL;

  created_by:        UUID;   // → users.id
}

// ─── Computed metrics (derived, never stored) ──────────────────────────────────
//
// Always calculated at the application layer from raw inputs.
// Never persist these — they become stale and create inconsistency.

export interface ComputedMetrics {
  cpl:             BRL;    // investment / leads
  conversion_rate: number; // (sales / leads) * 100   — as percentage
  roas:            number; // revenue / investment
  avg_ticket:      BRL;    // revenue / sales
  profit:          BRL;    // revenue - investment
}

// ─── Aggregation shapes ───────────────────────────────────────────────────────
//
// These are the shapes returned by GROUP BY queries, not stored rows.

export interface PeriodSummary extends ComputedMetrics {
  period_start: ISODate;
  period_end:   ISODate;
  investment:   BRL;
  leads:        number;
  sales:        number;
  revenue:      number;
  days_count:   number; // number of records in this period
}

export interface GoalProgress {
  goal:           Goal;
  actual:         PeriodSummary;
  achievement: {
    investment:   number; // actual / target * 100
    leads:        number;
    sales:        number;
    revenue:      number;
  };
}

export interface SellerPeriodStats extends ComputedMetrics {
  seller:       Seller;
  period_start: ISODate;
  period_end:   ISODate;
  leads:        number;
  sales:        number;
  revenue:      BRL;
  rank:         number; // position in ranking by revenue
}

// ─── Mutation payloads ────────────────────────────────────────────────────────
//
// Derive insert/update shapes from the entity interfaces.
// Never define them independently — they must stay in sync.

export type CreateDailyMetric = Omit<DailyMetric, "id" | "created_at" | "updated_at">;
export type UpdateDailyMetric = Partial<Omit<CreateDailyMetric, "organization_id" | "date" | "created_by">>;

export type CreateSalesBySeller = Omit<SalesBySeller, "id" | "created_at" | "updated_at">;
export type UpdateSalesBySeller = Pick<SalesBySeller, "leads" | "sales" | "revenue">;

export type CreateGoal = Omit<Goal, "id" | "created_at" | "updated_at">;
export type UpdateGoal = Pick<Goal, "investment_target" | "leads_target" | "sales_target" | "revenue_target">;

export type CreateSeller = Omit<Seller, "id" | "created_at" | "updated_at">;
export type UpdateSeller = Pick<Seller, "name" | "email" | "active">;

// ─── Repository interface ─────────────────────────────────────────────────────
//
// The contract that any storage adapter (localStorage, REST, Supabase)
// must fulfill. Swap implementations without touching UI components.

export interface DailyMetricRepository {
  list(orgId: UUID, from: ISODate, to: ISODate): Promise<DailyMetric[]>;
  findByDate(orgId: UUID, date: ISODate): Promise<DailyMetric | undefined>;
  upsert(payload: CreateDailyMetric): Promise<DailyMetric>;
  remove(id: UUID): Promise<void>;
}

export interface SellerRepository {
  list(orgId: UUID): Promise<Seller[]>;
  findById(id: UUID): Promise<Seller | undefined>;
  create(payload: CreateSeller): Promise<Seller>;
  update(id: UUID, payload: UpdateSeller): Promise<Seller>;
}

export interface GoalRepository {
  findByMonth(orgId: UUID, year: number, month: number): Promise<Goal | undefined>;
  upsert(payload: CreateGoal): Promise<Goal>;
}
