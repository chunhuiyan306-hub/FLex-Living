import type { DimensionMm, MeasureUnit } from "./types";

const INCH_MM = 25.4;
const FT_MM = 304.8;

export function toMm(value: number, unit: MeasureUnit): number {
  switch (unit) {
    case "mm":
      return value;
    case "cm":
      return value * 10;
    case "m":
      return value * 1000;
    case "inch":
      return value * INCH_MM;
    case "ft":
      return value * FT_MM;
    default:
      return value;
  }
}

export function parseDimsFromText(text: string): Partial<DimensionMm> | null {
  const normalized = text.replace(/×/g, "x").replace(/＊/g, "*");
  const m = normalized.match(
    /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|ft|'|")?(?:\s*[x*]\s*|\s+)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|ft|'|")?/i,
  );
  if (!m) return null;
  const u1 = normalizeUnitToken(m[2]);
  const u2 = normalizeUnitToken(m[4]);
  const unit: MeasureUnit = u1 ?? u2 ?? "mm";
  const w = toMm(parseFloat(m[1]), unit);
  const h = toMm(parseFloat(m[3]), unit);
  return { width: Math.round(w), height: Math.round(h) };
}

function normalizeUnitToken(t?: string): MeasureUnit | null {
  if (!t) return null;
  const s = t.toLowerCase();
  if (s === "mm") return "mm";
  if (s === "cm") return "cm";
  if (s === "m") return "m";
  if (s === "in" || s === "inch" || s === '"') return "inch";
  if (s === "ft" || s === "'") return "ft";
  return null;
}
