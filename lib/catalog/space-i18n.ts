import type { ProductSystemCategory, CurrencyCode } from "../domain/types";

export const SPACE_PRESETS: Array<{
  key: string;
  nameZh: string;
  nameEn: string;
}> = [
  { key: "living_room", nameZh: "客厅", nameEn: "Living Room" },
  { key: "kitchen", nameZh: "厨房", nameEn: "Kitchen" },
  { key: "master_bedroom", nameZh: "主卧", nameEn: "Master Bedroom" },
  { key: "secondary_bedroom", nameZh: "次卧", nameEn: "Secondary Bedroom" },
  { key: "walk_in_closet", nameZh: "衣帽间", nameEn: "Walk-in Closet" },
  { key: "bathroom", nameZh: "卫浴", nameEn: "Bathroom" },
  { key: "lobby", nameZh: "玄关", nameEn: "Lobby" },
  { key: "study", nameZh: "书房", nameEn: "Study" },
];

export function mapSpaceLabel(label: string): {
  key: string;
  nameZh: string;
  nameEn: string;
} | null {
  const t = label.trim().toLowerCase();
  for (const s of SPACE_PRESETS) {
    if (t === s.key.replace("_", " ")) return s;
    if (t === s.nameEn.toLowerCase()) return s;
    if (t === s.nameZh) return s;
  }
  const contains = (a: string, b: string) => a.includes(b);
  for (const s of SPACE_PRESETS) {
    if (contains(t, s.nameEn.toLowerCase())) return s;
  }
  return null;
}

export const PRODUCT_SYSTEM_LABEL: Record<
  ProductSystemCategory,
  { zh: string; en: string }
> = {
  door: { zh: "门系统", en: "Door System" },
  wall_panel: { zh: "墙板系统", en: "Wall Paneling" },
  cabinet: { zh: "柜体系统", en: "Cabinetry" },
  kitchen: { zh: "厨房系统", en: "Kitchen Suite" },
  storage: { zh: "收纳系统", en: "Storage" },
  finish: { zh: "饰面系统", en: "Finishes" },
  lighting: { zh: "灯光系统", en: "Lighting" },
  hardware: { zh: "五金系统", en: "Hardware" },
};

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  CNY: "¥",
  USD: "$",
  SGD: "S$",
  EUR: "€",
  SAR: "﷼",
};
