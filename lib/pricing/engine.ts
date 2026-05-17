import type {
  DimensionInterval,
  DimensionMm,
  PriceLibraryProduct,
  PriceLibraryRow,
  QuotationItem,
  QuoteMethod,
  RateTable,
} from "../domain/types";

/** 尺寸是否落在区间内（mm）；未填的边界表示不限制。宽为 0 时不参与离散校验之外的可选判失败——由上层保证有尺寸 */
export function dimensionsInInterval(
  w: number,
  h: number,
  d: number,
  iv: DimensionInterval,
): boolean {
  if (iv.discreteWidthsMm?.length) {
    if (!iv.discreteWidthsMm.includes(w)) return false;
  } else {
    if (!inMmRange(w, iv.widthMinMm, iv.widthMaxMm)) return false;
  }
  if (!inMmRange(h, iv.heightMinMm, iv.heightMaxMm)) return false;
  if (!inMmRange(d, iv.depthMinMm, iv.depthMaxMm)) return false;
  return true;
}

function inMmRange(v: number, min?: number, max?: number): boolean {
  if (min !== undefined && v < min) return false;
  if (max !== undefined && v > max) return false;
  return true;
}

function widthDepthOkForRow(
  w: number,
  d: number,
  iv: DimensionInterval,
): boolean {
  if (iv.discreteWidthsMm?.length) {
    return iv.discreteWidthsMm.includes(w);
  }
  return inMmRange(w, iv.widthMinMm, iv.widthMaxMm) &&
    inMmRange(d, iv.depthMinMm, iv.depthMaxMm);
}

/**
 * 匹配价格行：同饰面等级 + 宽高深落在区间；若无精确高度匹配，取「高度上限仍小于实际高度」中上限最大的一档作为单价来源（用于超高后乘非标系数）。
 */
export function matchPriceRow(
  product: PriceLibraryProduct | undefined,
  item: QuotationItem,
): PriceLibraryRow | null {
  if (!product) return null;
  const w = item.dimensionsMm.width ?? 0;
  const h = item.dimensionsMm.height ?? 0;
  const d = item.dimensionsMm.depth ?? product.depthLockedMm ?? 0;
  const effD = product.depthLockedMm ?? d;
  const g = item.finishGrade;

  if (item.libraryRowId) {
    const locked = product.rows.find((r) => r.id === item.libraryRowId);
    if (locked && locked.finishGrade === g) return locked;
  }

  const candidates = product.rows.filter(
    (r) => r.finishGrade === g && widthDepthOkForRow(w, effD, r.interval),
  );
  if (candidates.length === 0) return null;

  const exact = candidates.find((r) =>
    dimensionsInInterval(w, h, effD, r.interval),
  );
  if (exact) return exact;

  let best: PriceLibraryRow | null = null;
  let bestHMax = -1;
  for (const r of candidates) {
    const hMax = r.interval.heightMaxMm;
    if (hMax === undefined) continue;
    if (h > hMax && hMax > bestHMax) {
      bestHMax = hMax;
      best = r;
    }
  }
  return best;
}

export interface BillingDims {
  billWidthMm: number;
  billHeightMm: number;
  billDepthMm: number;
}

export function effectiveBillingDims(
  row: PriceLibraryRow | undefined,
  dims: DimensionMm,
  product?: PriceLibraryProduct,
): BillingDims {
  const w = dims.width ?? 0;
  const h = dims.height ?? 0;
  const d = product?.depthLockedMm ?? dims.depth ?? 0;
  const iv = row?.interval;
  let bw = w;
  let bh = h;
  if (iv?.minBillWidthMm && w > 0 && w < iv.minBillWidthMm)
    bw = iv.minBillWidthMm;
  if (iv?.minBillHeightMm && h > 0 && h < iv.minBillHeightMm)
    bh = iv.minBillHeightMm;
  return { billWidthMm: bw, billHeightMm: bh, billDepthMm: d };
}

export interface NonStandardEval {
  factor: number;
  labelsZh: string[];
  labelsEn: string[];
  requiresSeparateQuote: boolean;
}

