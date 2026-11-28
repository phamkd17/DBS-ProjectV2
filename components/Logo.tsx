/**
 * The logo (student, Nov 28; option P4c in notes/design/logo-options-P4.html):
 * a solid ink notebook cover with a Plaster mortar and a slim red pestle.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="8" y="4" width="25" height="32" fill="#1c1d1f" stroke="#1c1d1f" strokeWidth="2" />
      <path d="M12 4v32" stroke="#f8f6f1" strokeWidth="1.4" />
      <g stroke="#f8f6f1" strokeWidth="2">
        <path d="M14.5 19h16c0 5.5-3.6 9.5-8 9.5s-8-4-8-9.5z" />
        <path d="M19 28.5l-1.2 3h9.4l-1.2-3" />
      </g>
      <g transform="translate(24.5 17) rotate(35)">
        <path d="M-0.55 -11h1.1L1.2 0a1.2 1.2 0 0 1-2.4 0z" fill="#ae1f2e" stroke="#ae1f2e" strokeWidth="1" />
      </g>
    </svg>
  );
}
