import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Adjective Parade（形容詞パレード）", description: "同じ形容詞を持つカードを探しながら、英語の形容詞の順番を学ぶ神経衰弱ゲーム。", icons: { icon: "/favicon.svg" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#092d35" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ja"><body>{children}</body></html>; }
