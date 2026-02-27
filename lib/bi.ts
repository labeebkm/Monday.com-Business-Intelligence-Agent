import type { NormalizedItem } from "./normalize";

export type QuarterFilter = {
  year: number;
  quarter: number;
};

export type BIQueryFilters = {
  sector?: string;
  quarter?: QuarterFilter;
  status?: string;
};

export type PipelineMetrics = {
  totalDeals: number;
  totalRevenue: number;
  averageDealSize: number;
  stageCounts: Record<string, number>;
  closedDealsCount: number;
  openDealsCount: number;
};

export type PipelineMetricsResult = {
  metrics: PipelineMetrics;
  filteredCount: number;
};

const SECTOR_ALIASES: Record<string, string[]> = {
  energy: ["energy", "oil", "gas", "renewable", "utilities", "solar", "wind"],
  healthcare: ["healthcare", "health care", "medical", "pharma", "biotech"],
  technology: ["technology", "tech", "software", "saas"],
  finance: ["finance", "financial", "fintech", "banking"],
  manufacturing: ["manufacturing", "industrial"],
  retail: ["retail", "ecommerce", "e-commerce", "consumer"],
  logistics: ["logistics", "transport", "transportation", "supply chain"],
  "real estate": ["real estate", "property", "proptech"],
  education: ["education", "edtech"],
  telecom: ["telecom", "telecommunications"],
  agriculture: ["agriculture", "agri", "farming"],
  hospitality: ["hospitality", "travel", "hotel", "tourism"],
  media: ["media", "advertising", "adtech"],
  automotive: ["automotive", "auto"]
};

const STATUS_PATTERNS: Array<{ canonical: string; regex: RegExp }> = [
  {
    canonical: "closed",
    regex: /\b(closed|closed won|closed lost|won|lost|complete|completed|done)\b/i
  },
  {
    canonical: "open",
    regex: /\b(open|active|in progress|ongoing|pipeline)\b/i
  },
  { canonical: "proposal", regex: /\b(proposal|proposed)\b/i },
  { canonical: "negotiation", regex: /\b(negotiation|negotiating)\b/i },
  { canonical: "qualified", regex: /\b(qualified|qualification)\b/i }
];

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeYear(yearRaw: string): number {
  const parsed = Number(yearRaw);
  if (!Number.isFinite(parsed)) return new Date().getUTCFullYear();
  if (yearRaw.length === 2) return 2000 + parsed;
  return parsed;
}

function getCurrentQuarter(): QuarterFilter {
  const now = new Date();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  return {
    year: now.getUTCFullYear(),
    quarter
  };
}

function getPreviousQuarter(): QuarterFilter {
  const current = getCurrentQuarter();
  if (current.quarter === 1) {
    return { year: current.year - 1, quarter: 4 };
  }
  return { year: current.year, quarter: current.quarter - 1 };
}

function detectSector(query: string): string | undefined {
  for (const [canonical, aliases] of Object.entries(SECTOR_ALIASES)) {
    for (const alias of aliases) {
      const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
      if (pattern.test(query)) return canonical;
    }
  }
  return undefined;
}

function detectQuarter(query: string): QuarterFilter | undefined {
  if (/\bthis quarter\b/i.test(query)) return getCurrentQuarter();
  if (/\blast quarter\b/i.test(query)) return getPreviousQuarter();

  const qYearMatch = query.match(/\bq([1-4])\s*'?\s*(\d{2,4})\b/i);
  if (qYearMatch) {
    return {
      quarter: Number(qYearMatch[1]),
      year: normalizeYear(qYearMatch[2])
    };
  }

  const qOnlyMatch = query.match(/\bq([1-4])\b/i);
  if (qOnlyMatch) {
    return {
      quarter: Number(qOnlyMatch[1]),
      year: getCurrentQuarter().year
    };
  }

  const yearQMatch = query.match(/\b(\d{4})\s*q([1-4])\b/i);
  if (yearQMatch) {
    return {
      year: Number(yearQMatch[1]),
      quarter: Number(yearQMatch[2])
    };
  }

  const quarterYearMatch = query.match(/\bquarter\s*([1-4])(?:\s+(\d{4}))?\b/i);
  if (quarterYearMatch) {
    return {
      quarter: Number(quarterYearMatch[1]),
      year: quarterYearMatch[2]
        ? Number(quarterYearMatch[2])
        : getCurrentQuarter().year
    };
  }

  const ordinalQuarterMatch = query.match(
    /\b([1-4])(?:st|nd|rd|th)?\s+quarter(?:\s+(\d{4}))?\b/i
  );
  if (ordinalQuarterMatch) {
    return {
      quarter: Number(ordinalQuarterMatch[1]),
      year: ordinalQuarterMatch[2]
        ? Number(ordinalQuarterMatch[2])
        : getCurrentQuarter().year
    };
  }

  return undefined;
}

function detectStatus(query: string): string | undefined {
  for (const entry of STATUS_PATTERNS) {
    if (entry.regex.test(query)) return entry.canonical;
  }
  return undefined;
}

function matchesText(haystack: string, needle: string): boolean {
  const normalizedHaystack = normalizeText(haystack);
  const normalizedNeedle = normalizeText(needle);
  return (
    normalizedHaystack.includes(normalizedNeedle) ||
    normalizedNeedle.includes(normalizedHaystack)
  );
}

function getQuarterFromDate(dateIso: string): QuarterFilter | null {
  const dt = new Date(dateIso);
  if (isNaN(dt.getTime())) return null;
  return {
    year: dt.getUTCFullYear(),
    quarter: Math.floor(dt.getUTCMonth() / 3) + 1
  };
}

function getItemDateQuarter(item: NormalizedItem): QuarterFilter | null {
  const dateColumns = item.columns
    .filter(
      (col): col is typeof col & { normalized: { kind: "date"; value: string } } =>
        col.normalized.kind === "date" && col.normalized.value !== null
    )
    .sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aScore = Number(aTitle.includes("close")) * 3 + Number(aTitle.includes("date"));
      const bScore = Number(bTitle.includes("close")) * 3 + Number(bTitle.includes("date"));
      return bScore - aScore;
    });

  for (const col of dateColumns) {
    const quarter = getQuarterFromDate(col.normalized.value);
    if (quarter) return quarter;
  }

  return null;
}

