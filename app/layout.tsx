import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ポジネガ指数",
  description: "多数の情報源をAIで分析し、いまポジかネガかを一発表示",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
