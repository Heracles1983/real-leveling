import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "现实练级 · 林间远征",
  description: "同步运动记录，培养你的像素冒险者。自由加点、锻造装备，挑战林间守卫。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
