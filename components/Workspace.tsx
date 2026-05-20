"use client";

import clsx from "clsx";
import Image from "next/image";
import DrawingRegionPicker from "@/components/DrawingRegionPicker";
import {
  ChevronRight,
  Copy,
  FileSpreadsheet,
  FileText,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CURRENCY_SYMBOL, PRODUCT_SYSTEM_LABEL, SPACE_PRESETS } from "@/lib/catalog/space-i18n";
import { PRICE_LIBRARY, resolveProduct } from "@/lib/catalog/price-library";
import { downloadExcel } from "@/lib/export/excel";
import { buildCustomerPdfBlob } from "@/lib/export/pdf-client";
import { computeLine } from "@/lib/pricing/engine";
import {
  activeRevision,
  useQuotationStore,
} from "@/lib/store/quotation-store";
import {
  diffRevisions,
  validateRevision,
  revisionTotals,
} from "@/lib/validation/checks";
import type { CurrencyCode, FinishGrade, ProductSystemCategory, QuoteMethod } from "@/lib/domain/types";

export default function Workspace() {
  const {
    project,
    uiLocale,
    showInternal,
    selectedLevelId,
    selectedSpaceId,
    selectedItemId,
    configDrawerOpen,
    setUi,
    selectSpace,
    selectItem,
    toggleDrawer,
    duplicateRevision,
    setCurrency,
    setRate,
    addSpace,
    removeSpace,
    addItem,
    duplicateItem,
    updateItem,
    removeItem,
    attachDrawing,
    removeDrawing,
    addDrawingRectRegion,
    setScreenshotLinkedItems,
    removeDrawingScreenshot,
    applyOcrText,
    updateProjectInfo,
  } = useQuotationStore();

  const rev = useMemo(() => activeRevision(project), [project]);
  const levels = rev.levels;

  const selectedContext = useMemo(() => {
    for (const l of levels) {
      for (const s of l.spaces) {
        if (s.id === selectedSpaceId)
          return { level: l, space: s, levelId: l.id, spaceId: s.id };
      }
    }
    const first = levels[0];
    const sp = first?.spaces[0];
    if (first && sp) return { level: first, space: sp, levelId: first.id, spaceId: sp.id };
    return null;
  }, [levels, selectedSpaceId]);

  const items = selectedContext?.space.items ?? [];
  const activeItem = items.find((i) => i.id === selectedItemId);
  const totals = useMemo(() => {
    const all = levels.flatMap((l) => l.spaces.flatMap((s) => s.items));
    const projectTotal = revisionTotals(all, rev.rates).client;
    let floor = 0;
    if (selectedContext) {
      floor = revisionTotals(selectedContext.level.spaces.flatMap((s) => s.items), rev.rates)
        .client;
    }
    let space = 0;
    if (selectedContext) {
      space = revisionTotals(selectedContext.space.items, rev.rates).client;
    }
    return { space, floor, project: projectTotal };
  }, [levels, rev.rates, selectedContext]);

  const [exportNotes, setExportNotes] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [projectFieldsOpen, setProjectFieldsOpen] = useState(false);
  const revIndex = project.revisions.findIndex(
    (r) => r.meta.id === project.activeRevisionId,
  );
  const prevRev = revIndex > 0 ? project.revisions[revIndex - 1] : undefined;

  function runExport(kind: "xlsx-internal" | "xlsx-client" | "pdf") {
    const issues = validateRevision(rev);
    const blockers = issues.filter((i) => i.severity === "error");
    if (blockers.length) {
      setExportNotes(
        blockers.map((b) => (uiLocale === "zh" ? b.messageZh : b.messageEn)).join("\n"),
      );
      return;
    }
    setExportNotes(null);
    if (kind === "xlsx-internal") {
      downloadExcel(rev, rev.project.quotationNo, "internal");
    } else if (kind === "xlsx-client") {
      downloadExcel(rev, rev.project.quotationNo, "client");
    } else if (kind === "pdf") {
      void buildCustomerPdfBlob(rev).then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${rev.project.quotationNo}_client.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  const t = (zh: string, en: string) => (uiLocale === "zh" ? zh : en);
  const sym = CURRENCY_SYMBOL[rev.currency];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-line bg-surface-card/80 px-8 py-4 backdrop-blur-md">
        <div className="flex min-w-0 flex-1 items-start gap-5">
          <Image
            src="/brand-logo.png"
            alt="FLEXLIVING 凡仕之家"
            width={200}
            height={56}
            className="h-12 w-auto max-w-[min(200px,28vw)] shrink-0 object-contain object-left"
            priority
          />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary hover:text-ink-secondary"
              onClick={() => setProjectFieldsOpen((v) => !v)}
            >
              {t("当前报价项目 · 点击展开更多信息", "Active quotation · More fields")}
            </button>
            <input
              type="text"
              className="mt-1 block w-full max-w-xl border-b border-transparent bg-transparent text-xl font-semibold text-ink outline-none transition placeholder:text-ink-tertiary hover:border-line focus:border-ink"
              value={rev.project.projectName}
              placeholder={t("项目名称", "Project name")}
              onChange={(e) =>
                updateProjectInfo({ projectName: e.target.value })
              }
              aria-label={t("项目名称", "Project name")}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
              <span className="rounded-full bg-surface-muted px-3 py-1">
                {rev.meta.label}
              </span>
              <input
                type="text"
                className="min-w-[8rem] max-w-[12rem] rounded-full border border-line bg-white px-3 py-1 text-xs outline-none focus:border-ink"
                value={rev.project.quotationNo}
                onChange={(e) =>
                  updateProjectInfo({ quotationNo: e.target.value })
                }
                title={t("报价编号", "Quotation No.")}
                aria-label={t("报价编号", "Quotation No.")}
              />
            </div>
            {projectFieldsOpen ? (
              <div className="mt-3 grid max-w-2xl grid-cols-1 gap-2 rounded-2xl border border-line/80 bg-surface-muted/30 p-3 sm:grid-cols-2">
                <label className="block text-[11px] font-medium text-ink-tertiary">
                  {t("品牌抬头（导出用）", "Brand (exports)")}
                  <input
                    type="text"
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none"
                    value={rev.project.brand}
                    onChange={(e) =>
                      updateProjectInfo({ brand: e.target.value })
                    }
                  />
                </label>
                <label className="block text-[11px] font-medium text-ink-tertiary">
                  {t("客户名称", "Client")}
                  <input
                    type="text"
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none"
                    value={rev.project.clientName}
                    onChange={(e) =>
                      updateProjectInfo({ clientName: e.target.value })
                    }
                  />
                </label>
                <label className="block text-[11px] font-medium text-ink-tertiary">
                  {t("报价日期", "Quote date")}
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none"
                    value={rev.project.date}
                    onChange={(e) =>
                      updateProjectInfo({ date: e.target.value })
                    }
                  />
                </label>
                <label className="block text-[11px] font-medium text-ink-tertiary">
                  {t("报价人", "Quoted by")}
                  <input
                    type="text"
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none"
                    value={rev.project.quotedBy}
                    onChange={(e) =>
                      updateProjectInfo({ quotedBy: e.target.value })
                    }
                  />
                </label>
                <label className="block text-[11px] font-medium text-ink-tertiary sm:col-span-2">
                  {t("审核人", "Reviewed by")}
                  <input
                    type="text"
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none"
                    value={rev.project.reviewedBy}
                    onChange={(e) =>
                      updateProjectInfo({ reviewedBy: e.target.value })
                    }
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none"
            value={project.activeRevisionId}
            onChange={(e) =>
              useQuotationStore.setState({
                project: {
                  ...project,
                  activeRevisionId: e.target.value,
                },
              })
            }
          >
            {project.revisions.map((r) => (
              <option key={r.meta.id} value={r.meta.id}>
                {r.meta.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:bg-surface-muted"
            onClick={() => {
              const n = project.revisions.length + 1;
              duplicateRevision(`V${n} 修改稿`, "Duplicated");
            }}
          >
            {t("复制为新版本", "Duplicate revision")}
          </button>
          {prevRev ? (
            <button
              type="button"
              className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:bg-surface-muted"
              onClick={() => setDiffOpen(true)}
            >
              {t("对比上一版", "Compare to previous")}
            </button>
          ) : null}
          <select
            className="rounded-full border border-line bg-white px-3 py-2 text-sm"
            value={rev.currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          >
            {(["CNY", "USD", "SGD", "EUR", "SAR"] as CurrencyCode[]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <span>{t("汇率(CNY/单位)", "CNY / unit")}</span>
            <input
              className="w-20 rounded-lg border border-line px-2 py-1 text-sm"
              type="number"
              value={rev.rates.cnyPerUnit[rev.currency]}
              onChange={(e) =>
                setRate(rev.currency, parseFloat(e.target.value) || 0)
              }
            />
          </div>
          <button
            type="button"
            className="rounded-full border border-line bg-white px-3 py-2 text-sm"
            onClick={() => setUi({ uiLocale: uiLocale === "zh" ? "en" : "zh" })}
          >
            {uiLocale === "zh" ? "EN" : "中文"}
          </button>
          <button
            type="button"
            className={clsx(
              "rounded-full border px-3 py-2 text-sm",
              showInternal
                ? "border-ink bg-ink text-white"
                : "border-line bg-white",
            )}
            onClick={() => setUi({ showInternal: !showInternal })}
          >
            {t("内部视图", "Internal view")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-card"
            onClick={() => runExport("xlsx-internal")}
          >
            <FileSpreadsheet size={16} />
            Excel · {t("内部", "Internal")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm"
            onClick={() => runExport("xlsx-client")}
          >
            <FileSpreadsheet size={16} />
            Excel · {t("客户", "Client")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm"
            onClick={() => runExport("pdf")}
          >
            <FileText size={16} />
            PDF
          </button>
        </div>
      </header>

      {exportNotes ? (
        <div className="mx-8 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-wrap">
          <div className="mb-1 font-semibold">
            {t("导出检查未通过", "Export blocked")}
          </div>
          {exportNotes}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-4 p-6">
        <aside className="w-72 shrink-0 overflow-y-auto rounded-3xl border border-line/70 bg-surface-card p-4 shadow-card">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-tertiary">
            {t("楼层 / 空间", "Levels / Spaces")}
          </div>
          {levels.map((lvl) => (
            <div key={lvl.id} className="mb-4">
              <div className="mb-2 text-sm font-medium text-ink-secondary">{lvl.name}</div>
              <div className="space-y-1">
                {lvl.spaces.map((sp) => (
                  <div
                    key={sp.id}
                    className={clsx(
                      "flex min-w-0 items-stretch gap-1 rounded-2xl",
                      sp.id === selectedContext?.spaceId ? "bg-surface-muted ring-1 ring-line/35" : "",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectSpace(lvl.id, sp.id)}
                      className={clsx(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition",
                        sp.id === selectedContext?.spaceId
                          ? "font-semibold text-ink"
                          : "text-ink-secondary hover:bg-surface-muted/60",
                      )}
                    >
                      <span className="min-w-0 truncate">
                        {uiLocale === "zh" ? sp.nameZh : sp.nameEn}
                      </span>
                      <ChevronRight size={14} className="shrink-0 opacity-45" />
                    </button>
                    <button
                      type="button"
                      disabled={lvl.spaces.length <= 1}
                      title={
                        lvl.spaces.length <= 1
                          ? t("每层至少需要保留一个空间", "Keep at least one space per level.")
                          : t("删除当前空间", "Remove this space")
                      }
                      className={clsx(
                        "shrink-0 rounded-xl px-2 py-2 text-red-700 transition",
                        lvl.spaces.length <= 1
                          ? "cursor-not-allowed opacity-35"
                          : "hover:bg-red-50 hover:text-red-800",
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (lvl.spaces.length <= 1) return;
                        const nameLabel =
                          uiLocale === "zh" ? sp.nameZh : sp.nameEn;
                        const risky =
                          sp.items.length > 0 || sp.drawings.length > 0;
                        if (
                          risky &&
                          !window.confirm(
                            uiLocale === "zh"
                              ? `确定删除空间「${nameLabel}」吗？已有的报价项与图纸区域将一并移除。`
                              : `Remove space "${nameLabel}"? This will delete its line items and drawing regions.`,
                          )
                        )
                          return;
                        removeSpace(lvl.id, sp.id);
                      }}
                      aria-label={t("删除空间", "Remove space")}
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <select
                  className="w-full rounded-2xl border border-line bg-white px-3 py-2 text-xs"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addSpace(lvl.id, e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">{t("+ 新增空间", "+ Add space")}</option>
                  {SPACE_PRESETS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.nameZh} / {s.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {selectedContext ? (
            <div className="mt-4 rounded-2xl border border-line bg-surface-muted/40 p-3">
              <div className="mb-2 text-xs font-semibold text-ink-tertiary">
                {t("图纸上传", "Drawings")}
              </div>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="text-xs"
                key={selectedContext.spaceId}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && selectedContext) {
                    attachDrawing(selectedContext.spaceId, f);
                    e.target.value = "";
                  }
                }}
              />
              <div className="mt-2 space-y-3">
                {selectedContext.space.drawings.map((d) => (
                  <DrawingRegionPicker
                    key={d.id}
                    uiLocale={uiLocale}
                    drawing={d}
                    items={selectedContext.space.items}
                    onAddRegion={(norm, nameZh, nameEn, pdfPage) => {
                      addDrawingRectRegion(
                        selectedContext.spaceId,
                        d.id,
                        norm,
                        nameZh,
                        nameEn,
                        pdfPage,
                      );
                    }}
                    onLinkRegion={(screenshotId, itemIds) => {
                      setScreenshotLinkedItems(
                        selectedContext.spaceId,
                        d.id,
                        screenshotId,
                        itemIds,
                      );
                    }}
                    onRemoveScreenshot={(screenshotId) =>
                      removeDrawingScreenshot(
                        selectedContext.spaceId,
                        d.id,
                        screenshotId,
                      )
                    }
                    onRemoveDrawing={() =>
                      removeDrawing(selectedContext.spaceId, d.id)
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden rounded-3xl border border-line/70 bg-surface-card shadow-card">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-line/80 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-tertiary">
                  {t("当前空间", "Active space")}
                </div>
                <div className="text-lg font-semibold">
                  {selectedContext
                    ? uiLocale === "zh"
                      ? selectedContext.space.nameZh
                      : selectedContext.space.nameEn
                    : "—"}
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
                onClick={() =>
                  selectedContext && addItem(selectedContext.spaceId)
                }
              >
                <Plus size={16} />
                {t("新增报价项", "Add line item")}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-surface-muted/90 backdrop-blur">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-tertiary">
                    <th className="px-4 py-3">{t("系统", "System")}</th>
                    <th className="px-4 py-3">{t("名称", "Name")}</th>
                    <th className="px-4 py-3">mm</th>
                    <th className="px-4 py-3">{t("数量", "Qty")}</th>
                    <th className="px-4 py-3">{t("客户价", "Client")}</th>
                    {showInternal ? (
                      <th className="px-4 py-3">{t("成本", "Cost")}</th>
                    ) : null}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const line = computeLine(
                      it,
                      resolveProduct(it),
                      rev.rates,
                    );
                    const label =
                      uiLocale === "zh"
                        ? PRODUCT_SYSTEM_LABEL[it.productSystem].zh
                        : PRODUCT_SYSTEM_LABEL[it.productSystem].en;
                    return (
                      <tr
                        key={it.id}
                        className={clsx(
                          "border-t border-line/60",
                          it.id === selectedItemId ? "bg-surface-muted/50" : "",
                        )}
                      >
                        <td className="px-4 py-3 text-ink-secondary">{label}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
                            {uiLocale === "zh" ? it.nameZh : it.nameEn}
                            {it.screenshotIds.length > 0 ? (
                              <span
                                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200/80"
                                title={t("已绑定图纸计价区域", "Linked to drawing region")}
                              >
                                <Layers size={12} aria-hidden />
                                <span>{it.screenshotIds.length}</span>
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-secondary">
                          {it.dimensionsMm.width ?? "—"} ×{" "}
                          {it.dimensionsMm.height ?? "—"} ×{" "}
                          {it.dimensionsMm.depth ?? "—"}
                        </td>
                        <td className="px-4 py-3">{it.qty}</td>
                        <td className="px-4 py-3 font-medium">
                          {sym}
                          {line.clientPrice.toFixed(0)}
                        </td>
                        {showInternal ? (
                          <td className="px-4 py-3 text-xs text-ink-secondary">
                            ¥{it.cost_details.factoryCost}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="rounded-full border border-line px-3 py-1 text-xs"
                            onClick={() => {
                              selectItem(it.id);
                            }}
                          >
                            {t("配置", "Configure")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <aside
          className={clsx(
            "sheet-transition flex w-[380px] shrink-0 flex-col rounded-3xl border border-line/70 bg-surface-card shadow-drawer",
            !configDrawerOpen && "hidden",
          )}
        >
          <div className="flex items-center justify-between border-b border-line/80 px-4 py-3">
            <div className="text-sm font-semibold">
              {t("配置面板", "Configuration")}
            </div>
            <button
              type="button"
              className="rounded-full p-2 hover:bg-surface-muted"
              onClick={() => {
                toggleDrawer(false);
                selectItem(undefined);
              }}
            >
              <PanelRightClose size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm">
            {!activeItem || !selectedContext ? (
              <div className="text-ink-tertiary">
                {t("选择一行以配置", "Select a line item")}
              </div>
            ) : (
              <ConfigForm
                item={activeItem}
                uiLocale={uiLocale}
                showInternal={showInternal}
                currency={rev.currency}
                rates={rev.rates}
                onPatch={(patch) =>
                  updateItem(selectedContext.spaceId, activeItem.id, patch)
                }
                onDuplicate={() => duplicateItem(selectedContext.spaceId, activeItem.id)}
                onRemove={() =>
                  removeItem(selectedContext.spaceId, activeItem.id)
                }
                onApplyText={(txt) =>
                  applyOcrText(selectedContext.spaceId, activeItem.id, txt)
                }
              />
            )}
          </div>
        </aside>

        {!configDrawerOpen ? (
          <button
            type="button"
            className="fixed right-6 top-1/2 -translate-y-1/2 rounded-full border border-line bg-white p-3 shadow-card"
            onClick={() => activeItem && toggleDrawer(true)}
            aria-label="open drawer"
          >
            <PanelRightOpen size={18} />
          </button>
        ) : null}
      </div>

      <footer className="flex flex-wrap gap-6 border-t border-line bg-surface-card px-8 py-4 text-sm">
        <div>
          <div className="text-xs text-ink-tertiary">{t("空间小计", "Space subtotal")}</div>
          <div className="text-lg font-semibold">
            {sym}
            {totals.space.toFixed(0)}
          </div>
        </div>
        <div>
          <div className="text-xs text-ink-tertiary">
            {t("楼层小计（示意：当前层全部空间）", "Level subtotal")}
          </div>
          <div className="text-lg font-semibold">
            {sym}
            {totals.floor.toFixed(0)}
          </div>
        </div>
        <div>
          <div className="text-xs text-ink-tertiary">{t("项目总价", "Project total")}</div>
          <div className="text-lg font-semibold">
            {sym}
            {totals.project.toFixed(0)}
          </div>
        </div>
      </footer>

      {diffOpen && prevRev ? (
        <DiffModal
          onClose={() => setDiffOpen(false)}
          uiLocale={uiLocale}
          prev={prevRev}
          next={rev}
          rates={rev.rates}
        />
      ) : null}
    </div>
  );
}

function ConfigForm({
  item,
  uiLocale,
  showInternal,
  currency,
  rates,
  onPatch,
  onDuplicate,
  onRemove,
  onApplyText,
}: {
  item: import("@/lib/domain/types").QuotationItem;
  uiLocale: "zh" | "en";
  showInternal: boolean;
  currency: CurrencyCode;
  rates: import("@/lib/domain/types").RateTable;
  onPatch: (patch: Partial<import("@/lib/domain/types").QuotationItem>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onApplyText: (t: string) => void;
}) {
  const entry = resolveProduct(item);
  const line = computeLine(item, entry, rates);
  const sym = CURRENCY_SYMBOL[currency];
  const pid = item.libraryProductId ?? item.libraryRuleId ?? "";
  const depthLocked = entry?.depthLockedMm;

  const libraryGroups = useMemo(() => {
    const m = new Map<string, typeof PRICE_LIBRARY>();
    for (const p of PRICE_LIBRARY) {
      const k = p.categoryZh;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return [...m.entries()].sort(([a], [b]) =>
      a.localeCompare(b, uiLocale === "zh" ? "zh-Hans-CN" : "en"),
    );
  }, [uiLocale]);

  const displayProductImages =
    (entry?.productImageUrls?.length ? entry.productImageUrls : undefined) ??
    (item.productImages?.length ? item.productImages : undefined) ??
    [];

  const [ocr, setOcr] = useState("Walk-in Closet 2400 x 2800 mm");

  return (
    <div className="space-y-4">
      {(item.needReview || item.isManualPrice) ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {item.needReview
            ? uiLocale === "zh"
              ? "待审核：未匹配区间或自定义价格"
              : "Pending review"
            : null}
          {item.isManualPrice
            ? uiLocale === "zh"
              ? " · 人工价格"
              : " · Manual price"
            : null}
        </div>
      ) : null}
      {item.matchedIntervalLabelZh ? (
        <div className="text-[11px] text-ink-secondary">
          {uiLocale === "zh" ? "匹配区间：" : "Matched band: "}
          {uiLocale === "zh"
            ? item.matchedIntervalLabelZh
            : item.matchedIntervalLabelEn ?? item.matchedIntervalLabelZh}
        </div>
      ) : null}
      <div className="rounded-2xl border border-line bg-surface-muted/40 p-3 text-xs text-ink-secondary">
        <div className="font-semibold text-ink">SKU</div>
        <div>{item.sku}</div>
        <div className="mt-2 font-semibold text-ink">
          {uiLocale === "zh" ? "报价公式预览" : "Pricing trace"}
        </div>
        <div className="mt-1 whitespace-pre-wrap">
          {uiLocale === "zh" ? line.formulaZh : line.formulaEn}
        </div>
        <div className="mt-2 text-lg font-semibold text-ink">
          {sym}
          {line.clientPrice.toFixed(0)}
        </div>
      </div>

      {displayProductImages.length > 0 ? (
        <div className="rounded-2xl border border-line bg-white p-3">
          <div className="mb-2 text-xs font-semibold text-ink">
            {uiLocale === "zh" ? "产品图" : "Product images"}
          </div>
          <div className="flex flex-wrap gap-2">
            {displayProductImages.map((src) => (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noreferrer"
                className="relative block h-28 w-28 overflow-hidden rounded-xl border border-line"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="112px"
                />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-ink-tertiary">
          {uiLocale === "zh"
            ? "暂无图片：若 Excel「图片」列为文件名，请将同名文件放到项目的 public/catalog/ 目录后重新运行导入脚本；也可直接在列中填写 http(s) 链接。"
            : "No images yet: use the Excel image column (URL or filename under public/catalog/), then re-run the import script."}
        </p>
      )}

      <label className="block text-xs font-semibold text-ink-tertiary">
        {uiLocale === "zh" ? "价格库产品" : "Price book product"}
        <select
          className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm"
          value={pid}
          onChange={(e) => {
            const lib = PRICE_LIBRARY.find((p) => p.id === e.target.value);
            if (!lib) return;
            const r0 = lib.rows[0];
            onPatch({
              libraryProductId: lib.id,
              libraryRuleId: lib.id,
              libraryRowId: undefined,
              sku: lib.model,
              nameZh: lib.productNameZh,
              nameEn: lib.productNameEn,
              quoteMethod: lib.defaultPricingUnit,
              productSystem: lib.system,
              finishGrade: r0?.finishGrade ?? item.finishGrade,
              finishMaterialZh: r0?.finishDescriptionZh ?? item.finishMaterialZh,
              finishMaterialEn: r0?.finishDescriptionEn ?? item.finishMaterialEn,
              dimensionsMm: {
                ...item.dimensionsMm,
                depth: lib.depthLockedMm ?? item.dimensionsMm.depth,
              },
              quote_details: {
                ...item.quote_details,
                listPrice: r0?.rrpCnyPerUnit ?? 0,
                exclusions: lib.exclusionZh,
              },
              productImages: lib.productImageUrls ? [...lib.productImageUrls] : [],
            });
          }}
        >
          {libraryGroups.map(([cat, list]) => (
            <optgroup key={cat} label={cat}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.model} · {uiLocale === "zh" ? p.productNameZh : p.productNameEn}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-ink-secondary">
        <input
          type="checkbox"
          checked={item.isManualPrice}
          onChange={(e) => onPatch({ isManualPrice: e.target.checked })}
        />
        {uiLocale === "zh" ? "人工价格 / 未入库补价" : "Manual / off-book price"}
      </label>

      <label className="block text-xs font-semibold text-ink-tertiary">
        {uiLocale === "zh" ? "补价 / 改价原因" : "Override reason"}
        <input
          type="text"
          className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-sm"
          value={item.overrideReason ?? ""}
          onChange={(e) => onPatch({ overrideReason: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Field
          label={uiLocale === "zh" ? "宽 mm" : "W mm"}
          value={item.dimensionsMm.width ?? ""}
         onChange={(v) =>
            onPatch({ dimensionsMm: { ...item.dimensionsMm, width: Number(v) || undefined } })
          }
        />
        <Field
          label={uiLocale === "zh" ? "高 mm" : "H mm"}
          value={item.dimensionsMm.height ?? ""}
          onChange={(v) =>
            onPatch({ dimensionsMm: { ...item.dimensionsMm, height: Number(v) || undefined } })
          }
        />
        {depthLocked !== undefined ? (
          <label className="block text-xs font-semibold text-ink-tertiary">
            {uiLocale === "zh" ? "深 mm（工厂固定）" : "D mm (fixed)"}
            <input
              className="mt-1 w-full cursor-not-allowed rounded-2xl border border-line bg-surface-muted px-3 py-2 text-sm"
              disabled
              value={depthLocked}
            />
          </label>
        ) : (
          <Field
            label={uiLocale === "zh" ? "深 mm" : "D mm"}
            value={item.dimensionsMm.depth ?? ""}
            onChange={(v) =>
              onPatch({
                dimensionsMm: {
                  ...item.dimensionsMm,
                  depth: Number(v) || undefined,
                },
              })
            }
          />
        )}
        <Field
          label={uiLocale === "zh" ? "数量" : "Qty"}
          value={item.qty}
          onChange={(v) => onPatch({ qty: Number(v) || 0 })}
        />
      </div>

      {(item.thresholdWarnings ?? []).length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {item.thresholdWarnings.join(" ")}
          <button
            type="button"
            className="mt-2 w-full rounded-full bg-ink px-3 py-1 text-white"
            onClick={() =>
              onPatch({
                quote_details: {
                  ...item.quote_details,
                  nonStandardConfirmed: true,
                },
              })
            }
          >
            {uiLocale === "zh" ? "确认非标系数" : "Confirm non-standard factor"}
          </button>
        </div>
      ) : null}

      {entry?.notesZh ? (
        <div className="rounded-2xl border border-line bg-white px-3 py-2 text-xs text-ink-secondary">
          <div className="font-semibold text-ink">
            {uiLocale === "zh" ? "产品备注" : "Product notes"}
          </div>
          <p className="mt-1">
            {uiLocale === "zh" ? entry.notesZh : entry.notesEn ?? entry.notesZh}
          </p>
        </div>
      ) : null}

      <label className="block text-xs font-semibold text-ink-tertiary">
        {uiLocale === "zh" ? "计价方式" : "Method"}
        <select
          className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm"
          value={item.quoteMethod}
          onChange={(e) => onPatch({ quoteMethod: e.target.value as QuoteMethod })}
        >
          {(["set", "sqm", "lm", "m", "pc", "leaf", "custom"] as QuoteMethod[]).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      {item.quoteMethod === "custom" ? (
        <label className="block text-xs font-semibold text-ink-tertiary">
          {uiLocale === "zh" ? "自定义行总价（CNY）" : "Custom line total (CNY)"}
          <input
            type="number"
            className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-sm"
            value={item.quote_details.manualLineTotalCny ?? ""}
            onChange={(e) =>
              onPatch({
                quote_details: {
                  ...item.quote_details,
                  manualLineTotalCny: Number(e.target.value) || 0,
                },
              })
            }
          />
        </label>
      ) : (
        <label className="block text-xs font-semibold text-ink-tertiary">
          {uiLocale === "zh" ? "参考单价 CNY（未匹配库时）" : "Ref. unit price CNY"}
          <input
            type="number"
            className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-sm"
            value={item.quote_details.listPrice}
            onChange={(e) =>
              onPatch({
                quote_details: {
                  ...item.quote_details,
                  listPrice: Number(e.target.value) || 0,
                },
              })
            }
          />
        </label>
      )}

      <label className="block text-xs font-semibold text-ink-tertiary">
        {uiLocale === "zh" ? "饰面等级" : "Finish grade"}
        <select
          className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm"
          value={item.finishGrade}
          onChange={(e) => onPatch({ finishGrade: e.target.value as FinishGrade })}
        >
          {(["A+", "A", "B", "C", "D"] as FinishGrade[]).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-semibold text-ink-tertiary">
        {uiLocale === "zh" ? "产品系统（底层分类）" : "Product system"}
        <select
          className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm"
          value={item.productSystem}
          onChange={(e) =>
            onPatch({ productSystem: e.target.value as ProductSystemCategory })
          }
        >
          {(Object.keys(PRODUCT_SYSTEM_LABEL) as ProductSystemCategory[]).map((k) => (
            <option key={k} value={k}>
              {uiLocale === "zh"
                ? PRODUCT_SYSTEM_LABEL[k].zh
                : PRODUCT_SYSTEM_LABEL[k].en}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-semibold text-ink-tertiary">
        {uiLocale === "zh" ? "折扣 / 毛利" : "Disc. / margin %"}
        <div className="mt-1 flex gap-2">
          <input
            className="w-1/2 rounded-2xl border border-line px-3 py-2"
            type="number"
            value={item.quote_details.discountPct}
            onChange={(e) =>
              onPatch({
                quote_details: {
                  ...item.quote_details,
                  discountPct: Number(e.target.value),
                },
              })
            }
          />
          <input
            className="w-1/2 rounded-2xl border border-line px-3 py-2"
            type="number"
            value={item.quote_details.marginPct}
            onChange={(e) =>
              onPatch({
                quote_details: {
                  ...item.quote_details,
                  marginPct: Number(e.target.value),
                },
              })
            }
          />
        </div>
      </label>

      <label className="block text-xs font-semibold text-ink-tertiary">
        {uiLocale === "zh" ? "排除条款" : "Exclusions"}
        <textarea
          className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-sm"
          rows={3}
          value={item.quote_details.exclusions}
          onChange={(e) =>
            onPatch({
              quote_details: { ...item.quote_details, exclusions: e.target.value },
            })
          }
        />
      </label>

      <div className="rounded-2xl border border-line bg-surface-muted/40 p-3">
        <div className="text-xs font-semibold text-ink-tertiary">
          {uiLocale === "zh" ? "半自动：粘贴识别文字" : "Paste OCR / notes"}
        </div>
        <textarea
          className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-xs"
          rows={3}
          value={ocr}
          onChange={(e) => setOcr(e.target.value)}
        />
        <button
          type="button"
          className="mt-2 w-full rounded-full bg-ink px-3 py-2 text-xs font-medium text-white"
          onClick={() => onApplyText(ocr)}
        >
          {uiLocale === "zh" ? "解析到本条" : "Apply to line"}
        </button>
      </div>

      {showInternal ? (
        <div className="rounded-2xl border border-dashed border-line p-3 text-xs">
          <div className="font-semibold">{uiLocale === "zh" ? "内部成本" : "Internal cost"}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className="rounded-xl border border-line px-2 py-1"
              type="number"
              value={item.cost_details.factoryCost}
              onChange={(e) =>
                onPatch({
                  cost_details: {
                    ...item.cost_details,
                    factoryCost: Number(e.target.value),
                  },
                })
              }
            />
            <input
              className="rounded-xl border border-line px-2 py-1"
              type="number"
              placeholder="% dist."
              value={item.cost_details.distributorPointsPct}
              onChange={(e) =>
                onPatch({
                  cost_details: {
                    ...item.cost_details,
                    distributorPointsPct: Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <textarea
            className="mt-2 w-full rounded-xl border border-line px-2 py-1"
            placeholder={uiLocale === "zh" ? "供应商备注" : "Supplier note"}
            value={item.cost_details.supplierNote ?? ""}
            onChange={(e) =>
              onPatch({
                cost_details: {
                  ...item.cost_details,
                  supplierNote: e.target.value,
                },
              })
            }
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs"
          onClick={onDuplicate}
        >
          <Copy size={14} />
          {uiLocale === "zh" ? "复制报价项" : "Duplicate"}
        </button>
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          onClick={onRemove}
        >
          <Trash2 size={14} />
          {uiLocale === "zh" ? "删除" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-ink-tertiary">
      {label}
      <input
        className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function DiffModal({
  onClose,
  uiLocale,
  prev,
  next,
  rates,
}: {
  onClose: () => void;
  uiLocale: "zh" | "en";
  prev: import("@/lib/domain/types").QuotationRevision;
  next: import("@/lib/domain/types").QuotationRevision;
  rates: import("@/lib/domain/types").RateTable;
}) {
  const d = diffRevisions(prev, next, rates);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-card">
        <div className="mb-4 text-lg font-semibold">
          {uiLocale === "zh" ? "版本差异" : "Revision diff"}
        </div>
        <div className="space-y-2 text-sm text-ink-secondary">
          <div>
            {uiLocale === "zh" ? "新增条目" : "Added items"}: {d.addedItemIds.length}
          </div>
          <div>
            {uiLocale === "zh" ? "删除条目" : "Removed items"}: {d.removedItemIds.length}
          </div>
          <div>
            {uiLocale === "zh" ? "总价变化" : "Total delta"}:{" "}
            {CURRENCY_SYMBOL[next.currency]}
            {d.totalDeltaClient.toFixed(0)}
          </div>
          <div className="mt-3 font-semibold text-ink">
            {uiLocale === "zh" ? "空间涨跌" : "Space deltas"}
          </div>
          <ul className="list-disc pl-5">
            {d.spaceDelta.map((s) => (
              <li key={s.spaceId}>
                {s.label}: {CURRENCY_SYMBOL[next.currency]}
                {s.deltaClient.toFixed(0)}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="mt-6 w-full rounded-full bg-ink py-2 text-sm font-medium text-white"
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
}
