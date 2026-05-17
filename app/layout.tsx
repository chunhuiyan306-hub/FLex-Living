import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "凡仕之家 · 全屋定制报价",
  description: "Flex Living whole-house quotation workspace",
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
