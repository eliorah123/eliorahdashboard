// Core entity — mirrors the future DB schema
export interface DailyEntry {
  id: string;
  date: string;         // ISO date: "2026-05-02"
  investment: number;   // BRL
  leads: number;
  sales: number;
  revenue: number;
  notes: string;
  sellerId?: string;    // responsible seller for the day
  createdAt: string;    // ISO datetime
  updatedAt: string;    // ISO datetime
}

// Computed on the fly, never stored
export interface DailyMetrics {
  cpl: number;            // investment / leads
  conversionRate: number; // (sales / leads) * 100
  roas: number;           // revenue / investment
  avgTicket: number;      // revenue / sales
  profit: number;         // revenue - investment
}

export function computeMetrics(
  investment: number,
  leads: number,
  sales: number,
  revenue: number,
): DailyMetrics {
  return {
    cpl: leads > 0 ? investment / leads : 0,
    conversionRate: leads > 0 ? (sales / leads) * 100 : 0,
    roas: investment > 0 ? revenue / investment : 0,
    avgTicket: sales > 0 ? revenue / sales : 0,
    profit: revenue - investment,
  };
}

// Parse a string that may use either . or , as decimal separator
export function parseCurrency(val: string): number {
  if (!val.trim()) return 0;
  let s = val.replace(/[^0-9,.]/g, "");
  // BR format "1.234,56" → strip dots, swap comma
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

export function parseInteger(val: string): number {
  return parseInt(val.replace(/\D/g, ""), 10) || 0;
}
