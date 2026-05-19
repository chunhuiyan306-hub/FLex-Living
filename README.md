# 凡仕之家全案报价

## 更新价格库与产品图（Excel）

1. 将你的报价簿放在桌面或任意路径，确保列含 **拟定成交价** / **建议成交价** / **含税*价** 之一，以及型号、规格等（与导出脚本 `build_column_map` 对齐）。
2. 在项目根执行（可合并多个簿）：

```bash
python scripts/xlsx_to_prices.py "c:\路径\报价文件2025-7-22A1.xlsx"
python scripts/xlsx_to_prices.py 主簿.xlsx 衣柜补充.xlsx
```

3. 会生成 / 覆盖 **`lib/catalog/xlsx-imported-products.ts`**；工作表内的嵌入图导出到 **`public/catalog/imported/`**（提交部署时需一并提交）。
4. 然后执行 **`npm run build`** 或通过 CI 构建。

侧栏 **PDF 图纸预览** 依赖 `pdfjs-dist` 的 Worker：`npm install` / `npm run dev` / `npm run build` 时会自动将 `pdf.worker.min.mjs` 复制到 **`public/pdf.worker.min.mjs`**（与主站同源加载，避免外网 CDN 被墙或阻塞导致一直卡在「载入 PDF」）。

无默认命令行参数时，脚本使用 `scripts/xlsx_to_prices.py` 内置的桌面默认路径。