export function evaluateNonStandard(
  product: PriceLibraryProduct | undefined,
  dims: DimensionMm,
): NonStandardEval {
  const out: NonStandardEval = {
    factor: 1,
    labelsZh: [],
    labelsEn: [],
    requiresSeparateQuote: false,
  };
  if (!product) return out;
  const h = dims.height ?? 0;
  const dep = dims.depth ?? 0;
  for (const r of product.customRules) {
    if (r.requiresSeparateQuote) {
      if (r.depthGtMm !== undefined && dep > r.depthGtMm) {
        out.requiresSeparateQuote = true;
        out.labelsZh.push(r.labelZh);
        out.labelsEn.push(r.labelEn);
      }
      continue;
    }
    let hit = false;
    if (r.heightGtMm !== undefined && h > r.heightGtMm) hit = true;
    if (r.depthGtMm !== undefined && dep > r.depthGtMm) hit = true;
    if (hit && r.multiplier) {
      out.factor *= r.multiplier;
      out.labelsZh.push(r.labelZh);
      out.labelsEn.push(r.labelEn);
    }
  }
  return out;
}

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
  /** CNY / 计价单位，已匹配行 RRP */
  unitRrpCny: number;
  matchedRow: PriceLibraryRow | null;
}

/** `cnyPerUnit`：1 单位外币合多少 CNY */
export function moneyFromCNY(
  amountCNY: number,
  target: RateTable["base"],
  rates: RateTable,
): number {
  const per = rates.cnyPerUnit[target];
  if (!per || per === 0) return amountCNY;
  return amountCNY / per;
}

function methodForItem(
  item: QuotationItem,
  row: PriceLibraryRow | undefined,
  product: PriceLibraryProduct | undefined,
): QuoteMethod {
  if (item.quoteMethod === "m") return "lm";
  if (item.quoteMethod) return item.quoteMethod;
  return row?.pricingUnit ?? product?.defaultPricingUnit ?? "pc";
}

function billableQty(
  method: QuoteMethod,
  dims: BillingDims,
  qty: number,
): number {
  switch (method) {
    case "sqm": {
      const areaM2 =
        (dims.billWidthMm * dims.billHeightMm) / 1_000_000;
      return Math.max(areaM2, 0) * qty;
    }
    case "lm":
    case "m": {
      const runM = dims.billWidthMm > 0
        ? dims.billWidthMm / 1000
        : dims.billHeightMm / 1000;
      return Math.max(runM, 0) * qty;
    }
    case "set":
    case "pc":
    case "leaf":
      return qty;
    case "custom":
      return 1;
    default:
      return qty;
  }
}

