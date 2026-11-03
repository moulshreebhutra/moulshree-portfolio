import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/manrope";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const THEME = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})()`;

export const metadata: Metadata = {
  title: "Rationale: customer feedback in, a ranked roadmap out",
  description: "An AI copilot for product managers. Paste customer feedback, group it by the need underneath, rank themes with arithmetic anyone can check, and draft the PRD. A concept project by Moulshree Bhutra.",
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
