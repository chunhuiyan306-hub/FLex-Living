"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ExternalLink, Square, Trash2, XCircle } from "lucide-react";
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
  const [dragSeq, setDragSeq] = useState(0);
  const drag = useRef<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);

  /** PDF 画布已绘好第一页；图片模式始终视为可操作。 */
  const [pdfRendered, setPdfRendered] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const isPdf =
    drawing.mimeType === "application/pdf" ||
    drawing.fileName.toLowerCase().endsWith(".pdf");

  const canMark = !isPdf || pdfRendered;

  const t = useCallback(
    (zh: string, en: string) => (uiLocale === "zh" ? zh : en),
    [uiLocale],
  );

  useEffect(() => {
    if (!isPdf || !drawing.previewUrl) {
      setPdfRendered(false);
      setPdfBusy(false);
      setPdfError(null);
      return;
    }

    let alive = true;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setPdfBusy(true);
    setPdfRendered(false);
    setPdfError(null);

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");

        if (typeof window !== "undefined") {
          /** 与主包同目录的 worker，由 scripts/copy-pdf-worker.cjs 复制到 public/ */
          pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
        }

        const pdf = await pdfjs.getDocument({
          url: drawing.previewUrl!,
          withCredentials: false,
        }).promise;
        if (!alive) return;

        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });

        const cw = wrapRef.current?.clientWidth ?? 0;
        const maxW = Math.min(Math.max(cw, 280), 720);
        const scale = Math.min(maxW / base.width, 2);
        const viewport = page.getViewport({ scale });

        const cv = canvasRef.current;
        const ctx = cv?.getContext("2d");
        if (!alive || !cv || !ctx) return;

        cv.width = viewport.width;
        cv.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!alive) return;
        setPdfRendered(true);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setPdfError(String(e));
        setPdfRendered(false);
      } finally {
        if (alive) setPdfBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [drawing.previewUrl, drawing.id, isPdf]);

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
    onAddRegion(norm, `计价区域 ${n}`, `Quoted area ${n}`);
  };

  const overlays = marking && drag.current && innerRef.current;

  const onOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!marking || !innerRef.current) return;
    const box = innerRef.current.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    drag.current = { startX: x, startY: y, curX: x, curY: y };
    setDragSeq((s) => (s + 1) % 1_000_000);
  };

  const onOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!marking || !drag.current || !innerRef.current) return;
    const box = innerRef.current.getBoundingClientRect();
    drag.current.curX = e.clientX - box.left;
    drag.current.curY = e.clientY - box.top;
    setDragSeq((s) => (s + 1) % 1_000_000);
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

      {drawing.previewUrl ? (
        <div className="mb-2 rounded-xl border border-dashed border-line/70 bg-surface-muted/30 px-2 py-2 text-ink-secondary [&_a]:text-sky-700 [&_a:hover]:underline">
          <ol className="list-decimal space-y-0.5 pl-4 leading-relaxed">
            <li>
              {t(
                "等待上方预览出现（PDF 需数秒；若失败可点下方「新窗口打开」）。",
                "Wait for the preview. If it fails, open the file in a new tab below.",
              )}
            </li>
            <li>
              {t(
                "点击「框选举价区域」后，在图面上按住拖动画矩形。",
                "Click “Draw quoting area”, then drag on the image to draw a rectangle.",
              )}
            </li>
            <li>
              {t(
                "在下面「区域与报价行关联」里勾选对应报价行（可多选）。",
                "Below, link each region to one or more quotation rows.",
              )}
            </li>
          </ol>
          <div className="mt-1.5 flex flex-wrap gap-2 pt-1 text-[11px]">
            <a
              href={drawing.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
            >
              <ExternalLink size={12} />
              {t("新窗口打开图纸", "Open file in new tab")}
            </a>
          </div>
        </div>
      ) : null}

      <div
        ref={wrapRef}
        className="relative flex w-full justify-center overflow-hidden rounded-xl bg-black/5 min-h-[120px]"
      >
        {isPdf && drawing.previewUrl ? (
          <div ref={innerRef} className="relative inline-block max-h-[400px] max-w-full align-top">
            <canvas
              ref={canvasRef}
              className="mx-auto block max-h-[400px] max-w-full align-top opacity-95"
              aria-hidden={!pdfRendered}
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

            {marking ? (
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
                {overlays && drag.current ? (
                  <div
                    className="pointer-events-none absolute border-2 border-sky-500 bg-sky-400/25"
                    style={{
                      left: `${Math.min(drag.current.startX, drag.current.curX)}px`,
                      top: `${Math.min(drag.current.startY, drag.current.curY)}px`,
                      width: `${Math.abs(drag.current.curX - drag.current.startX)}px`,
                      height: `${Math.abs(drag.current.curY - drag.current.startY)}px`,
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {(pdfBusy || !pdfRendered) && pdfError === null ? (
              <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2 bg-black/30 px-3 text-center text-white">
                <div className="text-xs font-medium">
                  {pdfBusy
                    ? t("载入 PDF…", "Loading PDF…")
                    : t(
                        "预览准备中…",
                        "Rendering…",
                      )}
                </div>
              </div>
            ) : null}

            {pdfError ? (
              <div className="absolute inset-0 z-[4] overflow-auto bg-black/80 p-2 text-[11px] leading-snug text-white">
                <div className="font-semibold">
                  {t("PDF 无法在此侧边栏渲染", "Could not render PDF here")}
                </div>
                <p className="mt-1 text-white/90">{pdfError.slice(0, 220)}</p>
                <a
                  href={drawing.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 underline"
                >
                  <ExternalLink size={12} />
                  {t("用浏览器自带阅读器打开", "Open with browser")}
                </a>
              </div>
            ) : null}
          </div>
        ) : drawing.previewUrl ? (
          <div ref={innerRef} className="relative inline-block max-h-[400px] max-w-full align-top">
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
            {marking ? (
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
                {overlays && drag.current ? (
                  <div
                    className="pointer-events-none absolute border-2 border-sky-500 bg-sky-400/25"
                    style={{
                      left: `${Math.min(drag.current.startX, drag.current.curX)}px`,
                      top: `${Math.min(drag.current.startY, drag.current.curY)}px`,
                      width: `${Math.abs(drag.current.curX - drag.current.startX)}px`,
                      height: `${Math.abs(drag.current.curY - drag.current.startY)}px`,
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[6rem] w-full items-center justify-center text-ink-secondary">
            {t("无预览地址", "No preview")}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!drawing.previewUrl || !canMark || Boolean(pdfError)}
          title={
            !drawing.previewUrl
              ? ""
              : !canMark && isPdf
                ? t("请等待 PDF 预览就绪", "Wait for PDF to finish loading.")
                : ""
          }
          className={clsx(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1",
            marking
              ? "border-sky-600 bg-sky-50 text-sky-900"
              : "border-line bg-surface-muted",
            (!drawing.previewUrl || !canMark || Boolean(pdfError)) &&
              "cursor-not-allowed opacity-55",
          )}
          onClick={() => {
            if (!drawing.previewUrl || !canMark || pdfError) return;
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
              "画好矩形后会出现在此处，再把区域绑定到表格中的报价行。",
              "Regions show up here; link each one to quotation rows.",
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
                    "按住 Ctrl（Mac 用 ⌘）可点选多条。",
                    "Ctrl/Cmd-click to select multiple rows.",
                  )}
                </p>
              </div>
            );
          })
        )}
      </div>
      {marking ? <span aria-hidden className="sr-only">{dragSeq}</span> : null}
    </div>
  );
}
