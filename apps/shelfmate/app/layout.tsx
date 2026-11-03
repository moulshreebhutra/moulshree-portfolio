import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/manrope";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Shell from "@/components/Shell";

const THEME = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})()`;

export const metadata: Metadata = {
  title: "Shelfmate: a skincare routine that builds itself",
  description: "An AI routine builder for a skincare brand. Shoppers answer a few questions and get a bundle built only from the store's catalog. The merchant dashboard shows what happened. A concept project by Moulshree Bhutra.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body><Shell>{children}</Shell><Analytics /></body>
    </html>
  );
}
