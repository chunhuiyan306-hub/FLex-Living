import type { PriceLibraryProduct, PriceLibraryRow, QuotationItem } from "../domain/types";
import { XLSX_IMPORTED_PRODUCTS } from "./xlsx-imported-products";

function row(
  productId: string,
  partial: Omit<PriceLibraryRow, "productId">,
): PriceLibraryRow {
  return { ...partial, productId };
}

/** 护墙板 HQB030 示例：区间 + 饰面行固定单价 */
const hqb030: PriceLibraryProduct = {
  id: "hqb030",
  system: "wall_panel",
  categoryZh: "护墙板",
  categoryEn: "Wall Paneling",
  productNameZh: "护墙板",
  productNameEn: "Wall Panel",
  model: "HQB030",
  defaultPricingUnit: "sqm",
  exclusionZh: "不含基层找平及异地小单加急费",
  exclusionEn: "Excludes substrate leveling & small-lot surcharges",
  notesZh: "导轨、五金、灯光另计",
  notesEn: "Tracks, hardware & lighting priced separately",
  customRules: [
    {
      id: "hqb-h3000",
      labelZh: "高度 > 3000mm，非标系数 1.3",
      labelEn: "Height >3000mm, factor ×1.3",
      heightGtMm: 3000,
      multiplier: 1.3,
    },
  ],
  rows: [
    row("hqb030", {
      id: "hqb030-h24-w10",
      interval: {
        id: "int-h24",
        labelZh: "高≤2400；宽≤1000",
        labelEn: "H≤2400; W≤1000",
        heightMaxMm: 2400,
        widthMaxMm: 1000,
      },
      finishGrade: "A",
      finishDescriptionZh: "天然木皮 / FENIX 肤感（A 档）",
      finishDescriptionEn: "Natural veneer / FENIX (Grade A)",
      pricingUnit: "sqm",
      rrpCnyPerUnit: 3890,
    }),
    row("hqb030", {
      id: "hqb030-a-18-30",
      interval: {
        id: "int-18-30-w",
        labelZh: "1800≤高≤3000，500≤宽≤1200",
        labelEn: "1800≤H≤3000, 500≤W≤1200",
        heightMinMm: 1800,
        heightMaxMm: 3000,
        widthMinMm: 500,
        widthMaxMm: 1200,
      },
      finishGrade: "A",
      finishDescriptionZh: "天然木皮 / FENIX 肤感（A 档）",
      finishDescriptionEn: "Natural veneer / FENIX (Grade A)",
      pricingUnit: "sqm",
      rrpCnyPerUnit: 4130,
      suggestedTransactionCnyPerUnit: 3900,
      factoryCnyPerUnit: 2600,
    }),
    row("hqb030", {
      id: "hqb030-b-18-30",
      interval: {
        id: "int-18-30-w-b",
        labelZh: "1800≤高≤3000，500≤宽≤1200",
        labelEn: "1800≤H≤3000, 500≤W≤1200",
        heightMinMm: 1800,
        heightMaxMm: 3000,
        widthMinMm: 500,
        widthMaxMm: 1200,
      },
      finishGrade: "B",
      finishDescriptionZh: "PET / 皮革 / 亚麻布（B 档）",
      finishDescriptionEn: "PET / leather / linen (Grade B)",
      pricingUnit: "sqm",
      rrpCnyPerUnit: 3580,
    }),
  ],
};

const doorConcealed: PriceLibraryProduct = {
  id: "door-concealed",
  system: "door",
  categoryZh: "隐框门",
  categoryEn: "Concealed Frame Door",
  productNameZh: "隐框通顶门",
  productNameEn: "Concealed Frame Full-height Door",
  model: "DR-CVL",
  defaultPricingUnit: "leaf",
  exclusionZh: "不含智能锁、进口五金升级",
  exclusionEn: "Excludes smart lock / imported hardware upgrades",
  depthLockedMm: 100,
  notesZh: "深度按工厂标准，不支持定制",
  notesEn: "Depth is factory standard; not customizable",
  customRules: [
    {
      id: "dr-h3000",
      labelZh: "高度 > 3000mm，×1.3",
      labelEn: "Height >3000mm ×1.3",
      heightGtMm: 3000,
      multiplier: 1.3,
    },
    {
      id: "dr-d400",
      labelZh: "墙厚 > 400mm，需另外报价",
      labelEn: "Wall thickness >400mm — separate quotation",
      depthGtMm: 400,
      requiresSeparateQuote: true,
    },
  ],
  rows: [
    row("door-concealed", {
      id: "dr-cvl-a",
      interval: {
        id: "dr-std",
        labelZh: "标准门扇区间（示例）",
        labelEn: "Standard leaf band (sample)",
        heightMinMm: 2100,
        heightMaxMm: 3000,
        widthMinMm: 700,
        widthMaxMm: 1100,
      },
      finishGrade: "A",
      finishDescriptionZh: "铝木饰面 A 档",
      finishDescriptionEn: "Alu-wood finish Grade A",
      pricingUnit: "leaf",
      rrpCnyPerUnit: 12800,
    }),
  ],
};

