export interface RollupViewerProps {
  weekStart: string;
  weekEnd: string;
  summaryMd: string;
  highlights?: { events?: string[]; risks?: string[]; next_actions?: string[] };
  generationMethod?: 'deterministic' | 'llm' | 'llm_fallback';
}

const badgeMap: Record<NonNullable<RollupViewerProps['generationMethod']>, string> = {
  deterministic: 'Deterministic',
  llm: 'AI Generated',
  llm_fallback: 'AI Fallback'
};

export const RollupViewer = ({
  weekStart,
  weekEnd,
  summaryMd,
  highlights = {},
  generationMethod = 'deterministic'
}: RollupViewerProps) => {
  return (
    <article className="rounded border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-white">
          Week {weekStart} → {weekEnd}
        </h3>
        <span className="rounded bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-200">
          {badgeMap[generationMethod]}
        </span>
      </div>
      <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-200">{summaryMd}</pre>
      <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-3">
        <section>
          <h4 className="font-medium text-slate-100">Events</h4>
          {(highlights.events ?? []).slice(0, 4).map((item) => (
            <p key={item}>• {item}</p>
          ))}
        </section>
        <section>
          <h4 className="font-medium text-slate-100">Risks</h4>
          {(highlights.risks ?? []).slice(0, 4).map((item) => (
            <p key={item}>• {item}</p>
          ))}
        </section>
        <section>
          <h4 className="font-medium text-slate-100">Next actions</h4>
          {(highlights.next_actions ?? []).slice(0, 4).map((item) => (
            <p key={item}>• {item}</p>
          ))}
        </section>
      </div>
    </article>
  );
};
