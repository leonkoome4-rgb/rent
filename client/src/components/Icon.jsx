const PATHS = {
  home: (
    <>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  gradCap: (
    <>
      <path d="M2 9.5 12 5l10 4.5-10 4.5L2 9.5Z" />
      <path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" />
      <path d="M21 10v5.5" />
    </>
  ),
  handshake: (
    <>
      <path d="M8 12 3 7l4-4 4 4" />
      <path d="M16 12l5-5-4-4-4 4" />
      <path d="M8 12l3.2 3.2a1.7 1.7 0 0 0 2.4 0l.2-.2a1.7 1.7 0 0 0 0-2.4L11 9.8" />
      <path d="M11 9.8 9.2 8" />
      <path d="M16 12l-3.2 3.2a1.7 1.7 0 0 1-2.4 0" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
    </>
  ),
  zap: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  coins: (
    <>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M14.5 12.7A6.5 6.5 0 1 1 11.3 3" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 9v4" />
      <path d="M10.3 3.9l-8 14A1.5 1.5 0 0 0 3.6 20h16.8a1.5 1.5 0 0 0 1.3-2.1l-8-14a1.5 1.5 0 0 0-2.6 0z" />
      <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  printer: (
    <>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="1.5" />
      <path d="M6 14h12v7H6z" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    </>
  ),
};

export function Icon({ name, size = 16, style, className }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {path}
    </svg>
  );
}
