/**
 * localStorage adapters — implement the repository contracts from schema.ts.
 *
 * Migration path to a real DB:
 *   1. Create src/lib/db/ with a Supabase/Prisma client.
 *   2. Re-implement every repository using that client,
 *      keeping the same method signatures.
 *   3. Swap the import in every consumer — UI components stay untouched.
 */

import type { DailyEntry } from "@/types/daily-entry";

// ─── Daily entries ─────────────────────────────────────────────────────────────

const ENTRIES_KEY = "jeff:entries:v1";

function readEntries(): DailyEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ENTRIES_KEY) ?? "[]") as DailyEntry[];
  } catch {
    return [];
  }
}

function persistEntries(entries: DailyEntry[]): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export const entryRepository = {
  list(): DailyEntry[] {
    return readEntries().sort((a, b) => b.date.localeCompare(a.date));
  },

  findByDate(date: string): DailyEntry | undefined {
    return readEntries().find((e) => e.date === date);
  },

  upsert(payload: Omit<DailyEntry, "id" | "createdAt" | "updatedAt">): DailyEntry {
    const all = readEntries();
    const now = new Date().toISOString();
    const idx = all.findIndex((e) => e.date === payload.date);

    if (idx >= 0) {
      const updated: DailyEntry = { ...all[idx], ...payload, updatedAt: now };
      all[idx] = updated;
      persistEntries(all);
      return updated;
    }

    const entry: DailyEntry = {
      id: globalThis.crypto?.randomUUID?.() ?? Date.now().toString(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    all.push(entry);
    persistEntries(all);
    return entry;
  },

  // Always inserts a new entry (no date uniqueness constraint)
  create(payload: Omit<DailyEntry, "id" | "createdAt" | "updatedAt">): DailyEntry {
    const all = readEntries();
    const now = new Date().toISOString();
    const entry: DailyEntry = {
      id: globalThis.crypto?.randomUUID?.() ?? Date.now().toString(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    all.push(entry);
    persistEntries(all);
    return entry;
  },

  // Update a specific entry by id
  update(id: string, payload: Partial<Omit<DailyEntry, "id" | "createdAt">>): DailyEntry | null {
    const all = readEntries();
    const now = new Date().toISOString();
    const idx = all.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const updated: DailyEntry = { ...all[idx], ...payload, updatedAt: now };
    all[idx] = updated;
    persistEntries(all);
    return updated;
  },

  // All entries for a given date, newest first
  findAllByDate(date: string): DailyEntry[] {
    return readEntries()
      .filter((e) => e.date === date)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  remove(id: string): void {
    persistEntries(readEntries().filter((e) => e.id !== id));
  },
};

// ─── Monthly goals ─────────────────────────────────────────────────────────────

export interface MonthlyGoal {
  year: number;
  month: number; // 1–12
  revenue: number;
  leads: number;
  sales: number;
}

const GOALS_KEY = "jeff:goals:v1";

function readGoals(): MonthlyGoal[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GOALS_KEY) ?? "[]") as MonthlyGoal[];
  } catch {
    return [];
  }
}

export const goalStorage = {
  list(): MonthlyGoal[] {
    return readGoals().sort((a, b) =>
      b.year !== a.year ? b.year - a.year : b.month - a.month,
    );
  },

  get(year: number, month: number): MonthlyGoal | null {
    return readGoals().find((g) => g.year === year && g.month === month) ?? null;
  },

  upsert(goal: MonthlyGoal): void {
    const all = readGoals().filter(
      (g) => !(g.year === goal.year && g.month === goal.month),
    );
    localStorage.setItem(GOALS_KEY, JSON.stringify([...all, goal]));
  },
};

// ─── Sellers ───────────────────────────────────────────────────────────────────

export type SellerRole = "admin" | "gestor" | "vendedor";

export interface Seller {
  id:        string;
  name:      string;
  active:    boolean;
  role?:     SellerRole;
  createdAt: string;
}

const SELLERS_KEY = "jeff:sellers:v1";

function readSellers(): Seller[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SELLERS_KEY) ?? "[]") as Seller[];
  } catch {
    return [];
  }
}

function persistSellers(sellers: Seller[]): void {
  localStorage.setItem(SELLERS_KEY, JSON.stringify(sellers));
}

