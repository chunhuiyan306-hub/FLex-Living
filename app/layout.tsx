import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLEXLIVING 凡仕之家 · 报价工作台",
  description: "FLEXLIVING whole-house millwork quotation workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-surface">{children}</body>
    </html>
  );
}
