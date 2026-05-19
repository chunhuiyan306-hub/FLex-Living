"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Square, Trash2, XCircle } from "lucide-react";
import type { DrawingPage } from "@/lib/domain/types";
import type { QuotationItem } from "@/lib/domain/types";

type Norm = { nx: number; ny: number; nw: number; nh: number };

function getRectPayload(annots: DrawingPage["screenshots"][0]["annotations"]) {
  const r = annots.find((a) => a.type === "rect");
  const p = r?.payload as
    | { nx?: number; ny?: number; nw?: number; nh?: number }
    | undefined;
  if (
    p &&
    typeof p.nx === "number" &&
    typeof p.ny === "number" &&
    typeof p.nw === "number" &&
    typeof p.nh === "number"
  )
    return p as Norm;
  return null;
}

export default function DrawingRegionPicker({
  uiLocale,
  drawing,
  items,
  onAddRegion,
  onLinkRegion,
  onRemoveScreenshot,
  onRemoveDrawing,
}: {
  uiLocale: "zh" | "en";
  drawing: DrawingPage;
  items: QuotationItem[];
  onAddRegion: (norm: Norm, zhLabel: string, enLabel: string) => void;
  onLinkRegion: (screenshotId: string, itemIds: string[]) => void;
  onRemoveScreenshot: (screenshotId: string) => void;
  onRemoveDrawing: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [marking, setMarking] = useState(false);
  const drag = useRef<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  /** Bumped by ResizeObserver so PDF page scale follows sidebar width changes. */
  const [layoutBump, setLayoutBump] = useState(0);

  const isPdf =
    drawing.mimeType === "application/pdf" ||
    drawing.fileName.toLowerCase().endsWith(".pdf");

  const t = useCallback(
    (zh: string, en: string) => (uiLocale === "zh" ? zh : en),
    [uiLocale],
  );

  useEffect(() => {
    if (!isPdf || !drawing.previewUrl) return;

    let cancel = false;
    const cv = canvasRef.current;
    if (!cv) return;

    setPdfBusy(true);
    setPdfError(null);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjs.getDocument({
          url: drawing.previewUrl!,
        }).promise;
        if (cancel) return;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const maxW = Math.min(wrapRef.current?.clientWidth ?? 520, 640);
        const scale = Math.min(maxW / base.width, 1.85);
        const viewport = page.getViewport({ scale });
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        cv.width = viewport.width;
        cv.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        if (!cancel) {
          console.error(e);
          setPdfError(String(e));
        }
      } finally {
        if (!cancel) setPdfBusy(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [drawing.previewUrl, drawing.id, isPdf, layoutBump]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !isPdf) return;
    const ro = new ResizeObserver(() => setLayoutBump((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPdf]);

  const finishDrag = () => {
    const el = innerRef.current;
    const rect = drag.current;
    drag.current = null;
    setMarking(false);
    if (!el || !rect) return;

    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;

    const x1 = Math.min(rect.startX, rect.curX);
    const y1 = Math.min(rect.startY, rect.curY);
    const x2 = Math.max(rect.startX, rect.curX);
    const y2 = Math.max(rect.startY, rect.curY);
    const rw = x2 - x1;
    const rh = y2 - y1;
    if (rw < 6 || rh < 6) return;

    const norm: Norm = {
      nx: x1 / w,
      ny: y1 / h,
      nw: rw / w,
      nh: rh / h,
    };

    const n = drawing.screenshots.length + 1;
    onAddRegion(
      norm,
      `计价区域 ${n}`,
      `Quoted area ${n}`,
    );
  };

  const overlays = marking && drag.current && innerRef.current;

  const onOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!marking || !innerRef.current) return;
    const box = innerRef.current.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    drag.current = { startX: x, startY: y, curX: x, curY: y };
  };

  const onOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!marking || !drag.current || !innerRef.current) return;
    const box = innerRef.current.getBoundingClientRect();
    drag.current.curX = e.clientX - box.left;
    drag.current.curY = e.clientY - box.top;
    e.currentTarget.style.setProperty("--x1", `${Math.min(drag.current.startX, drag.current.curX)}px`);
    e.currentTarget.style.setProperty("--y1", `${Math.min(drag.current.startY, drag.current.curY)}px`);
    e.currentTarget.style.setProperty(
      "--w",
      `${Math.abs(drag.current.curX - drag.current.startX)}px`,
    );
    e.currentTarget.style.setProperty(
      "--h",
      `${Math.abs(drag.current.curY - drag.current.startY)}px`,
    );
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-2 text-[11px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate font-medium text-ink" title={drawing.name}>
          {drawing.fileName}
        </span>
        <button
          type="button"
          className="shrink-0 rounded-full p-1 text-red-600 hover:bg-red-50"
          title={t("删除图纸文件", "Remove drawing")}
          onClick={() => onRemoveDrawing()}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div
        ref={wrapRef}
        className="flex w-full justify-center overflow-hidden rounded-xl bg-black/5"
      >
        {isPdf ? (
          pdfBusy ? (
            <div className="flex h-40 w-full items-center justify-center text-ink-secondary">
              {t("载入 PDF …", "Loading PDF …")}
            </div>
          ) : pdfError ? (
            <div className="w-full p-3 text-xs text-red-700">
              {t("PDF 预览失败。", "PDF preview failed.")}{" "}
              {pdfError.slice(0, 120)}
            </div>
          ) : (
            <div ref={innerRef} className="relative inline-block max-h-[400px] max-w-full">
              <canvas
                ref={canvasRef}
                className="mx-auto block max-h-[400px] max-w-full"
              />

              {/* 已保存区域 */}
              {drawing.screenshots.map((sh) => {
                const p = getRectPayload(sh.annotations);
                if (!p) return null;
                return (
                  <div
                    key={sh.id}
                    className="pointer-events-none absolute z-[1] border-2 border-amber-500/90 bg-amber-400/15"
                    style={{
                      left: `${p.nx * 100}%`,
                      top: `${p.ny * 100}%`,
                      width: `${p.nw * 100}%`,
                      height: `${p.nh * 100}%`,
                    }}
                    title={sh.name}
                  />
                );
              })}

              {marking && (
                <div
                  role="presentation"
                  className="absolute inset-0 z-[2] cursor-crosshair"
                  style={{
                    background:
                      overlays && drag.current ? undefined : "rgba(0,0,0,0.05)",
                  }}
                  onMouseDown={onOverlayMouseDown}
                  onMouseMove={onOverlayMouseMove}
                  onMouseUp={finishDrag}
                  onMouseLeave={finishDrag}
                >
                  {overlays && drag.current && (
                    <div
                      className="pointer-events-none absolute border-2 border-sky-500 bg-sky-400/25"
                      style={{
                        left: `${Math.min(drag.current.startX, drag.current.curX)}px`,
                        top: `${Math.min(drag.current.startY, drag.current.curY)}px`,
                        width: `${Math.abs(drag.current.curX - drag.current.startX)}px`,
                        height: `${Math.abs(drag.current.curY - drag.current.startY)}px`,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )
        ) : drawing.previewUrl ? (
          <div ref={innerRef} className="relative inline-block max-h-[400px] max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={drawing.previewUrl}
              alt=""
              className="mx-auto block max-h-[400px] max-w-full align-top"
              draggable={false}
            />
            {drawing.screenshots.map((sh) => {
              const p = getRectPayload(sh.annotations);
              if (!p) return null;
              return (
                <div
                  key={sh.id}
                  className="pointer-events-none absolute z-[1] border-2 border-amber-500/90 bg-amber-400/15"
                  style={{
                    left: `${p.nx * 100}%`,
                    top: `${p.ny * 100}%`,
                    width: `${p.nw * 100}%`,
                    height: `${p.nh * 100}%`,
                  }}
                  title={sh.name}
                />
              );
            })}
            {marking && (
              <div
                role="presentation"
                className="absolute inset-0 z-[2] cursor-crosshair"
                style={{
                  background:
                    overlays && drag.current ? undefined : "rgba(0,0,0,0.05)",
                }}
                onMouseDown={onOverlayMouseDown}
                onMouseMove={onOverlayMouseMove}
                onMouseUp={finishDrag}
                onMouseLeave={finishDrag}
              >
                {overlays && drag.current && (
                  <div
                    className="pointer-events-none absolute border-2 border-sky-500 bg-sky-400/25"
                    style={{
                      left: `${Math.min(drag.current.startX, drag.current.curX)}px`,
                      top: `${Math.min(drag.current.startY, drag.current.curY)}px`,
                      width: `${Math.abs(drag.current.curX - drag.current.startX)}px`,
                      height: `${Math.abs(drag.current.curY - drag.current.startY)}px`,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-24 w-full items-center justify-center text-ink-secondary">
            {t("无预览地址", "No preview")}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={clsx(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1",
            marking
              ? "border-sky-600 bg-sky-50 text-sky-900"
              : "border-line bg-surface-muted",
          )}
          onClick={() => {
            if (marking) {
              drag.current = null;
              setMarking(false);
            } else {
              setMarking(true);
            }
          }}
        >
          <Square size={12} />
          {marking
            ? t("取消框选", "Cancel")
            : t("框选举价区域", "Draw quoting area")}
        </button>
      </div>

      <div className="mt-3 space-y-2 border-t border-line/70 pt-2">
        <div className="font-semibold text-ink-tertiary">
          {t("区域与报价行关联", "Link regions to line items")}
        </div>
        {drawing.screenshots.length === 0 ? (
          <div className="text-ink-secondary">
            {t(
              "在图纸上拖拽矩形后，可把该区域对应到表格中的某一报价行（可多选）。",
              "After drawing rectangles, attach them to quotation rows.",
            )}
          </div>
        ) : (
          drawing.screenshots.map((sh) => {
            const ids = [...sh.linkedItemIds];
            return (
              <div
                key={sh.id}
                className="flex flex-col gap-1 rounded-xl bg-surface-muted/50 p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-ink">{sh.name}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-red-600 hover:bg-white"
                    title={t("删除区域", "Remove region")}
                    onClick={() => onRemoveScreenshot(sh.id)}
                  >
                    <XCircle size={14} />
                  </button>
                </div>
                <label className="text-ink-secondary">
                  {t("绑定报价项", "Link items")}
                  {items.length === 0 ? (
                    <div className="mt-1 rounded-xl border border-dashed border-line/80 bg-white/60 px-2 py-2 text-ink-tertiary">
                      {t("当前空间暂无报价行", "No line items in this space.")}
                    </div>
                  ) : (
                    <select
                      multiple
                      className="mt-1 w-full rounded-xl border border-line bg-white px-2 py-1 text-[11px]"
                      size={Math.min(items.length, 5)}
                      value={ids}
                      onChange={(e) => {
                        const next = [...e.target.selectedOptions].map(
                          (o) => o.value,
                        );
                        onLinkRegion(sh.id, next);
                      }}
                    >
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {uiLocale === "zh"
                            ? `${it.nameZh} · ${it.sku}`
                            : `${it.nameEn} · ${it.sku}`}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <p className="text-[10px] text-ink-tertiary">
                  {t(
                    "Windows：按住 Ctrl 点选多项；关联后表格行可作对照。",
                    "Ctrl/Cmd-click multiple rows if needed.",
                  )}
                </p>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