function getItemStatus(item: NormalizedItem): string | null {
  const statusColumn = item.columns.find(
    (col): col is typeof col & { normalized: { kind: "status"; value: string } } =>
      col.normalized.kind === "status" && col.normalized.value !== null
  );

  if (statusColumn?.normalized.value) return normalizeText(statusColumn.normalized.value);
  if (item.groupTitle) return normalizeText(item.groupTitle);
  return null;
}

function isClosedStatus(status: string | null): boolean {
  if (!status) return false;
  return /\b(closed|won|lost|complete|completed|done|cancelled|canceled)\b/i.test(status);
}

function isRevenueColumnTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes("value") ||
    t.includes("amount") ||
    t.includes("revenue") ||
    t.includes("deal size") ||
    t.includes("arr") ||
    t.includes("mrr") ||
    t.includes("acv") ||
    t.includes("tcv") ||
    t.includes("contract")
  );
}

function getItemRevenue(item: NormalizedItem): number {
  const numberColumns = item.columns.filter(
    (col): col is typeof col & { normalized: { kind: "number" | "currency"; value: number } } =>
      (col.normalized.kind === "number" || col.normalized.kind === "currency") &&
      col.normalized.value !== null
  );

  if (!numberColumns.length) return 0;

  const preferred = numberColumns.find((col) => isRevenueColumnTitle(col.title));
  return preferred ? preferred.normalized.value : numberColumns[0].normalized.value;
}

function matchesSector(item: NormalizedItem, sector: string): boolean {
  const sectors = item.columns
    .filter(
      (col): col is typeof col & { normalized: { kind: "sector"; value: string } } =>
        col.normalized.kind === "sector" && col.normalized.value !== null
    )
    .map((col) => col.normalized.value);

  if (!sectors.length) return false;
  return sectors.some((value) => matchesText(value, sector));
}

function matchesQuarter(item: NormalizedItem, quarter: QuarterFilter): boolean {
  const itemQuarter = getItemDateQuarter(item);
  if (!itemQuarter) return false;
  return itemQuarter.year === quarter.year && itemQuarter.quarter === quarter.quarter;
}

function matchesStatus(item: NormalizedItem, status: string): boolean {
  const itemStatus = getItemStatus(item);
  if (!itemStatus) return false;
  return matchesText(itemStatus, status);
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function extractFiltersFromQuery(query: string): BIQueryFilters {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return {};

  const sector = detectSector(normalizedQuery);
  const quarter = detectQuarter(normalizedQuery);
  const status = detectStatus(normalizedQuery);

  return {
    ...(sector ? { sector } : {}),
    ...(quarter ? { quarter } : {}),
    ...(status ? { status } : {})
  };
}

export function computePipelineMetrics(
  items: NormalizedItem[],
  filters: BIQueryFilters = {}
): PipelineMetricsResult {
  const filteredItems = items.filter((item) => {
    if (filters.sector && !matchesSector(item, filters.sector)) return false;
    if (filters.quarter && !matchesQuarter(item, filters.quarter)) return false;
    if (filters.status && !matchesStatus(item, filters.status)) return false;
    return true;
  });

  const stageCounts: Record<string, number> = {};
  let totalRevenue = 0;
  let closedDealsCount = 0;

  for (const item of filteredItems) {
    totalRevenue += getItemRevenue(item);

    const stage = getItemStatus(item) ?? "unknown";
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;

    if (isClosedStatus(stage)) {
      closedDealsCount += 1;
    }
  }

  const totalDeals = filteredItems.length;
  const openDealsCount = totalDeals - closedDealsCount;

  return {
    metrics: {
      totalDeals,
      totalRevenue: roundCurrency(totalRevenue),
      averageDealSize: totalDeals ? roundCurrency(totalRevenue / totalDeals) : 0,
      stageCounts,
      closedDealsCount,
      openDealsCount
    },
    filteredCount: totalDeals
  };
}
