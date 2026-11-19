import "./globals.css";
export const metadata = { title: "PM Job Radar", description: "Daily PM job matches with outreach drafts" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
