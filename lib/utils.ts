import { clsx } from "clsx";

export function cn(...inputs: any[]) {
  return clsx(inputs);
}

export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "₹0";
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

