/** The portfolio's Shelfmate mark: a tall lavender bottle between two outlined ones on a shelf. It rises into place once on load. */
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo" viewBox="0 0 48 48" width={size} height={size} role="img" aria-label="Shelfmate logo">
      <rect x="1" y="1" width="46" height="46" rx="12" fill="none" stroke="var(--line2)" strokeWidth="1.5" />
      <path d="M7 38.5H41" fill="none" stroke="var(--muted)" strokeWidth="2.6" strokeLinecap="round" />
      <rect className="lg lg1" x="8.5" y="22" width="9.5" height="16" rx="3.4" fill="none" stroke="var(--muted)" strokeWidth="2.4" />
      <rect className="lg lg3" x="30" y="25" width="9.5" height="13" rx="3.4" fill="none" stroke="var(--muted)" strokeWidth="2.4" />
      <g className="lg lg2"><rect x="19" y="12" width="10" height="26" rx="4" fill="var(--accent)" /><rect x="21.5" y="7.5" width="5" height="5" rx="1.4" fill="var(--accent)" /></g>
    </svg>
  );
}
