"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Image,
} from "@react-pdf/renderer";
import type { QuotationRevision } from "@/lib/domain/types";
import { CURRENCY_SYMBOL, PRODUCT_SYSTEM_LABEL } from "@/lib/catalog/space-i18n";
import { findLibraryEntry } from "@/lib/catalog/price-library";
import { computeLine } from "@/lib/pricing/engine";
import { flattenRevisionItems, revisionTotals } from "@/lib/validation/checks";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1d1d1f",
  },
  coverTitle: { fontSize: 26, marginBottom: 12 },
  coverSub: { fontSize: 12, color: "#6e6e73", marginBottom: 4 },
  h2: { fontSize: 14, marginTop: 18, marginBottom: 8, fontWeight: 700 },
  table: {
    borderWidth: 1,
    borderColor: "#d2d2d7",
    borderStyle: "solid",
  },
  row: { flexDirection: "row" },
  cell: {
    flexGrow: 1,
    borderRightWidth: 1,
    borderColor: "#d2d2d7",
    padding: 6,
    fontSize: 9,
  },
  cellLast: { flexGrow: 1, padding: 6, fontSize: 9 },
  banner: {
    position: "absolute",
    bottom: 24,
    right: 28,
    fontSize: 42,
    color: "#e5e5ea",
    transform: "rotate(-30deg)",
  },
});

function watermark(rev: QuotationRevision) {
  return (
    <Text style={styles.banner} fixed>
      {rev.meta.label}
    </Text>
  );
}

export async function buildCustomerPdfBlob(rev: QuotationRevision) {
  const locale = "en" as const;
  const sym = CURRENCY_SYMBOL[rev.currency];
  const items = flattenRevisionItems(rev);
  const grand = revisionTotals(items, rev.rates).client;

  const Doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {watermark(rev)}
        <Text style={styles.coverTitle}>Quotation</Text>
        <Text style={styles.coverSub}>{rev.project.brand}</Text>
        <Text style={styles.coverSub}>Project: {rev.project.projectName}</Text>
        <Text style={styles.coverSub}>Client: {rev.project.clientName}</Text>
        <Text style={styles.coverSub}>No. {rev.project.quotationNo}</Text>
        <Text style={styles.coverSub}>
          {rev.project.date} · {rev.meta.label}
        </Text>
        <Text style={styles.h2}>Project Overview</Text>
        <Text style={{ color: "#6e6e73", marginBottom: 8 }}>
          This proposal covers interior millwork and related packages as
          listed. All dimensions are in millimeters (mm) unless stated.
        </Text>
        <Text style={styles.h2}>Space Summary</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.cell, { fontWeight: 700 }]}>Space</Text>
            <Text style={[styles.cellLast, { fontWeight: 700 }]}>
              Subtotal ({rev.currency})
            </Text>
          </View>
          {rev.levels.flatMap((l) =>
            l.spaces.map((s) => {
              const sub = revisionTotals(s.items, rev.rates).client;
              const name = locale === "en" ? s.nameEn : s.nameZh;
              return (
                <View style={styles.row} key={s.id}>
                  <Text style={styles.cell}>{name}</Text>
                  <Text style={styles.cellLast}>
                    {sym}
                    {sub.toFixed(0)}
                  </Text>
                </View>
              );
            }),
          )}
        </View>
        <Text style={styles.h2}>Details</Text>
        {rev.levels.flatMap((l) =>
          l.spaces.map((sp) => (
            <View key={sp.id} style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: 700, marginBottom: 4 }}>
                {sp.nameEn}
              </Text>
              {sp.items.map((it) => {
                const line = computeLine(
                  it,
                  findLibraryEntry(it.libraryRuleId),
                  rev.rates,
                );
                const sys = PRODUCT_SYSTEM_LABEL[it.productSystem].en;
                const shot =
                  sp.drawings.flatMap((d) => d.screenshots).find((sh) =>
                    it.screenshotIds.includes(sh.id),
                  ) ?? null;
                return (
                  <View key={it.id} style={{ marginBottom: 6 }}>
                    <Text>
                      {sys} · {it.nameEn} ({it.sku})
                    </Text>
                    <Text style={{ color: "#6e6e73" }}>
                      Size W/H/D: {it.dimensionsMm.width ?? "—"} ×{" "}
                      {it.dimensionsMm.height ?? "—"} ×{" "}
                      {it.dimensionsMm.depth ?? "—"} mm · Finish{" "}
                      {it.finishGrade} · {it.finishMaterialEn}
                    </Text>
                    <Text style={{ color: "#6e6e73" }}>
                      Line total: {sym}
                      {line.clientPrice.toFixed(0)}
                    </Text>
                    {shot?.dataUrl ? (
                      // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image is not an HTML img
                      <Image
                        src={shot.dataUrl}
                        style={{ width: 180, height: 120, objectFit: "contain" }}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          )),
        )}
        <Text style={styles.h2}>Exclusions</Text>
        <Text style={{ color: "#6e6e73" }}>
          Unless explicitly included, pricing excludes appliances, loose
          accessories, stone supply outside listed modules, site utilities, and
          third-party trades. Refer to line-item exclusions for specifics.
        </Text>
        <Text style={styles.h2}>Grand Total</Text>
        <Text style={{ fontSize: 18 }}>
          {sym}
          {grand.toFixed(0)} {rev.currency}
        </Text>
      </Page>
    </Document>
  );

  return pdf(Doc).toBlob();
}
