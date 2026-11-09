import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Aster",
  icons: { icon: "/icon.svg" },
  description:
    "Aster answers questions about your own money. Every number comes from your transactions, every answer is scored by evals, every figure shows its working.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Light by default; only go dark if the visitor chose it before. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('aster-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}" }} />
      </head>
      <body className="min-h-screen font-sans">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-mut">
          Aster · prototype on synthetic data · grounded in tools, scored by evals, guarded for safety · not financial advice
        </footer>
      </body>
    </html>
  );
}
