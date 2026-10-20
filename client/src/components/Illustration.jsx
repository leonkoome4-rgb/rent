// Small flat illustrations for empty states, drawn in the app's palette so they
// sit naturally next to the cards (navy #393680, blue #3fa6dd, green #1d9e75).
const ART = {
  building: (
    <>
      <ellipse cx="80" cy="128" rx="62" ry="8" fill="#e4e4ef" />
      <rect x="34" y="30" width="58" height="96" rx="4" fill="#393680" />
      <rect x="92" y="58" width="36" height="68" rx="4" fill="#3fa6dd" />
      {[0, 1, 2, 3, 4].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={42 + c * 16} y={40 + r * 16} width="10" height="9" rx="1.5" fill={r === 1 && c === 2 ? '#ef9f27' : '#6cc3ef'} opacity={r === 1 && c === 2 ? 1 : 0.55} />
        ))
      )}
      {[0, 1, 2].map((r) => (
        <rect key={r} x="102" y={68 + r * 16} width="16" height="9" rx="1.5" fill="#fff" opacity="0.6" />
      ))}
      <rect x="56" y="108" width="14" height="18" rx="2" fill="#f5f6fb" />
      <circle cx="128" cy="34" r="14" fill="#1d9e75" />
      <path d="M121 34l5 5 9-10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  allPaid: (
    <>
      <ellipse cx="80" cy="128" rx="56" ry="8" fill="#e4e4ef" />
      <rect x="44" y="18" width="72" height="104" rx="8" fill="#fff" stroke="#e4e4ef" strokeWidth="2" />
      <rect x="56" y="34" width="48" height="6" rx="3" fill="#393680" />
      <rect x="56" y="48" width="34" height="5" rx="2.5" fill="#e4e4ef" />
      <rect x="56" y="60" width="40" height="5" rx="2.5" fill="#e4e4ef" />
      <rect x="56" y="72" width="28" height="5" rx="2.5" fill="#e4e4ef" />
      <circle cx="80" cy="100" r="14" fill="#1d9e75" />
      <path d="M73 100l5 5 9-10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  inbox: (
    <>
      <ellipse cx="80" cy="128" rx="58" ry="8" fill="#e4e4ef" />
      <rect x="34" y="40" width="92" height="64" rx="10" fill="#393680" />
      <path d="M34 50l46 30 46-30" stroke="#6cc3ef" strokeWidth="4" fill="none" strokeLinejoin="round" />
      <rect x="96" y="22" width="46" height="30" rx="8" fill="#3fa6dd" />
      <circle cx="108" cy="37" r="3" fill="#fff" />
      <circle cx="119" cy="37" r="3" fill="#fff" />
      <circle cx="130" cy="37" r="3" fill="#fff" />
    </>
  ),
  phonePay: (
    <>
      <ellipse cx="80" cy="128" rx="50" ry="8" fill="#e4e4ef" />
      <rect x="52" y="14" width="56" height="110" rx="10" fill="#393680" />
      <rect x="58" y="26" width="44" height="80" rx="4" fill="#f5f6fb" />
      <rect x="64" y="36" width="32" height="6" rx="3" fill="#1d9e75" />
      <rect x="64" y="50" width="22" height="5" rx="2.5" fill="#e4e4ef" />
      <rect x="64" y="60" width="28" height="5" rx="2.5" fill="#e4e4ef" />
      <rect x="64" y="82" width="32" height="14" rx="4" fill="#3fa6dd" />
      <circle cx="80" cy="115" r="3.5" fill="#6cc3ef" />
    </>
  ),
};

export function Illustration({ name, size = 140, className }) {
  return (
    <svg
      width={size}
      height={(size * 140) / 160}
      viewBox="0 0 160 140"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      {ART[name]}
    </svg>
  );
}

/** Card-sized empty state: illustration, a short headline, one line of help, optional action. */
export function EmptyState({ art, title, children, action }) {
  return (
    <div className="empty-illustrated">
      <Illustration name={art} />
      <h4>{title}</h4>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
