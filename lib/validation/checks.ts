import type { QuotationItem, RateTable, ValidationIssue } from "../domain/types";
import { matchPriceRow, computeLine, evaluateNonStandard } from "../pricing/engine";
import { resolveProduct } from "../catalog/price-library";

function itemHasDims(item: QuotationItem): boolean {
  const d = item.dimensionsMm;
  return Boolean(d.width || d.height || d.depth);
}

export function validateRevision(rev: {
  rates: RateTable;
  levels: {
    spaces: { id: string; nameZh: string; items: QuotationItem[] }[];
  }[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cny = rev.rates.cnyPerUnit[rev.rates.base];
  if (!cny || cny <= 0) {
    issues.push({
      code: "RATE",
      severity: "error",
      messageZh: "当前币种汇率未设置或无效",
      messageEn: "Exchange rate for active currency is missing or invalid",
    });
  }

  for (const level of rev.levels) {
    for (const sp of level.spaces) {
      if (sp.items.length === 0) {
        issues.push({
          code: "EMPTY_SPACE",
          severity: "warn",
          messageZh: `空间尚无报价项：${sp.nameZh}`,
          messageEn: "Space has no line items yet",
          spaceId: sp.id,
        });
      }
      for (const it of sp.items) {
        if (it.qty <= 0) {
          issues.push({
            code: "QTY",
            severity: "warn",
            messageZh: "数量为 0",
            messageEn: "Quantity is zero",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        if (
          !itemHasDims(it) &&
          (it.quoteMethod === "sqm" ||
            it.quoteMethod === "lm" ||
            it.quoteMethod === "m")
        ) {
          issues.push({
            code: "DIM",
            severity: "error",
            messageZh: "按面积/延米计价的条目缺少尺寸",
            messageEn: "Area/linear item missing dimensions",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        const prod = resolveProduct(it);
        const row = matchPriceRow(prod, it);
        const manual = it.isManualPrice || it.quoteMethod === "custom";
        if (!row && !manual && (it.quote_details.listPrice ?? 0) <= 0) {
          issues.push({
            code: "PRICE",
            severity: "error",
            messageZh: "未命中价格表区间且未填单价（自定义/补价）",
            messageEn: "No price band match and no manual unit price",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        const ns = evaluateNonStandard(prod, it.dimensionsMm);
        if (ns.factor > 1 && !it.quote_details.nonStandardConfirmed) {
          issues.push({
            code: "NONSTD",
            severity: "error",
            messageZh: "触发了非标加价规则但未确认",
            messageEn: "Non-standard surcharge not confirmed",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        if (ns.requiresSeparateQuote) {
          issues.push({
            code: "SEPARATE_QUOTE",
            severity: "error",
            messageZh: "尺寸触发「需另外报价」规则，请人工确认或拆分报价",
            messageEn: "Dimension triggers separate-quotation rule; confirm or split line",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        if (it.needReview) {
          issues.push({
            code: "NEED_REVIEW",
            severity: "warn",
            messageZh: "存在待审核报价项（自定义价格或未匹配区间）",
            messageEn: "Line pending review (manual price or no band match)",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        if (it.isManualPrice && !(it.overrideReason?.trim())) {
          issues.push({
            code: "MANUAL_REASON",
            severity: "warn",
            messageZh: "自定义/补价建议填写原因，便于审核",
            messageEn: "Manual price should include a reason for audit",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        if ((it.screenshotIds?.length ?? 0) === 0 && (it.productImages?.length ?? 0) === 0) {
          issues.push({
            code: "SHOT",
            severity: "warn",
            messageZh: "未绑定图纸或产品图片",
            messageEn: "No drawings or product images linked",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        const overrides = it.cost_details.manualPriceOverrides ?? [];
        for (const o of overrides) {
          if (!o.reason?.trim()) {
            issues.push({
              code: "OVERRIDE_REASON",
              severity: "error",
              messageZh: "手工改价缺少原因说明",
              messageEn: "Manual price change without reason",
              itemId: it.id,
              spaceId: sp.id,
            });
          }
        }
      }
    }
  }
  return issues;
}

export function flattenRevisionItems(rev: {
  levels: { spaces: { items: QuotationItem[] }[] }[];
}): QuotationItem[] {
  return rev.levels.flatMap((l) => l.spaces.flatMap((s) => s.items));
}

export function revisionTotals(
  items: QuotationItem[],
  rates: RateTable,
): { client: number; list: number } {
  let client = 0;
  let list = 0;
  for (const it of items) {
    const prod = resolveProduct(it);
    const c = computeLine(it, prod, rates);
    client += c.clientPrice;
    list += c.subtotalList;
  }
  return { client, list };
}

export interface RevisionDiff {
  addedItemIds: string[];
  removedItemIds: string[];
  spaceDelta: Array<{
    spaceId: string;
    label: string;
    deltaClient: number;
  }>;
  totalDeltaClient: number;
}

export function diffRevisions(
  prev: {
    levels: { spaces: { id: string; nameZh: string; items: QuotationItem[] }[] }[];
  },
  next: {
    levels: { spaces: { id: string; nameZh: string; items: QuotationItem[] }[] }[];
  },
  rates: RateTable,
): RevisionDiff {
  const prevItems = new Map<string, QuotationItem>();
  const nextItems = new Map<string, QuotationItem>();
  const spacePrev = new Map<string, number>();
  const spaceNext = new Map<string, { label: string; total: number }>();

  for (const l of prev.levels) {
    for (const s of l.spaces) {
      for (const it of s.items) prevItems.set(it.id, it);
      spacePrev.set(
        s.id,
        revisionTotals(s.items, rates).client,
      );
    }
  }
  for (const l of next.levels) {
    for (const s of l.spaces) {
      for (const it of s.items) nextItems.set(it.id, it);
      spaceNext.set(s.id, {
        label: s.nameZh,
        total: revisionTotals(s.items, rates).client,
      });
    }
  }

  const addedItemIds: string[] = [];
  const removedItemIds: string[] = [];
  for (const id of nextItems.keys()) if (!prevItems.has(id)) addedItemIds.push(id);
  for (const id of prevItems.keys()) if (!nextItems.has(id)) removedItemIds.push(id);

  const spaceIds = new Set([...spacePrev.keys(), ...spaceNext.keys()]);
  const spaceDelta: RevisionDiff["spaceDelta"] = [];
  for (const sid of spaceIds) {
    const a = spacePrev.get(sid) ?? 0;
    const b = spaceNext.get(sid)?.total ?? 0;
    const d = b - a;
    if (Math.abs(d) > 0.0001) {
      spaceDelta.push({
        spaceId: sid,
        label: spaceNext.get(sid)?.label ?? sid,
        deltaClient: d,
      });
    }
  }

  const totalPrev = revisionTotals([...prevItems.values()], rates).client;
  const totalNext = revisionTotals([...nextItems.values()], rates).client;

  return {
    addedItemIds,
    removedItemIds,
    spaceDelta,
    totalDeltaClient: totalNext - totalPrev,
  };
}