const wardrobe: PriceLibraryProduct = {
  id: "wardrobe-carcass",
  system: "cabinet",
  categoryZh: "柜体",
  categoryEn: "Cabinetry",
  productNameZh: "衣柜柜体（颗粒板柜体）",
  productNameEn: "Wardrobe Carcass",
  model: "WD-CARC",
  defaultPricingUnit: "sqm",
  exclusionZh: "不含龙头、台盆、电器、收纳小配件",
  exclusionEn:
    "Excludes faucets, basins, appliances, loose storage accessories",
  customRules: [
    {
      id: "wd-h2800",
      labelZh: "高度 > 2800mm，×1.15",
      labelEn: "Height >2800mm ×1.15",
      heightGtMm: 2800,
      multiplier: 1.15,
    },
  ],
  rows: [
    row("wardrobe-carcass", {
      id: "wd-carc-b",
      interval: {
        id: "wd-band",
        labelZh: "标准衣柜展开面区间（示例）",
        labelEn: "Standard wardrobe SQM band (sample)",
        widthMinMm: 1000,
        widthMaxMm: 6000,
        heightMinMm: 2200,
        heightMaxMm: 2800,
        minBillWidthMm: 1000,
        minBillHeightMm: 2200,
      },
      finishGrade: "B",
      finishDescriptionZh: "PET / 双饰面（B 档）",
      finishDescriptionEn: "PET / melamine (Grade B)",
      pricingUnit: "sqm",
      rrpCnyPerUnit: 2200,
    }),
  ],
};

const kitchenIsland: PriceLibraryProduct = {
  id: "kitchen-island",
  system: "kitchen",
  categoryZh: "厨房",
  categoryEn: "Kitchen",
  productNameZh: "岛台（柜体+台面）",
  productNameEn: "Island Suite (cabinetry + top)",
  model: "KIT-ISL",
  defaultPricingUnit: "set",
  exclusionZh: "不含龙头、台盆、电器",
  exclusionEn: "Excludes faucets, basins, appliances",
  rows: [
    row("kitchen-island", {
      id: "kit-island-set",
      interval: {
        id: "kit-any",
        labelZh: "整套（不按展开面积分段）",
        labelEn: "Per set (single band)",
      },
      finishGrade: "A",
      finishDescriptionZh: "标准岛台套餐 A 档",
      finishDescriptionEn: "Standard island package Grade A",
      pricingUnit: "set",
      rrpCnyPerUnit: 45800,
    }),
  ],
  customRules: [],
};

const lightingLayer: PriceLibraryProduct = {
  id: "lighting-layer",
  system: "lighting",
  categoryZh: "灯光",
  categoryEn: "Lighting",
  productNameZh: "层板灯系统",
  productNameEn: "Shelf Lighting",
  model: "LT-LAY",
  defaultPricingUnit: "lm",
  exclusionZh: "不含外部调光系统",
  exclusionEn: "Excludes external dimming systems",
  rows: [
    row("lighting-layer", {
      id: "lt-lay-m",
      interval: {
        id: "lt-any",
        labelZh: "延米计价",
        labelEn: "Linear meter",
      },
      finishGrade: "A",
      finishDescriptionZh: "嵌入式型材+灯带",
      finishDescriptionEn: "Embedded profile + strip",
      pricingUnit: "lm",
      rrpCnyPerUnit: 380,
    }),
  ],
  customRules: [],
};

export const PRICE_PRODUCTS: PriceLibraryProduct[] = [
  ...XLSX_IMPORTED_PRODUCTS,
  hqb030,
  doorConcealed,
  wardrobe,
  kitchenIsland,
  lightingLayer,
];

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

