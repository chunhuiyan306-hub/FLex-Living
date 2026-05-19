import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CurrencyCode,
  DrawingPage,
  ProjectInfo,
  ProjectRoot,
  QuotationItem,
  SpaceNode,
  UiLocale,
} from "@/lib/domain/types";
import {
  PRICE_LIBRARY,
  resolveProduct,
  getProduct,
} from "@/lib/catalog/price-library";
import { SPACE_PRESETS, mapSpaceLabel } from "@/lib/catalog/space-i18n";
import { parseDimsFromText } from "@/lib/domain/units";
import {
  matchPriceRow,
  evaluateNonStandard,
} from "@/lib/pricing/engine";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2)}`;

function defaultRates() {
  return {
    base: "CNY" as CurrencyCode,
    cnyPerUnit: { CNY: 1, USD: 7.2, SGD: 5.35, EUR: 7.85, SAR: 1.92 },
  };
}

function sampleProject() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    brand: "FLEXLIVING 凡仕之家",
    projectName: "Riyadh Villa — Demo",
    clientName: "Confidential Client",
    quotationNo: `FL-${today.replace(/-/g, "")}-001`,
    quotedBy: "Design Studio",
    reviewedBy: "PM",
    date: today,
  };
}

function emptySpace(key: string): SpaceNode {
  const preset = SPACE_PRESETS.find((s) => s.key === key)!;
  return {
    id: uid(),
    key: preset.key,
    nameZh: preset.nameZh,
    nameEn: preset.nameEn,
    areas: [],
    items: [],
    drawings: [],
  };
}

function revokeSpaceDrawingUrls(space: SpaceNode) {
  for (const d of space.drawings) {
    if (d.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(d.previewUrl);
    }
  }
}

/** 新建项目时的示例行：绑定价格库第一项（Excel 导入），避免再引用已移除的演示 SKU。 */
function defaultItemFromCatalog(): QuotationItem {
  const w = PRICE_LIBRARY[0]!;
  const r0 = w.rows[0]!;
  return {
    id: uid(),
    productSystem: w.system,
    sku: w.model,
    nameZh: w.productNameZh,
    nameEn: w.productNameEn,
    quoteMethod: w.defaultPricingUnit,
    dimensionsMm: { width: 3200, height: 2800, depth: 600 },
    qty: 1,
    finishGrade: r0.finishGrade,
    finishMaterialZh: r0.finishDescriptionZh,
    finishMaterialEn: r0.finishDescriptionEn,
    hardwareNoteZh: "Blum 铰链",
    hardwareNoteEn: "Blum hinges",
    lightingNoteZh: "",
    lightingNoteEn: "",
    remarkZh: "含上门测量一次",
    remarkEn: "Includes one site survey",
    screenshotIds: [],
    libraryProductId: w.id,
    libraryRuleId: w.id,
    productImages: w.productImageUrls ? [...w.productImageUrls] : [],
    isFromPriceLibrary: true,
    isManualPrice: false,
    needReview: false,
    thresholdWarnings: [],
    cost_details: {
      factoryCost: 1200,
      distributorPointsPct: 12,
      supplierNote: "Factory A / 45 天",
      supplierQuote: 1100,
      responsibleBy: "Procurement",
      internalAuditStatus: "draft",
      manualPriceOverrides: [],
    },
    quote_details: {
      listPrice: r0.rrpCnyPerUnit,
      discountPct: 5,
      marginPct: 18,
      clientPrice: 0,
      exclusions: w.exclusionZh,
      nonStandardMultiplier: 1,
      nonStandardConfirmed: true,
      publicNote: "",
    },
  };
}

function initialProject(): ProjectRoot {
  const levelId = uid();
  const revId = uid();
  const closet = emptySpace("walk_in_closet");
  closet.items.push(defaultItemFromCatalog());
  return {
    id: uid(),
    activeRevisionId: revId,
    revisions: [
      {
        meta: {
          id: revId,
          label: "V1 初版报价",
          note: "Baseline",
          createdAt: new Date().toISOString(),
        },
        currency: defaultRates().base,
        rates: defaultRates(),
        project: sampleProject(),
        levels: [
          {
            id: levelId,
            name: "Level 01",
            spaces: [closet],
          },
        ],
      },
    ],
  };
}

export function activeRevision(root: ProjectRoot) {
  return root.revisions.find((r) => r.meta.id === root.activeRevisionId)!;
}

export interface Store {
  uiLocale: UiLocale;
  showInternal: boolean;
  project: ProjectRoot;
  selectedLevelId?: string;
  selectedSpaceId?: string;
  selectedItemId?: string;
  configDrawerOpen: boolean;
  setUi: (patch: Partial<Pick<Store, "uiLocale" | "showInternal">>) => void;
  selectSpace: (levelId: string, spaceId: string) => void;
  toggleDrawer: (open: boolean) => void;
  selectItem: (id?: string) => void;
  duplicateRevision: (label: string, note?: string) => void;
  setCurrency: (c: CurrencyCode) => void;
  setRate: (c: CurrencyCode, cnyPerUnit: number) => void;
  addSpace: (levelId: string, key: string) => void;
  removeSpace: (levelId: string, spaceId: string) => void;
  addItem: (spaceId: string, template?: Partial<QuotationItem>) => void;
  duplicateItem: (spaceId: string, itemId: string) => void;
  updateItem: (
    spaceId: string,
    itemId: string,
    patch: Partial<QuotationItem>,
  ) => void;
  removeItem: (spaceId: string, itemId: string) => void;
  attachDrawing: (spaceId: string, file: File) => void;
  removeDrawing: (spaceId: string, drawingId: string) => void;
  /** 在平面上拖拽框选的归一化矩形 (0~1)，新增为一条「计价区域」并可后续关联报价行 */
  addDrawingRectRegion: (
    spaceId: string,
    drawingId: string,
    norm: { nx: number; ny: number; nw: number; nh: number },
    nameZh: string,
    nameEn: string,
  ) => string;
  setScreenshotLinkedItems: (
    spaceId: string,
    drawingId: string,
    screenshotId: string,
    linkedItemIds: string[],
  ) => void;
  removeDrawingScreenshot: (
    spaceId: string,
    drawingId: string,
    screenshotId: string,
  ) => void;
  addScreenshot: (
    spaceId: string,
    drawingId: string,
    name: string,
    dataUrl?: string,
  ) => string;
  applyOcrText: (spaceId: string, itemId: string, text: string) => void;
  /** 当前版本下的项目抬头（名称、客户、报价编号等） */
  updateProjectInfo: (patch: Partial<ProjectInfo>) => void;
}

function initialSelection(project: ProjectRoot) {
  const rev = project.revisions.find((r) => r.meta.id === project.activeRevisionId)!;
  const level = rev.levels[0];
  const space = level?.spaces[0];
  return { levelId: level?.id, spaceId: space?.id };
}

const boot = (() => {
  const project = initialProject();
  const sel = initialSelection(project);
  return { project, ...sel };
})();

function syncLineMeta(item: QuotationItem) {
  const prod = resolveProduct(item);
  const row = matchPriceRow(prod, item);
  if (row) {
    item.matchedIntervalLabelZh = row.interval.labelZh;
    item.matchedIntervalLabelEn = row.interval.labelEn;
    item.quote_details.listPrice = row.rrpCnyPerUnit;
  } else {
    item.matchedIntervalLabelZh = undefined;
    item.matchedIntervalLabelEn = undefined;
  }
  const ns = evaluateNonStandard(prod, item.dimensionsMm);
  item.quote_details.nonStandardMultiplier = ns.factor;
  if (ns.requiresSeparateQuote) {
    item.needReview = true;
    item.thresholdWarnings = [
      "触发「需另外报价」规则（如墙厚超限），请人工确认",
    ];
    return;
  }
  if (
    !row &&
    prod &&
    !item.isManualPrice &&
    item.quoteMethod !== "custom"
  ) {
    item.needReview = true;
    item.thresholdWarnings = [
      "未命中价格表尺寸区间，请填写自定义单价或开启「人工价格」并说明原因",
    ];
    return;
  }
  if (ns.factor > 1 && !item.quote_details.nonStandardConfirmed) {
    item.thresholdWarnings = [
      `规则加成 ×${ns.factor.toFixed(2)}，请点击确认非标`,
    ];
    return;
  }
  item.thresholdWarnings = [];
}

/** 升级或缓存损坏时：把仍指向已删 demo / 旧 id 的行迁回当前价格库（首项）。 */
function repairOrphanLibraryItems(project: ProjectRoot) {
  const fallback = PRICE_LIBRARY[0];
  if (!fallback) return;
  const r0 = fallback.rows[0];
  for (const rev of project.revisions) {
    for (const level of rev.levels) {
      for (const space of level.spaces) {
        for (const item of space.items) {
          if (getProduct(item.libraryProductId ?? item.libraryRuleId)) continue;
          item.libraryProductId = fallback.id;
          item.libraryRuleId = fallback.id;
          item.libraryRowId = undefined;
          item.sku = fallback.model;
          item.nameZh = fallback.productNameZh;
          item.nameEn = fallback.productNameEn;
          item.quoteMethod = fallback.defaultPricingUnit;
          item.productSystem = fallback.system;
          item.finishGrade = r0?.finishGrade ?? "A";
          item.finishMaterialZh = r0?.finishDescriptionZh ?? "";
          item.finishMaterialEn = r0?.finishDescriptionEn ?? "";
          item.quote_details.listPrice = r0?.rrpCnyPerUnit ?? 0;
          item.quote_details.exclusions = fallback.exclusionZh;
          item.productImages = fallback.productImageUrls
            ? [...fallback.productImageUrls]
            : [];
          syncLineMeta(item);
        }
      }
    }
  }
}

export const useQuotationStore = create<Store>()(
  persist(
    (set, get) => ({
      uiLocale: "zh",
      showInternal: true,
      project: boot.project,
      selectedLevelId: boot.levelId,
      selectedSpaceId: boot.spaceId,
      selectedItemId: undefined,
      configDrawerOpen: false,

      setUi: (patch) => set(patch),

      selectSpace: (levelId, spaceId) =>
        set({ selectedLevelId: levelId, selectedSpaceId: spaceId }),

      toggleDrawer: (open) => set({ configDrawerOpen: open }),

      selectItem: (id) =>
        set({ selectedItemId: id, configDrawerOpen: Boolean(id) }),

      duplicateRevision: (label, note) =>
        set((s) => {
          const root = structuredClone(s.project);
          const current = activeRevision(root);
          const copy = structuredClone(current);
          copy.meta = {
            id: uid(),
            label,
            note,
            createdAt: new Date().toISOString(),
            duplicatedFrom: current.meta.id,
          };
          root.revisions.push(copy);
          root.activeRevisionId = copy.meta.id;
          return { project: root };
        }),

      setCurrency: (c) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          rev.currency = c;
          rev.rates.base = c;
          return { project: root };
        }),

      setRate: (c, cnyPerUnit) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          rev.rates.cnyPerUnit[c] = cnyPerUnit;
          return { project: root };
        }),

      addSpace: (levelId, key) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const level = rev.levels.find((l) => l.id === levelId);
          if (!level) return s;
          level.spaces.push(emptySpace(key));
          return { project: root };
        }),

      removeSpace: (levelId, spaceId) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const level = rev.levels.find((l) => l.id === levelId);
          if (!level || level.spaces.length <= 1) return s;
          const dead = level.spaces.find((sp) => sp.id === spaceId);
          if (!dead) return s;
          revokeSpaceDrawingUrls(dead);
          level.spaces = level.spaces.filter((sp) => sp.id !== spaceId);

          let nextSpaceId = s.selectedSpaceId;
          let nextLevelId = s.selectedLevelId;
          if (s.selectedSpaceId === spaceId) {
            nextSpaceId = level.spaces[0]?.id;
            nextLevelId = levelId;
          }
          return {
            project: root,
            selectedSpaceId: nextSpaceId,
            selectedLevelId: nextLevelId,
            selectedItemId: undefined,
            configDrawerOpen: false,
          };
        }),

      duplicateItem: (spaceId, itemId) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          const src = space?.items.find((i) => i.id === itemId);
          if (!space || !src) return s;
          const copy = structuredClone(src);
          copy.id = uid();
          copy.screenshotIds = [];
          space.items.push(copy);
          return {
            project: root,
            selectedItemId: copy.id,
            configDrawerOpen: true,
          };
        }),

      addItem: (spaceId, template) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          if (!space) return s;
          const lib = PRICE_LIBRARY[0];
          const sampleRow = lib.rows[0];
          const item: QuotationItem = {
            id: uid(),
            productSystem: template?.productSystem ?? lib.system,
            sku: template?.sku ?? lib.model,
            nameZh: template?.nameZh ?? lib.productNameZh,
            nameEn: template?.nameEn ?? lib.productNameEn,
            quoteMethod:
              template?.quoteMethod ?? lib.defaultPricingUnit,
            dimensionsMm: template?.dimensionsMm ?? {},
            qty: template?.qty ?? 1,
            finishGrade: template?.finishGrade ?? sampleRow?.finishGrade ?? "A",
            finishMaterialZh:
              template?.finishMaterialZh ?? sampleRow?.finishDescriptionZh ?? "",
            finishMaterialEn:
              template?.finishMaterialEn ?? sampleRow?.finishDescriptionEn ?? "",
            hardwareNoteZh: template?.hardwareNoteZh ?? "",
            hardwareNoteEn: template?.hardwareNoteEn ?? "",
            lightingNoteZh: template?.lightingNoteZh ?? "",
            lightingNoteEn: template?.lightingNoteEn ?? "",
            remarkZh: template?.remarkZh ?? "",
            remarkEn: template?.remarkEn ?? "",
            screenshotIds: template?.screenshotIds ?? [],
            libraryProductId:
              template?.libraryProductId ??
              template?.libraryRuleId ??
              lib.id,
            libraryRuleId:
              template?.libraryRuleId ??
              template?.libraryProductId ??
              lib.id,
            libraryRowId: template?.libraryRowId,
            productImages:
              template?.productImages ??
              (lib.productImageUrls ? [...lib.productImageUrls] : []),
            isFromPriceLibrary: template?.isFromPriceLibrary ?? true,
            isManualPrice: template?.isManualPrice ?? false,
            needReview: template?.needReview ?? false,
            overrideReason: template?.overrideReason,
            clientNotes: template?.clientNotes,
            specificationZh: template?.specificationZh,
            specificationEn: template?.specificationEn,
            thresholdWarnings: [],
            cost_details: template?.cost_details ?? {
              factoryCost: 0,
              distributorPointsPct: 0,
              manualPriceOverrides: [],
            },
            quote_details: {
              listPrice: sampleRow?.rrpCnyPerUnit ?? 0,
              discountPct: 0,
              marginPct: 0,
              clientPrice: 0,
              exclusions: lib.exclusionZh,
              nonStandardMultiplier: 1,
              nonStandardConfirmed: false,
              ...template?.quote_details,
            },
          };
          syncLineMeta(item);
          space.items.push(item);
          return {
            project: root,
            selectedItemId: item.id,
            configDrawerOpen: true,
          };
        }),

      updateItem: (spaceId, itemId, patch) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          const item = space?.items.find((i) => i.id === itemId);
          if (!item) return s;

          const nextPatch = { ...patch };
          if (nextPatch.quote_details) {
            item.quote_details = {
              ...item.quote_details,
              ...nextPatch.quote_details,
            };
            delete nextPatch.quote_details;
          }
          if (nextPatch.cost_details) {
            item.cost_details = {
              ...item.cost_details,
              ...nextPatch.cost_details,
            };
            delete nextPatch.cost_details;
          }
          Object.assign(item, nextPatch);

          if (
            patch.dimensionsMm ||
            patch.libraryRuleId ||
            patch.libraryProductId ||
            patch.libraryRowId ||
            patch.finishGrade ||
            patch.quoteMethod ||
            patch.isManualPrice
          ) {
            syncLineMeta(item);
          }
          return { project: root };
        }),

      removeItem: (spaceId, itemId) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          if (!space) return s;
          for (const d of space.drawings) {
            for (const sh of d.screenshots) {
              sh.linkedItemIds = sh.linkedItemIds.filter((id) => id !== itemId);
            }
          }
          space.items = space.items.filter((i) => i.id !== itemId);
          return {
            project: root,
            selectedItemId: undefined,
            configDrawerOpen: false,
          };
        }),

      attachDrawing: (spaceId, file) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          if (!space) return s;
          const url = URL.createObjectURL(file);
          const page: DrawingPage = {
            id: uid(),
            name: file.name,
            fileName: file.name,
            mimeType: file.type || undefined,
            previewUrl: url,
            screenshots: [],
          };
          space.drawings.push(page);
          return { project: root };
        }),

      removeDrawing: (spaceId, drawingId) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          const drawing = space?.drawings.find((d) => d.id === drawingId);
          if (!space || !drawing) return s;
          for (const sh of drawing.screenshots) {
            for (const oid of sh.linkedItemIds) {
              const it = space.items.find((x) => x.id === oid);
              if (it) {
                it.screenshotIds = it.screenshotIds.filter(
                  (x) => x !== sh.id,
                );
              }
            }
          }
          if (drawing.previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(drawing.previewUrl);
          }
          space.drawings = space.drawings.filter((d) => d.id !== drawingId);
          return { project: root };
        }),

      addDrawingRectRegion: (spaceId, drawingId, norm, nameZh, nameEn) => {
        const shotId = uid();
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          const drawing = space?.drawings.find((d) => d.id === drawingId);
          if (!space || !drawing) return s;
          drawing.screenshots.push({
            id: shotId,
            name: `${nameZh} (${nameEn})`,
            annotations: [
              {
                id: uid(),
                type: "rect",
                payload: {
                  nx: norm.nx,
                  ny: norm.ny,
                  nw: norm.nw,
                  nh: norm.nh,
                },
              },
            ],
            linkedItemIds: [],
          });
          return { project: root };
        });
        return shotId;
      },

      setScreenshotLinkedItems: (
        spaceId,
        drawingId,
        screenshotId,
        linkedItemIds,
      ) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          const drawing = space?.drawings.find((d) => d.id === drawingId);
          const shot = drawing?.screenshots.find((sh) => sh.id === screenshotId);
          if (!space || !shot) return s;
          const prev = [...shot.linkedItemIds];
          for (const oid of prev) {
            const it = space.items.find((i) => i.id === oid);
            if (it) {
              it.screenshotIds = it.screenshotIds.filter(
                (x) => x !== screenshotId,
              );
            }
          }
          shot.linkedItemIds = [...linkedItemIds];
          for (const nid of linkedItemIds) {
            const it = space.items.find((i) => i.id === nid);
            if (it && !it.screenshotIds.includes(screenshotId)) {
              it.screenshotIds.push(screenshotId);
            }
          }
          return { project: root };
        }),

      removeDrawingScreenshot: (spaceId, drawingId, screenshotId) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          const drawing = space?.drawings.find((d) => d.id === drawingId);
          if (!space || !drawing) return s;
          const shot = drawing.screenshots.find((sh) => sh.id === screenshotId);
          if (shot) {
            for (const oid of shot.linkedItemIds) {
              const it = space.items.find((i) => i.id === oid);
              if (it) {
                it.screenshotIds = it.screenshotIds.filter(
                  (x) => x !== screenshotId,
                );
              }
            }
          }
          drawing.screenshots = drawing.screenshots.filter(
            (sh) => sh.id !== screenshotId,
          );
          return { project: root };
        }),

      addScreenshot: (spaceId, drawingId, name, dataUrl) => {
        let shotId = "";
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          const drawing = space?.drawings.find((d) => d.id === drawingId);
          if (!drawing) return s;
          shotId = uid();
          drawing.screenshots.push({
            id: shotId,
            name,
            dataUrl,
            annotations: [],
            linkedItemIds: [],
          });
          return { project: root };
        });
        return shotId;
      },

      applyOcrText: (spaceId, itemId, text) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          const space = rev.levels
            .flatMap((l) => l.spaces)
            .find((sp) => sp.id === spaceId);
          const item = space?.items.find((i) => i.id === itemId);
          if (!item) return s;
          const mapped = mapSpaceLabel(text);
          if (mapped && space) {
            space.key = mapped.key;
            space.nameZh = mapped.nameZh;
            space.nameEn = mapped.nameEn;
            item.detectedSpaceLabel = text;
          }
          const dims = parseDimsFromText(text);
          if (dims) {
            item.detectedDimsRaw = text;
            item.dimensionsMm = { ...item.dimensionsMm, ...dims };
          }
          return { project: root };
        }),

      updateProjectInfo: (patch) =>
        set((s) => {
          const root = structuredClone(s.project);
          const rev = activeRevision(root);
          Object.assign(rev.project, patch);
          return { project: root };
        }),
    }),
    {
      name: "flexliving-quotation-store-v1",
      merge: (persisted, current) => {
        const next = {
          ...current,
          ...(persisted as Partial<Store>),
        } as Store;
        if (next.project) repairOrphanLibraryItems(next.project);
        return next;
      },
    },
  ),
);

export function getActiveRevision(project: ProjectRoot) {
  return project.revisions.find((r) => r.meta.id === project.activeRevisionId)!;
}
