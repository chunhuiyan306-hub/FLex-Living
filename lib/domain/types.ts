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

export type QuoteMethod = "set" | "sqm" | "lm" | "pc" | "leaf";

export interface RateTable {
  /** Active currency for display and exports */
  base: CurrencyCode;
  /** How many CNY one unit of the currency buys (e.g. USD=7.2 ⇒ 1 USD = 7.2 CNY) */
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
  listPrice: number;
  discountPct: number;
  marginPct: number;
  clientPrice: number;
  exclusions: string;
  /** non-standard surcharges already baked into line or notes */
  nonStandardMultiplier?: number;
  nonStandardConfirmed?: boolean;
  /** shown on customer-facing docs */
  publicNote?: string;
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
  annotations: DrawingAnnotation[];
  linkedItemIds: string[];
}

export interface DrawingPage {
  id: string;
  name: string;
  fileName: string;
  /** object URLs for demo; production would use storage ids */
  previewUrl?: string;
  screenshots: DrawingScreenshot[];
}

export interface Area {
  id: string;
  nameZh: string;
  nameEn: string;
  elevationCode?: string;
}

export interface QuotationItem {
  id: string;
  areaId?: string;
  productSystem: ProductSystemCategory;
  sku: string;
  nameZh: string;
  nameEn: string;
  quoteMethod: QuoteMethod;
  dimensionsMm: DimensionMm;
  qty: number;
  finishGrade: FinishGrade;
  finishMaterialZh: string;
  finishMaterialEn: string;
  hardwareNoteZh: string;
  hardwareNoteEn: string;
  lightingNoteZh: string;
  lightingNoteEn: string;
  remarkZh: string;
  remarkEn: string;
  internalRemark?: string;
  /** OCR / designer confirmed */
  detectedSpaceLabel?: string;
  detectedDimsRaw?: string;
  screenshotIds: string[];
  libraryRuleId?: string;
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

export interface PriceLibraryEntry {
  id: string;
  system: ProductSystemCategory;
  sku: string;
  nameZh: string;
  nameEn: string;
  quoteMethod: QuoteMethod;
  listPriceCNYPerUnit: number;
  minBillable?: Partial<DimensionMm>;
  oversizedRules: Array<{
    labelZh: string;
    labelEn: string;
    /** mm threshold on height */
    heightGt?: number;
    multiplier: number;
  }>;
  /** optional notes e.g. depth not customizable */
  constraintNotesZh: string[];
  constraintNotesEn: string[];
  defaultExclusionsZh: string;
  defaultExclusionsEn: string;
  finishGradeFactors: Record<FinishGrade, number>;
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
