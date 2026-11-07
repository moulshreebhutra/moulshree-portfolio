import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/manrope";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const THEME = `(function(){var t="light";try{if(localStorage.getItem("theme")==="dark")t="dark"}catch(e){}document.documentElement.dataset.theme=t})()`;

export const metadata: Metadata = {
  title: "Rationale: turn customer feedback into what to build next",
  description: "Paste customer feedback and get a ranked list of what to build first, plus a one-page spec for the top item. A concept project by Moulshree Bhutra.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