export function computeLine(
  item: QuotationItem,
  product: PriceLibraryProduct | undefined,
  rates: RateTable,
): LineComputation {
  const row = matchPriceRow(product, item);
  const rowOrUndef = row ?? undefined;
  const method = methodForItem(item, rowOrUndef, product);
  const bd = effectiveBillingDims(rowOrUndef, item.dimensionsMm, product);
  const ns = evaluateNonStandard(product, item.dimensionsMm);

  if (method === "custom") {
    const manual =
      item.quote_details.manualLineTotalCny ??
      item.quote_details.clientPrice ??
      0;
    const disc = item.quote_details.discountPct / 100;
    const afterDiscount = manual * (1 - disc);
    const margin = item.quote_details.marginPct / 100;
    const clientPrice =
      item.quote_details.clientPrice > 0 && item.quote_details.clientPrice !== manual
        ? item.quote_details.clientPrice
        : afterDiscount * (1 + margin);
    const formulaZh = [
      "计价方式：自定义总价（Custom）",
      `人工总价：${manual.toFixed(2)} CNY`,
      `折扣=${item.quote_details.discountPct}%`,
      `毛利=${item.quote_details.marginPct}%`,
    ].join("\n");
    const formulaEn = [
      "Method: custom lump sum",
      `Manual total: ${manual.toFixed(2)} CNY`,
      `Disc=${item.quote_details.discountPct}%`,
      `Margin=${item.quote_details.marginPct}%`,
    ].join("\n");
    return {
      baseList: moneyFromCNY(manual, rates.base, rates),
      qty: 1,
      methodFactor: 1,
      gradeFactor: 1,
      oversizeFactor: 1,
      subtotalList: moneyFromCNY(manual, rates.base, rates),
      afterDiscount: moneyFromCNY(afterDiscount, rates.base, rates),
      clientPrice: moneyFromCNY(clientPrice, rates.base, rates),
      formulaZh,
      formulaEn,
      unitRrpCny: manual,
      matchedRow: row,
    };
  }

  const unitRrp =
    row?.rrpCnyPerUnit ?? item.quote_details.listPrice ?? 0;
  const qtyEff = billableQty(method, bd, item.qty);
  const baseListLocal = moneyFromCNY(unitRrp, rates.base, rates);

  const userMult =
    item.quote_details.nonStandardConfirmed &&
    item.quote_details.nonStandardMultiplier
      ? item.quote_details.nonStandardMultiplier
      : undefined;
  const ruleFactor = ns.factor;
  const methodFactor = userMult ?? ruleFactor;

  const subtotalList =
    method === "set" || method === "pc" || method === "leaf"
      ? baseListLocal * item.qty * methodFactor
      : baseListLocal * qtyEff * methodFactor;

  const disc = item.quote_details.discountPct / 100;
  const afterDiscount = subtotalList * (1 - disc);
  const margin = item.quote_details.marginPct / 100;
  const clientPrice =
    item.quote_details.clientPrice > 0
      ? moneyFromCNY(item.quote_details.clientPrice, rates.base, rates)
      : afterDiscount * (1 + margin);

  const { formulaZh, formulaEn } = buildFormulaVerbose({
    item,
    product,
    row,
    method,
    bd,
    qtyEff,
    unitRrp,
    ns,
    methodFactor,
  });

  return {
    baseList: baseListLocal,
    qty: qtyEff,
    methodFactor,
    gradeFactor: 1,
    oversizeFactor: ruleFactor,
    subtotalList,
    afterDiscount,
    clientPrice,
    formulaZh,
    formulaEn,
    unitRrpCny: unitRrp,
    matchedRow: row,
  };
}

