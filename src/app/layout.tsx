import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/settings";

const notoSans = Noto_Sans_JP({
  variable: "--font-sans",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_JP({
  variable: "--font-serif-jp",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: {
      default: settings.app_name,
      template: `%s | ${settings.app_name}`,
    },
    description: `${settings.store_name}の${settings.app_name}。用途・予算・お好みに合わせて、最適な和紙をご提案します。`,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSans.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
