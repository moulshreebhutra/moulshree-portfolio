export function Logo({ size = 28 }: { size?: number }) {
  const id = "asterGrad";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Aster logo">
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a98bff" />
          <stop offset="1" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="#141a22" stroke="url(#asterGrad)" strokeWidth="1.5" />
      {/* Six-point asterisk mark — the "aster" (star) */}
      <g className="as-g" stroke={`url(#${id})`} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path className="as-b as-1" pathLength={1} d="M24 12V36" />
        <path className="as-b as-2" pathLength={1} d="M13.6 18L34.4 30" />
        <path className="as-b as-3" pathLength={1} d="M13.6 30L34.4 18" />
      </g>
      <circle className="as-dot" cx="24" cy="24" r="3.6" fill="#0e1116" stroke={`url(#${id})`} strokeWidth="2.4" />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <Logo size={size} />
      <span className="text-[1.15rem] font-semibold tracking-tight text-fg">
        Aster
      </span>
    </div>
  );
}
