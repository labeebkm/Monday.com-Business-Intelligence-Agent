const CURRENCY_SYMBOLS = ["$", "\u20AC", "\u00A3", "\u00A5"];

export function normalizeNumber(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return isNaN(input) ? null : input;

  let s = input.trim();
  if (!s) return null;

  for (const sym of CURRENCY_SYMBOLS) {
    s = s.replaceAll(sym, "");
  }

  s = s.replace(/,/g, "");

  const n = Number(s);
  return isNaN(n) ? null : n;
}

export function normalizeCurrency(input: string | number | null | undefined): number | null {
  return normalizeNumber(input);
}

export function normalizeDate(input: string | Date | null | undefined): string | null {
  if (!input) return null;

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input.toISOString();
  }

  let s = input.trim();
  if (!s) return null;

  s = s.replace(/[./]/g, "-");

  const monthYearMatch = s.match(/^[A-Za-z]{3,9}\s+\d{4}$/);
  if (monthYearMatch) {
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString();
  }

  return null;
}

export function normalizeStatus(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  return s.toLowerCase();
}

export function normalizeSector(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  return s.toLowerCase();
}

export type NormalizedValue =
  | { kind: "number"; value: number | null }
  | { kind: "currency"; value: number | null }
  | { kind: "date"; value: string | null }
  | { kind: "status"; value: string | null }
  | { kind: "sector"; value: string | null }
  | { kind: "text"; value: string | null };

export type NormalizedColumnValue = {
  id: string;
  title: string;
  type: string;
  rawText: string | null;
  rawValue: string | null;
  normalized: NormalizedValue;
};

export type NormalizedItem = {
  id: string;
  name: string;
  groupTitle: string | null;
  columns: NormalizedColumnValue[];
};

export type NormalizationSummary = {
  totalItems: number;
  totalColumns: number;
  nullValues: number;
  normalizedNumbers: number;
  normalizedDates: number;
  normalizedStatuses: number;
};

export function normalizeColumnValue(args: {
  id: string;
  title: string;
  type: string;
  text: string | null;
  value: string | null;
}): NormalizedColumnValue {
  const { id, title, type, text, value } = args;
  const rawText = text ?? null;
  const rawValue = value ?? null;

  const lowerTitle = title.toLowerCase();
  const lowerType = type.toLowerCase();

  let normalized: NormalizedValue;

  if (lowerType === "numbers" || lowerTitle.includes("value") || lowerTitle.includes("amount")) {
    normalized = { kind: "currency", value: normalizeCurrency(rawText ?? rawValue) };
  } else if (lowerType === "date" || lowerTitle.includes("date")) {
    normalized = { kind: "date", value: normalizeDate(rawText ?? rawValue ?? undefined) };
  } else if (
    lowerType === "status" ||
    lowerTitle.includes("status") ||
    lowerTitle.includes("stage")
  ) {
    normalized = { kind: "status", value: normalizeStatus(rawText ?? rawValue) };
  } else if (lowerTitle.includes("sector") || lowerTitle.includes("industry")) {
    normalized = { kind: "sector", value: normalizeSector(rawText ?? rawValue) };
  } else {
    normalized = { kind: "text", value: rawText ?? rawValue };
  }

  return {
    id,
    title,
    type,
    rawText,
    rawValue,
    normalized
  };
}

export function normalizeItems(items: {
  id: string;
  name: string;
  group: { title: string } | null;
  column_values: {
    id: string;
    text: string | null;
    value: string | null;
    column: { title: string; type: string };
  }[];
}[]): { normalized: NormalizedItem[]; summary: NormalizationSummary } {
  const normalized: NormalizedItem[] = [];

  const summary: NormalizationSummary = {
    totalItems: items.length,
    totalColumns: 0,
    nullValues: 0,
    normalizedNumbers: 0,
    normalizedDates: 0,
    normalizedStatuses: 0
  };

  for (const item of items) {
    const cols: NormalizedColumnValue[] = [];

    for (const cv of item.column_values) {
      const nc = normalizeColumnValue({
        id: cv.id,
        title: cv.column.title,
        type: cv.column.type,
        text: cv.text,
        value: cv.value
      });

      summary.totalColumns += 1;
      if (nc.rawText === null && nc.rawValue === null) {
        summary.nullValues += 1;
      }

      if (nc.normalized.kind === "currency" || nc.normalized.kind === "number") {
        if (nc.normalized.value !== null) summary.normalizedNumbers += 1;
      } else if (nc.normalized.kind === "date") {
        if (nc.normalized.value !== null) summary.normalizedDates += 1;
      } else if (nc.normalized.kind === "status") {
        if (nc.normalized.value !== null) summary.normalizedStatuses += 1;
      }

      cols.push(nc);
    }

    normalized.push({
      id: item.id,
      name: item.name,
      groupTitle: item.group?.title ?? null,
      columns: cols
    });
  }

  return { normalized, summary };
}

