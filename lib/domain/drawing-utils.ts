import type { DrawingScreenshot } from "./types";

/** 该区域是否带有用于计价的矩形框选（归一化坐标） */
export function screenshotHasPricingRect(sh: DrawingScreenshot): boolean {
  const r = sh.annotations.find((a) => a.type === "rect");
  const p = r?.payload as
    | { nx?: unknown; ny?: unknown; nw?: unknown; nh?: unknown }
    | undefined;
  return (
    typeof p?.nx === "number" &&
    typeof p?.ny === "number" &&
    typeof p?.nw === "number" &&
    typeof p?.nh === "number"
  );
}
