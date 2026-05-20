export type CurrencyCode = "CNY" | "USD" | "SGD" | "EUR" | "SAR";

export type MeasureUnit =
  | "mm"
  | "cm"
  | "m"
  | "inch"
  | "ft"
  | "sqm"
  | "lm"
  | "set"
  | "pc"
  | "leaf";

/** 饰面等级为材料档，含义由价格库每一行单独定义，不在系统写死 */
export type FinishGrade = "A+" | "A" | "B" | "C" | "D";

export type ProductSystemCategory =
  | "door"
  | "wall_panel"
  | "cabinet"
  | "kitchen"
  | "storage"
  | "finish"
  | "lighting"
  | "hardware";

/** 计价方式：custom = 人工一口价（行总价） */
export type QuoteMethod =
  | "set"
  | "sqm"
  | "lm"
  | "pc"
  | "leaf"
  | "m"
  | "custom";

export interface RateTable {
  base: CurrencyCode;
  cnyPerUnit: Record<CurrencyCode, number>;
}

export interface CostDetails {
  factoryCost: number;
  distributorPointsPct: number;
  supplierNote?: string;
  supplierQuote?: number;
  responsibleBy?: string;
  internalAuditStatus?: "draft" | "pending" | "approved";
  manualPriceOverrides?: Array<{
    at: string;
    field: string;
    from: number;
    to: number;
    reason: string;
    by?: string;
  }>;
}

export interface QuoteDetails {
  /** 未匹配价格库或手动改价时作为单价参考（CNY） */
  listPrice: number;
  discountPct: number;
  marginPct: number;
  clientPrice: number;
  exclusions: string;
  nonStandardMultiplier?: number;
  nonStandardConfirmed?: boolean;
  publicNote?: string;
  /** quoteMethod === custom 时的行前总价（CNY），再参与折扣/毛利或由 clientPrice盖写 */
  manualLineTotalCny?: number;
}

export interface DimensionMm {
  width?: number;
  height?: number;
  depth?: number;
}

export interface DrawingAnnotation {
  id: string;
  type: "arrow" | "rect" | "dimension" | "text";
  payload: Record<string, unknown>;
}

export interface DrawingScreenshot {
  id: string;
  name: string;
  dataUrl?: string;
  /** PDF 上的页码（从 1 起）；图片或未标定时省略，按第 1 页处理 */
  pdfPage?: number;
  annotations: DrawingAnnotation[];
  linkedItemIds: string[];
}

export interface DrawingPage {
  id: string;
  name: string;
  fileName: string;
  previewUrl?: string;
  /** 原始文件 MIME（用于区分图片 / PDF，便于画布框选逻辑） */
  mimeType?: string;
  screenshots: DrawingScreenshot[];
}

export interface Area {
  id: string;
  nameZh: string;
  nameEn: string;
  elevationCode?: string;
}

/**
 * 价格库：尺寸区间（落在某一档则用该档固定单价，非连续线性）
 */
export interface DimensionInterval {
  id: string;
  labelZh: string;
  labelEn: string;
  widthMinMm?: number;
  widthMaxMm?: number;
  heightMinMm?: number;
  heightMaxMm?: number;
  depthMinMm?: number;
  depthMaxMm?: number;
  /** 仅允许若干墙厚/宽度，如移门轨宽 */
  discreteWidthsMm?: number[];
  /** 低于该宽时按该宽计价（最小计价宽度） */
  minBillWidthMm?: number;
  /** 低于该高时按该高计价 */
  minBillHeightMm?: number;
}

/** 与尺寸相关的非标规则（乘系数 / 需另报） */
export interface NonStandardRule {
  id: string;
  labelZh: string;
  labelEn: string;
  heightGtMm?: number;
  depthGtMm?: number;
  widthLtMinBillMultiplier?: boolean;
  multiplier?: number;
  /** 深度过大等：不自动计价，标记待另报 */
  requiresSeparateQuote?: boolean;
}

/**
 * 价格库一行 = 某产品 + 某尺寸区间 + 某饰面等级 + 固定单价
 */
