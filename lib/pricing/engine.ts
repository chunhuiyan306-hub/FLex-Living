import type {
  FinishGrade,
  PriceLibraryEntry,
  QuotationItem,
  RateTable,
} from "../domain/types";

export interface LineComputation {
  baseList: number;
  qty: number;
  methodFactor: number;
  gradeFactor: number;
  oversizeFactor: number;
  subtotalList: number;
  afterDiscount: number;
  clientPrice: number;
  formulaZh: string;
  formulaEn: string;
}

/** `cnyPerUnit` stores how many CNY one unit of currency is worth (e.g. USD=7.2). */
export function moneyFromCNY(
  amountCNY: number,
  target: RateTable["base"],
  rates: RateTable,
): number {
  const per = rates.cnyPerUnit[target];
  if (!per || per === 0) return amountCNY;
  return amountCNY / per;
}

function billableQty(item: QuotationItem, entry?: PriceLibraryEntry): number {
  if (!entry) return item.qty;
  const method = item.quoteMethod;
  const d = item.dimensionsMm;
  switch (method) {
    case "sqm": {
      const w = d.width ?? 0;
      const h = d.height ?? 0;
      const areaM2 = (w * h) / 1_000_000;
      return Math.max(areaM2, 0) * item.qty;
    }
    case "lm": {
      const run =
        (d.width ?? 0) > 0 ? (d.width ?? 0) / 1000 : (d.height ?? 0) / 1000;
      return Math.max(run, 0) * item.qty;
    }
    default:
      return item.qty;
  }
}

export function oversizedFactor(
  item: QuotationItem,
  entry?: PriceLibraryEntry,
): { factor: number; labels: string[] } {
  if (!entry) return { factor: 1, labels: [] };
  const h = item.dimensionsMm.height ?? 0;
  let factor = 1;
  const labels: string[] = [];
  for (const r of entry.oversizedRules) {
    if (r.heightGt && h > r.heightGt) {
      factor *= r.multiplier;
      labels.push(`${r.labelZh} / ${r.labelEn}`);
    }
  }
  return { factor, labels };
}

export function computeLine(
  item: QuotationItem,
  entry: PriceLibraryEntry | undefined,
  rates: RateTable,
): LineComputation {
  const qtyEff = billableQty(item, entry);
  const unitListCNY = entry?.listPriceCNYPerUnit ?? item.quote_details.listPrice;
  const grade: FinishGrade = item.finishGrade;
  const gradeFactor = entry?.finishGradeFactors[grade] ?? 1;
  const { factor: oversizeFactor, labels } = oversizedFactor(item, entry);

  const baseListLocal = moneyFromCNY(unitListCNY, rates.base, rates);

  const methodFactor =
    item.quote_details.nonStandardMultiplier &&
    item.quote_details.nonStandardConfirmed
      ? item.quote_details.nonStandardMultiplier
      : oversizeFactor;

  const subtotalList = baseListLocal * qtyEff * gradeFactor * methodFactor;

  const disc = item.quote_details.discountPct / 100;
  const afterDiscount = subtotalList * (1 - disc);
  const margin = item.quote_details.marginPct / 100;
  const clientPrice =
    item.quote_details.clientPrice > 0
      ? item.quote_details.clientPrice
      : afterDiscount * (1 + margin);

  const formulaZh = [
    `单价(参考)=${unitListCNY.toFixed(0)} CNY`,
    `数量因子=${qtyEff.toFixed(3)}`,
    `饰面系数=${gradeFactor}`,
    `非标系数=${methodFactor}`,
    `折扣=${item.quote_details.discountPct}%`,
    `毛利=${item.quote_details.marginPct}%`,
    oversizeFactor > 1 ? `触发: ${labels.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const formulaEn = [
    `Ref list=${unitListCNY.toFixed(0)} CNY`,
    `Qty factor=${qtyEff.toFixed(3)}`,
    `Finish factor=${gradeFactor}`,
    `Non-std factor=${methodFactor}`,
    `Disc=${item.quote_details.discountPct}%`,
    `Margin=${item.quote_details.marginPct}%`,
    oversizeFactor > 1 ? `Rules: ${labels.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    baseList: baseListLocal,
    qty: qtyEff,
    methodFactor,
    gradeFactor,
    oversizeFactor,
    subtotalList,
    afterDiscount,
    clientPrice,
    formulaZh,
    formulaEn,
  };
}

export function suggestMethodFactor(
  item: QuotationItem,
  entry?: PriceLibraryEntry,
): number {
  return oversizedFactor(item, entry).factor;
}
