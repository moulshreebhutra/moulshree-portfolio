/** The portfolio's Rationale mark: three ranked bars in an outlined tile. The bars draw themselves in once on load. */
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo" viewBox="0 0 48 48" width={size} height={size} role="img" aria-label="Rationale logo">
      <rect x="1" y="1" width="46" height="46" rx="12" fill="none" stroke="var(--line2)" strokeWidth="1.5" />
      <path className="lb lb1" pathLength={1} d="M10 15H38" fill="none" stroke="var(--accent)" strokeWidth="4.6" strokeLinecap="round" />
      <path className="lb lb2" pathLength={1} d="M10 24.5H29" fill="none" stroke="var(--muted)" strokeWidth="4.6" strokeLinecap="round" />
      <path className="lb lb3" pathLength={1} d="M10 34H21" fill="none" stroke="var(--muted)" strokeWidth="4.6" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
