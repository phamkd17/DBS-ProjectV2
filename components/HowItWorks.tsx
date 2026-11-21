// Issue #1 / #4: the three tabs, explained with icons instead of paragraphs.
// Draft wording: for the student to review.

const STEPS = [
  { tab: "Ideas", line: "Save what inspires you", Icon: BulbIcon },
  { tab: "Development", line: "Type or dictate it. The AI asks what's missing", Icon: MicIcon },
  { tab: "Finished", line: "Cook it, keep it, or send it", Icon: BookIcon },
];

export function HowItWorks({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <ol className="grid gap-px border border-ls-ink bg-ls-ink sm:grid-cols-3">
      {STEPS.map(({ tab, line, Icon }, i) => (
        <li key={tab} className="flex items-start gap-4 bg-ls-surface p-5 sm:flex-col sm:gap-3">
          <span aria-hidden className="flex items-center gap-3 text-ls-ink">
            <span className="font-ls-serif text-3xl leading-none text-ls-muted">{i + 1}</span>
            <Icon />
          </span>
          <span className="space-y-1">
            <H className="font-ls-sans text-xs font-medium uppercase tracking-[0.18em]">{tab}</H>
            <span className="block font-ls-serif text-xl leading-snug">{line}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const ICON = "size-7 shrink-0";
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function BulbIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={ICON}>
      <path {...STROKE} d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={ICON}>
      <path {...STROKE} d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={ICON}>
      <path {...STROKE} d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 21H20M8.5 10l2 2 4-4" />
    </svg>
  );
}
