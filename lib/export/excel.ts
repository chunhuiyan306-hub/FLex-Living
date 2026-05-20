import * as XLSX from "xlsx";
import type {
  QuotationItem,
  QuotationRevision,
  SpaceNode,
} from "../domain/types";
import { resolveProduct } from "../catalog/price-library";
import { computeLine, moneyFromCNY } from "../pricing/engine";
import { PRODUCT_SYSTEM_LABEL } from "../catalog/space-i18n";

export function buildWorkbook(
  rev: QuotationRevision,
  mode: "internal" | "client",
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const ratesRow = Object.entries(rev.rates.cnyPerUnit)
    .map(([k, v]) => `${k}:${v}`)
    .join(" | ");

  const summaryMeta = [
    ["Brand", rev.project.brand],
    ["Project", rev.project.projectName],
    ["Client", rev.project.clientName],
    ["Quotation No.", rev.project.quotationNo],
    ["Date", rev.project.date],
    ["Revision", rev.meta.label],
    ["Currency", rev.currency],
    ["FX (CNY per unit)", ratesRow],
    ["Quoted by", rev.project.quotedBy],
    ["Reviewed by", rev.project.reviewedBy],
  ];

  if (mode === "internal") {
    summaryMeta.push(["Mode", "Internal"]);
  } else {
    summaryMeta.push(["Mode", "Client"]);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(summaryMeta);
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  const spaceRows: (string | number)[][] = [
    ["Level", "Space (ZH)", "Space (EN)", "Subtotal"],
  ];
  for (const lvl of rev.levels) {
    for (const sp of lvl.spaces) {
      let sub = 0;
      for (const it of sp.items) {
        sub += computeLine(it, resolveProduct(it), rev.rates)
          .clientPrice;
      }
      spaceRows.push([lvl.name, sp.nameZh, sp.nameEn, sub]);
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet(spaceRows);
  XLSX.utils.book_append_sheet(wb, ws2, "By Space");

  const detailHeader = [
    "Space",
    "System",
    "SKU",
    "Name (ZH/EN)",
    "W mm",
    "H mm",
    "D mm",
    "Method",
    "Qty eff.",
    "Unit list",
    "Client line",
    "Finish",
    "Hardware",
    "Lighting",
    "Note",
    "Screenshot",
    ...(mode === "internal"
      ? [
          "Factory cost",
          "Distributor %",
          "Supplier quote",
          "Internal remark",
          "Audit",
          "Formula",
        ]
      : []),
  ];

  const details: (string | number)[][] = [detailHeader];

  function screenshotNames(space: SpaceNode, item: QuotationItem) {
    const names: string[] = [];
    for (const d of space.drawings) {
      for (const s of d.screenshots) {
        if (item.screenshotIds.includes(s.id)) {
          const p = s.pdfPage;
          names.push(
            typeof p === "number" && p >= 1 ? `${s.name} (P${p})` : s.name,
          );
        }
      }
    }
    return names.join("; ");
  }

  for (const lvl of rev.levels) {
    for (const sp of lvl.spaces) {
      for (const it of sp.items) {
        const prod = resolveProduct(it);
        const line = computeLine(it, prod, rev.rates);
        const sys = PRODUCT_SYSTEM_LABEL[it.productSystem];
        const row: (string | number)[] = [
          sp.nameZh,
          sys.zh,
          it.sku,
          `${it.nameZh} / ${it.nameEn}`,
          it.dimensionsMm.width ?? "",
          it.dimensionsMm.height ?? "",
          it.dimensionsMm.depth ?? "",
          it.quoteMethod,
          line.qty,
          moneyFromCNY(
            line.unitRrpCny,
            rev.rates.base,
            rev.rates,
          ),
          line.clientPrice,
          `${it.finishGrade} · ${it.finishMaterialZh}`,
          it.hardwareNoteZh,
          it.lightingNoteZh,
          it.remarkZh,
          screenshotNames(sp, it),
        ];
        if (mode === "internal") {
          row.push(
            it.cost_details.factoryCost,
            it.cost_details.distributorPointsPct,
            it.cost_details.supplierQuote ?? "",
            it.internalRemark ?? "",
            it.cost_details.internalAuditStatus ?? "",
            line.formulaZh,
          );
        }
        details.push(row);
      }
    }
  }

  const ws3 = XLSX.utils.aoa_to_sheet(details);
  XLSX.utils.book_append_sheet(wb, ws3, "Line Items");

  return wb;
}

export function downloadExcel(
  rev: QuotationRevision,
  fileBase: string,
  mode: "internal" | "client",
) {
  const wb = buildWorkbook(rev, mode);
  const name = `${fileBase}_${mode === "client" ? "client" : "internal"}.xlsx`;
  XLSX.writeFile(wb, name);
}
