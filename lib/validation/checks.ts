import type { QuotationItem, RateTable, ValidationIssue } from "../domain/types";
import { findLibraryEntry } from "../catalog/price-library";
import { computeLine, oversizedFactor } from "../pricing/engine";

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
          (it.quoteMethod === "sqm" || it.quoteMethod === "lm")
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
        const entry = findLibraryEntry(it.libraryRuleId);
        if (!it.quote_details.listPrice && !entry) {
          issues.push({
            code: "PRICE",
            severity: "error",
            messageZh: "缺少单价（未匹配价格库且未手动填价）",
            messageEn: "Missing unit price (no library match, no manual price)",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        const { factor } = oversizedFactor(it, entry);
        if (factor > 1 && !it.quote_details.nonStandardConfirmed) {
          issues.push({
            code: "NONSTD",
            severity: "error",
            messageZh: "触发了非标加价规则但未确认",
            messageEn: "Non-standard surcharge not confirmed",
            itemId: it.id,
            spaceId: sp.id,
          });
        }
        if (it.screenshotIds.length === 0) {
          issues.push({
            code: "SHOT",
            severity: "warn",
            messageZh: "未绑定图纸截图",
            messageEn: "No drawing screenshot linked",
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
    const entry = findLibraryEntry(it.libraryRuleId);
    const c = computeLine(it, entry, rates);
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
