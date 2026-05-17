import type { PriceLibraryEntry, ProductSystemCategory } from "../domain/types";

const grade: PriceLibraryEntry["finishGradeFactors"] = {
  "A+": 1.15,
  A: 1.05,
  B: 1,
  C: 0.92,
  D: 0.85,
};

function entry(
  partial: Omit<PriceLibraryEntry, "finishGradeFactors">,
): PriceLibraryEntry {
  return { ...partial, finishGradeFactors: { ...grade } };
}

export const PRICE_LIBRARY: PriceLibraryEntry[] = [
  entry({
    id: "door-concealed",
    system: "door" as ProductSystemCategory,
    sku: "DR-CVL",
    nameZh: "隐框通顶门",
    nameEn: "Concealed Frame Full-height Door",
    quoteMethod: "leaf",
    listPriceCNYPerUnit: 12800,
    oversizedRules: [
      {
        labelZh: "高度>3000mm 乘系数 1.3",
        labelEn: "Height >3000mm ×1.3",
        heightGt: 3000,
        multiplier: 1.3,
      },
    ],
    constraintNotesZh: ["深度尺寸不可定制（工厂标准）"],
    constraintNotesEn: ["Depth is non-custom (factory standard)"],
    defaultExclusionsZh: "不含智能锁、进口五金升级",
    defaultExclusionsEn: "Excludes smart lock / imported hardware upgrades",
  }),
  entry({
    id: "wall-panel-module",
    system: "wall_panel",
    sku: "WP-TV",
    nameZh: "电视墙模块",
    nameEn: "TV Wall Module",
    quoteMethod: "sqm",
    listPriceCNYPerUnit: 3600,
    oversizedRules: [],
    constraintNotesZh: [],
    constraintNotesEn: [],
    defaultExclusionsZh: "不含岩板石材、现场基层修补",
    defaultExclusionsEn: "Excludes stone supply / substrate rectification",
  }),
  entry({
    id: "wardrobe-carcass",
    system: "cabinet",
    sku: "WD-CARC",
    nameZh: "衣柜柜体（颗粒板柜体）",
    nameEn: "Wardrobe Carcass",
    quoteMethod: "sqm",
    listPriceCNYPerUnit: 2200,
    oversizedRules: [
      {
        labelZh: "高度>2800mm 乘系数 1.15",
        labelEn: "Height >2800mm ×1.15",
        heightGt: 2800,
        multiplier: 1.15,
      },
    ],
    constraintNotesZh: ["拉杆/拉篮为选配"],
    constraintNotesEn: ["Rails/baskets are optional upgrades"],
    defaultExclusionsZh: "不含龙头、台盆、电器、收纳小配件",
    defaultExclusionsEn:
      "Excludes faucets, basins, appliances, loose storage accessories",
  }),
  entry({
    id: "kitchen-island",
    system: "kitchen",
    sku: "KIT-ISL",
    nameZh: "岛台（柜体+台面）",
    nameEn: "Island Suite (cabinetry + top)",
    quoteMethod: "set",
    listPriceCNYPerUnit: 45800,
    oversizedRules: [],
    constraintNotesZh: ["台面超过标准长度另计"],
    constraintNotesEn: ["Top lengths beyond standard billed separately"],
    defaultExclusionsZh: "不含龙头、台盆、电器",
    defaultExclusionsEn: "Excludes faucets, basins, appliances",
  }),
  entry({
    id: "lighting-layer",
    system: "lighting",
    sku: "LT-LAY",
    nameZh: "层板灯系统",
    nameEn: "Shelf Lighting",
    quoteMethod: "lm",
    listPriceCNYPerUnit: 380,
    oversizedRules: [],
    constraintNotesZh: [],
    constraintNotesEn: [],
    defaultExclusionsZh: "不含外部调光系统",
    defaultExclusionsEn: "Excludes external dimming systems",
  }),
];

export function findLibraryEntry(id?: string): PriceLibraryEntry | undefined {
  return PRICE_LIBRARY.find((e) => e.id === id);
}

export function findLibraryEntryBySku(sku: string): PriceLibraryEntry | undefined {
  return PRICE_LIBRARY.find((e) => e.sku === sku);
}
