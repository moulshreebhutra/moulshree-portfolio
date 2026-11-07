import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/manrope";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Shell from "@/components/Shell";

const THEME = `(function(){var t="light";try{if(localStorage.getItem("theme")==="dark")t="dark"}catch(e){}document.documentElement.dataset.theme=t})()`;

export const metadata: Metadata = {
  title: "Shelfmate: your skincare routine, built in a minute",
  description: "Answer three questions and get a skincare routine built from the store's own shelf. The merchant view shows what shoppers did. A concept project by Moulshree Bhutra.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body><Shell>{children}</Shell><Analytics /></body>
    </html>
  );
}