export const sellerRepository = {
  list(): Seller[] {
    return readSellers().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  listActive(): Seller[] {
    return readSellers()
      .filter((s) => s.active)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  add(name: string, role: SellerRole = "vendedor"): Seller {
    const seller: Seller = {
      id:        globalThis.crypto?.randomUUID?.() ?? Date.now().toString(),
      name:      name.trim(),
      active:    true,
      role,
      createdAt: new Date().toISOString(),
    };
    persistSellers([...readSellers(), seller]);
    return seller;
  },

  setRole(id: string, role: SellerRole): void {
    persistSellers(
      readSellers().map((s) => (s.id === id ? { ...s, role } : s)),
    );
  },

  rename(id: string, name: string): void {
    persistSellers(
      readSellers().map((s) => (s.id === id ? { ...s, name: name.trim() } : s)),
    );
  },

  toggleActive(id: string): void {
    persistSellers(
      readSellers().map((s) => (s.id === id ? { ...s, active: !s.active } : s)),
    );
  },

  remove(id: string): void {
    persistSellers(readSellers().filter((s) => s.id !== id));
  },
};

// ─── Per-seller daily stats ────────────────────────────────────────────────────

export interface SellerDailyStat {
  sellerId: string;
  date:     string; // ISO date "YYYY-MM-DD"
  sales:    number;
  revenue:  number;
}

const SELLER_STATS_KEY = "jeff:seller-stats:v1";

function readSellerStats(): SellerDailyStat[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SELLER_STATS_KEY) ?? "[]") as SellerDailyStat[];
  } catch {
    return [];
  }
}

export const sellerStatsRepository = {
  // Replace all stats for a given date (full overwrite per day)
  saveDay(date: string, stats: Omit<SellerDailyStat, "date">[]): void {
    const others = readSellerStats().filter((s) => s.date !== date);
    const entries = stats
      .filter((s) => s.sales > 0 || s.revenue > 0)
      .map((s) => ({ ...s, date }));
    localStorage.setItem(SELLER_STATS_KEY, JSON.stringify([...others, ...entries]));
  },

  getDay(date: string): SellerDailyStat[] {
    return readSellerStats().filter((s) => s.date === date);
  },

  // Totals per seller within [from, to] inclusive
  sumRange(from: string, to: string): Map<string, { sales: number; revenue: number }> {
    const result = new Map<string, { sales: number; revenue: number }>();
    for (const s of readSellerStats()) {
      if (s.date < from || s.date > to) continue;
      const prev = result.get(s.sellerId) ?? { sales: 0, revenue: 0 };
      result.set(s.sellerId, {
        sales:   prev.sales   + s.sales,
        revenue: prev.revenue + s.revenue,
      });
    }
    return result;
  },
};

// ─── App settings ──────────────────────────────────────────────────────────────

export interface AppSettings {
  teamName: string;
}

const SETTINGS_KEY   = "jeff:settings:v1";
const SETTINGS_DEFAULT: AppSettings = { teamName: "Sales Pro" };

export const settingsStorage = {
  get(): AppSettings {
    if (typeof window === "undefined") return SETTINGS_DEFAULT;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...SETTINGS_DEFAULT, ...(JSON.parse(raw) as Partial<AppSettings>) } : SETTINGS_DEFAULT;
    } catch {
      return SETTINGS_DEFAULT;
    }
  },

  save(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
};

// ─── Full export / import ──────────────────────────────────────────────────────

export interface FullExport {
  version:     1;
  exportedAt:  string;
  entries:     ReturnType<typeof entryRepository.list>;
  goals:       ReturnType<typeof goalStorage.list>;
  sellers:     ReturnType<typeof sellerRepository.list>;
  sellerStats: SellerDailyStat[];
  settings:    AppSettings;
}

export function exportAll(): FullExport {
  return {
    version:     1,
    exportedAt:  new Date().toISOString(),
    entries:     entryRepository.list(),
    goals:       goalStorage.list(),
    sellers:     sellerRepository.list(),
    sellerStats: (() => {
      if (typeof window === "undefined") return [];
      try {
        return JSON.parse(localStorage.getItem("jeff:seller-stats:v1") ?? "[]") as SellerDailyStat[];
      } catch { return []; }
    })(),
    settings:    settingsStorage.get(),
  };
}

export function importAll(data: FullExport): void {
  if (data.version !== 1) throw new Error("Formato de backup inválido.");
  localStorage.setItem("jeff:entries:v1",      JSON.stringify(data.entries     ?? []));
  localStorage.setItem("jeff:goals:v1",         JSON.stringify(data.goals       ?? []));
  localStorage.setItem("jeff:sellers:v1",       JSON.stringify(data.sellers     ?? []));
  localStorage.setItem("jeff:seller-stats:v1",  JSON.stringify(data.sellerStats ?? []));
  if (data.settings) settingsStorage.save(data.settings);
}

export function clearAll(): void {
  [
    "jeff:entries:v1",
    "jeff:goals:v1",
    "jeff:sellers:v1",
    "jeff:seller-stats:v1",
  ].forEach((k) => localStorage.removeItem(k));
}
