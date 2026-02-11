export interface RollupViewerProps {
  weekStart: string;
  weekEnd: string;
  summaryMd: string;
}

export const RollupViewer = ({ weekStart, weekEnd, summaryMd }: RollupViewerProps) => {
  return (
    <article className="rounded border border-slate-800 bg-slate-900 p-4">
      <h3 className="font-medium text-white">
        Week {weekStart} → {weekEnd}
      </h3>
      <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-200">{summaryMd}</pre>
    </article>
  );
};