function buildFormulaVerbose(p: {
  item: QuotationItem;
  product: PriceLibraryProduct | undefined;
  row: PriceLibraryRow | null;
  method: QuoteMethod;
  bd: BillingDims;
  qtyEff: number;
  unitRrp: number;
  ns: NonStandardEval;
  methodFactor: number;
}): { formulaZh: string; formulaEn: string } {
  const { item, product, row, method, bd, qtyEff, unitRrp, ns, methodFactor } =
    p;
  const names = row
    ? `${product?.productNameZh ?? ""} ${product?.model ?? ""}`.trim()
    : `${item.nameZh} ${item.sku}`.trim();
  const unitLabel =
    method === "sqm"
      ? "元/㎡"
      : method === "lm" || method === "m"
        ? "元/延米"
        : method === "leaf"
          ? "元/扇"
          : method === "set"
            ? "元/套"
            : "元/件";

  const linesZh: string[] = [];
  const linesEn: string[] = [];
  linesZh.push(`产品：${names}`);
  linesEn.push(`Product: ${product?.productNameEn ?? item.nameEn} ${product?.model ?? item.sku}`);
  linesZh.push(
    `尺寸：高 ${bd.billHeightMm}mm × 宽 ${bd.billWidthMm}mm × 深 ${bd.billDepthMm}mm`,
  );
  linesEn.push(
    `Size: H ${bd.billHeightMm} × W ${bd.billWidthMm} × D ${bd.billDepthMm} mm`,
  );
  linesZh.push(`计价单位：${methodLabelZh(method)}`);
  linesEn.push(`Unit: ${methodLabelEn(method)}`);
  linesZh.push(`饰面等级：${item.finishGrade}`);
  linesEn.push(`Finish grade: ${item.finishGrade}`);
  if (row) {
    linesZh.push(
      `饰面说明：${row.finishDescriptionZh}`,
    );
    linesEn.push(`Finish: ${row.finishDescriptionEn}`);
    linesZh.push(`匹配区间：${row.interval.labelZh}`);
    linesEn.push(`Matched band: ${row.interval.labelEn}`);
  } else {
    linesZh.push("匹配区间：未命中价格表（自定义单价 / 待审核）");
    linesEn.push("Matched band: none (manual / pending review)");
  }
  linesZh.push(`单价：${unitRrp.toFixed(0)} ${unitLabel}`);
  linesEn.push(`Unit price: ${unitRrp.toFixed(0)} CNY / unit`);

  if (method === "sqm") {
    const m2 = qtyEff / (item.qty || 1);
    linesZh.push(
      `计价面积：${(bd.billHeightMm / 1000).toFixed(2)} × ${(bd.billWidthMm / 1000).toFixed(2)} = ${m2.toFixed(2)}㎡`,
    );
    linesEn.push(
      `Billable area: ${(bd.billHeightMm / 1000).toFixed(2)} × ${(bd.billWidthMm / 1000).toFixed(2)} = ${m2.toFixed(2)} m²`,
    );
  }

  const baseCny =
    method === "sqm"
      ? qtyEff * unitRrp
      : method === "lm" || method === "m"
        ? qtyEff * unitRrp
        : item.qty * unitRrp;

  if (ns.requiresSeparateQuote) {
    linesZh.push(`注意：${ns.labelsZh.join("；")}（需另外报价）`);
    linesEn.push(`Note: ${ns.labelsEn.join("; ")} — separate quotation`);
  }

  if (methodFactor > 1.0001) {
    linesZh.push(`触发规则：${ns.labelsZh.join("；")}`);
    linesZh.push(`基础金额：${baseCny.toFixed(2)} 元`);
    linesZh.push(
      `非标后金额：${baseCny.toFixed(2)} × ${methodFactor} = ${(baseCny * methodFactor).toFixed(2)} 元`,
    );
    linesEn.push(`Rules: ${ns.labelsEn.join("; ")}`);
    linesEn.push(`Base: ${baseCny.toFixed(2)} CNY`);
    linesEn.push(
      `After non-std: ${baseCny.toFixed(2)} × ${methodFactor} = ${(baseCny * methodFactor).toFixed(2)} CNY`,
    );
  } else {
    linesZh.push(
      `小计：${method === "sqm" || method === "lm" || method === "m" ? `${qtyEff.toFixed(2)} × ${unitRrp}` : `${item.qty} × ${unitRrp}`} = ${baseCny.toFixed(2)} 元（未含折扣/毛利）`,
      
    );
    linesEn.push(`Subtotal before disc/margin: ${baseCny.toFixed(2)} CNY`);
  }

  linesZh.push(
    `折扣=${item.quote_details.discountPct}% · 毛利=${item.quote_details.marginPct}%`,
  );
  linesEn.push(
    `Disc=${item.quote_details.discountPct}% · Margin=${item.quote_details.marginPct}%`,
  );

  return { formulaZh: linesZh.join("\n"), formulaEn: linesEn.join("\n") };
}

function methodLabelZh(m: QuoteMethod): string {
  switch (m) {
    case "sqm":
      return "平方米";
    case "lm":
    case "m":
      return "延米";
    case "set":
      return "套";
    case "pc":
      return "件";
    case "leaf":
      return "扇";
    default:
      return m;
  }
}

function methodLabelEn(m: QuoteMethod): string {
  switch (m) {
    case "sqm":
      return "m²";
    case "lm":
    case "m":
      return "linear m";
    case "set":
      return "set";
    case "pc":
      return "piece";
    case "leaf":
      return "leaf";
    default:
      return String(m);
  }
}

export function suggestMethodFactor(
  item: QuotationItem,
  product?: PriceLibraryProduct,
): number {
  return evaluateNonStandard(product, item.dimensionsMm).factor;
}
