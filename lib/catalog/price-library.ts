import type { PriceLibraryProduct, PriceLibraryRow, QuotationItem } from "../domain/types";
import { XLSX_IMPORTED_PRODUCTS } from "./xlsx-imported-products";

/** 仅使用从「报价文件（无出厂价）.xlsx」生成的价格库；勿在此处混入演示条目，以免与本地持久化数据混淆。 */
export const PRICE_PRODUCTS: PriceLibraryProduct[] = XLSX_IMPORTED_PRODUCTS;

export function getProduct(id?: string): PriceLibraryProduct | undefined {
  if (!id) return undefined;
  return PRICE_PRODUCTS.find((p) => p.id === id);
}

export function getProductByModel(model: string): PriceLibraryProduct | undefined {
  const m = model.trim().toUpperCase();
  return PRICE_PRODUCTS.find((p) => p.model.toUpperCase() === m);
}

/** 与旧代码兼容：列表即产品列表 */
export const PRICE_LIBRARY = PRICE_PRODUCTS;

export function findLibraryEntry(id?: string) {
  return getProduct(id);
}

export function findLibraryEntryBySku(sku: string) {
  return PRICE_PRODUCTS.find((p) => p.model === sku || p.id === sku);
}

export function allRows(): PriceLibraryRow[] {
  return PRICE_PRODUCTS.flatMap((p) => p.rows);
}

export function resolveProduct(
  item: Pick<QuotationItem, "libraryProductId" | "libraryRuleId">,
): PriceLibraryProduct | undefined {
  return getProduct(item.libraryProductId ?? item.libraryRuleId);
}
