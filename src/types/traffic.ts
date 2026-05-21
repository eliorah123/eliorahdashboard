export type TrafficPeriod = "7d" | "30d" | "90d";

export interface TrafficPoint {
  date: string;
  leads: number;
  investment: number;
  cpl: number;
  sales: number;
  mqls: number;
  revenue: number;
  prevLeads: number;
  goalLeads: number;
}

export interface TrafficKPIs {
  investment: number;
  leads: number;
  cpl: number;
  cpm: number;
  ctr: number;
  mqls: number;
  qualificationRate: number;
  conversionToSales: number;
  revenue: number;
  cac: number;
  roas: number;
  roi: number;
  trends: {
    investment: number;
    leads: number;
    cpl: number;
    cpm: number;
    ctr: number;
    mqls: number;
    qualificationRate: number;
    conversionToSales: number;
    revenue: number;
    cac: number;
    roas: number;
    roi: number;
  };
}

export type LeadSource = "facebook" | "instagram" | "google" | "organico";
export type LeadQuality = "mql" | "nao_qualificado" | "convertido";

export interface LeadRecord {
  id: string;
  dateISO: string;
  date: string;
  source: LeadSource;
  quality: LeadQuality;
  cpl: number;
}

export type InsightSentiment = "positive" | "negative" | "neutral" | "warning";

export interface TrafficInsight {
  id: string;
  type: InsightSentiment;
  title: string;
  description: string;
  change?: number;
}
