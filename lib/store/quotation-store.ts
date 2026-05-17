import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CurrencyCode,
  DrawingPage,
  ProjectRoot,
  QuotationItem,
  SpaceNode,
  UiLocale,
} from "@/lib/domain/types";
import { PRICE_LIBRARY, findLibraryEntry } from "@/lib/catalog/price-library";
import { SPACE_PRESETS, mapSpaceLabel } from "@/lib/catalog/space-i18n";
import { parseDimsFromText } from "@/lib/domain/units";
import { suggestMethodFactor } from "@/lib/pricing/engine";

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
    brand: "Flex Living 凡仕之家",
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

function demoWardrobeItem(): QuotationItem {
  const w = PRICE_LIBRARY.find((p) => p.id === "wardrobe-carcass")!;
  return {
    id: uid(),
    productSystem: w.system,
    sku: w.sku,
    nameZh: w.nameZh,
    nameEn: w.nameEn,
    quoteMethod: w.quoteMethod,
    dimensionsMm: { width: 3200, height: 2800, depth: 600 },
    qty: 1,
    finishGrade: "A",
    finishMaterialZh: "天然木皮",
    finishMaterialEn: "Natural Wood Veneer",
    hardwareNoteZh: "Blum 铰链",
    hardwareNoteEn: "Blum hinges",
    lightingNoteZh: "",
    lightingNoteEn: "",
    remarkZh: "含上门测量一次",
    remarkEn: "Includes one site survey",
    screenshotIds: [],
    libraryRuleId: w.id,
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
      listPrice: w.listPriceCNYPerUnit,
      discountPct: 5,
      marginPct: 18,
      clientPrice: 0,
      exclusions: w.defaultExclusionsZh,
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
  closet.items.push(demoWardrobeItem());
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
  addItem: (spaceId: string, template?: Partial<QuotationItem>) => void;
  duplicateItem: (spaceId: string, itemId: string) => void;
  updateItem: (
    spaceId: string,
    itemId: string,
    patch: Partial<QuotationItem>,
  ) => void;
  removeItem: (spaceId: string, itemId: string) => void;
  attachDrawing: (spaceId: string, file: File) => void;
  addScreenshot: (
    spaceId: string,
    drawingId: string,
    name: string,
    dataUrl?: string,
  ) => string;
  applyOcrText: (spaceId: string, itemId: string, text: string) => void;
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
          copy.screenshotIds = [...src.screenshotIds];
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
          const item: QuotationItem = {
            id: uid(),
            productSystem: template?.productSystem ?? lib.system,
            sku: template?.sku ?? lib.sku,
            nameZh: template?.nameZh ?? lib.nameZh,
            nameEn: template?.nameEn ?? lib.nameEn,
            quoteMethod: template?.quoteMethod ?? lib.quoteMethod,
            dimensionsMm: template?.dimensionsMm ?? {},
            qty: template?.qty ?? 1,
            finishGrade: template?.finishGrade ?? "A",
            finishMaterialZh: template?.finishMaterialZh ?? "",
            finishMaterialEn: template?.finishMaterialEn ?? "",
            hardwareNoteZh: template?.hardwareNoteZh ?? "",
            hardwareNoteEn: template?.hardwareNoteEn ?? "",
            lightingNoteZh: template?.lightingNoteZh ?? "",
            lightingNoteEn: template?.lightingNoteEn ?? "",
            remarkZh: template?.remarkZh ?? "",
            remarkEn: template?.remarkEn ?? "",
            screenshotIds: template?.screenshotIds ?? [],
            libraryRuleId: template?.libraryRuleId ?? lib.id,
            thresholdWarnings: [],
            cost_details: template?.cost_details ?? {
              factoryCost: 0,
              distributorPointsPct: 0,
              manualPriceOverrides: [],
            },
            quote_details: {
              listPrice: lib.listPriceCNYPerUnit,
              discountPct: 0,
              marginPct: 0,
              clientPrice: 0,
              exclusions: lib.defaultExclusionsZh,
              nonStandardMultiplier: 1,
              nonStandardConfirmed: false,
              ...template?.quote_details,
            },
          };
          const factor = suggestMethodFactor(
            item,
            findLibraryEntry(item.libraryRuleId),
          );
          if (factor > 1) {
            item.quote_details.nonStandardMultiplier = factor;
            item.thresholdWarnings.push("检测到大尺寸加价，请确认非标系数");
          }
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
            patch.finishGrade ||
            patch.quoteMethod
          ) {
            const entry = findLibraryEntry(item.libraryRuleId);
            const factor = suggestMethodFactor(item, entry);
            item.quote_details.nonStandardMultiplier = factor;
            if (factor > 1 && !item.quote_details.nonStandardConfirmed) {
              item.thresholdWarnings = [
                `规则加成 ×${factor.toFixed(2)}，请点击确认非标`,
              ];
            } else {
              item.thresholdWarnings = [];
            }
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
            previewUrl: url,
            screenshots: [],
          };
          space.drawings.push(page);
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
    }),
    { name: "flexliving-quotation-store-v1" },
  ),
);

export function getActiveRevision(project: ProjectRoot) {
  return project.revisions.find((r) => r.meta.id === project.activeRevisionId)!;
}
