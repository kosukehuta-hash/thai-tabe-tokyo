import type { Metadata } from "next";
import { Geist, Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "THAI TABE TOKYO",
  description:
    "東京都内のタイ料理店を、エリア・時間帯・利用シーン・料理から検索できます。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${notoSerifJP.variable}`}>
      <body>{children}</body>
    </html>
  );
}