export interface PriceLibraryRow {
  id: string;
  productId: string;
  interval: DimensionInterval;
  finishGrade: FinishGrade;
  finishDescriptionZh: string;
  finishDescriptionEn: string;
  /** 此行计价单位（可覆盖产品默认） */
  pricingUnit: QuoteMethod;
  /**
   * 主报价单价（CNY/计价单位）— 来自报价表「建议成交价」
   * 历史字段名 rrp 保留，与门店价区分见 nationalRetailCnyPerUnit
   */
  rrpCnyPerUnit: number;
  /** 全国统一门店价（元/单位），来自 Excel/PDF「全国统一门店价」 */
  nationalRetailCnyPerUnit?: number;
  suggestedTransactionCnyPerUnit?: number;
  factoryCnyPerUnit?: number;
}

export interface PriceLibraryProduct {
  id: string;
  system: ProductSystemCategory;
  categoryZh: string;
  categoryEn: string;
  productNameZh: string;
  productNameEn: string;
  model: string;
  /** 产品默认计价单位；行可覆盖 */
  defaultPricingUnit: QuoteMethod;
  rows: PriceLibraryRow[];
  customRules: NonStandardRule[];
  exclusionZh: string;
  exclusionEn: string;
  notesZh?: string;
  notesEn?: string;
  /** 若给定，深度应按此固定值，不支持定制 */
  depthLockedMm?: number;
  productImageUrls?: string[];
}

export interface QuotationItem {
  id: string;
  areaId?: string;
  productSystem: ProductSystemCategory;
  /** 型号 */
  sku: string;
  nameZh: string;
  nameEn: string;
  quoteMethod: QuoteMethod;
  dimensionsMm: DimensionMm;
  qty: number;
  finishGrade: FinishGrade;
  /** 与等级配套说明，可来自匹配到的价格行或手工填写 */
  finishMaterialZh: string;
  finishMaterialEn: string;
  hardwareNoteZh: string;
  hardwareNoteEn: string;
  lightingNoteZh: string;
  lightingNoteEn: string;
  remarkZh: string;
  remarkEn: string;
  internalRemark?: string;
  detectedSpaceLabel?: string;
  detectedDimsRaw?: string;
  screenshotIds: string[];
  /** 绑定的价格库产品 ID */
  libraryProductId?: string;
  /** 与 libraryProductId 相同含义（旧版持久化字段） */
  libraryRuleId?: string;
  /** 指定价格行时可锁定；否则按尺寸+等级自动匹配 */
  libraryRowId?: string;
  matchedIntervalLabelZh?: string;
  matchedIntervalLabelEn?: string;

  productImages: string[];
  specificationZh?: string;
  specificationEn?: string;
  /** 来自价格库 */
  isFromPriceLibrary: boolean;
  /** 人工填价 / 未匹配区间 */
  isManualPrice: boolean;
  /** 导出前需审核 */
  needReview: boolean;
  /** 改价、补价原因 */
  overrideReason?: string;
  clientNotes?: string;

  thresholdWarnings: string[];
  cost_details: CostDetails;
  quote_details: QuoteDetails;
}

export interface SpaceNode {
  id: string;
  key: string;
  nameZh: string;
  nameEn: string;
  areas: Area[];
  items: QuotationItem[];
  drawings: DrawingPage[];
}

export interface LevelNode {
  id: string;
  name: string;
  spaces: SpaceNode[];
}

export interface RevisionMeta {
  id: string;
  label: string;
  note?: string;
  createdAt: string;
  duplicatedFrom?: string;
}

export interface ProjectInfo {
  brand: string;
  projectName: string;
  clientName: string;
  quotationNo: string;
  quotedBy: string;
  reviewedBy: string;
  date: string;
}

export interface QuotationRevision {
  meta: RevisionMeta;
  currency: CurrencyCode;
  rates: RateTable;
  project: ProjectInfo;
  levels: LevelNode[];
}

export interface ProjectRoot {
  id: string;
  activeRevisionId: string;
  revisions: QuotationRevision[];
}

export type UiLocale = "zh" | "en";

export interface ValidationIssue {
  code: string;
  severity: "error" | "warn";
  messageZh: string;
  messageEn: string;
  itemId?: string;
  spaceId?: string;
}
