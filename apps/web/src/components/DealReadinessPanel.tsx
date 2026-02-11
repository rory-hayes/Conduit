interface DealFact {
  key: string;
  value_json: unknown;
  confidence: number;
}

interface DealReadiness {
  framework: string;
  missing_keys: string[];
  readiness_score: number;
}

interface DealReadinessPanelProps {
  readiness: DealReadiness | null;
  facts: DealFact[];
  suggestedQuestions: string[];
}

export function DealReadinessPanel({ readiness, facts, suggestedQuestions }: DealReadinessPanelProps) {
  if (!readiness) {
    return <p className="text-sm text-slate-400">Deal readiness unavailable until a deal is linked.</p>;
  }

  return (
    <section className="space-y-3 rounded border border-slate-800 bg-slate-900 p-4 text-sm text-slate-200">
      <h3 className="font-medium text-white">Deal Readiness ({readiness.framework})</h3>
      <div>
        <p className="text-slate-300">Readiness Score: {Math.round(readiness.readiness_score)}%</p>
        <div className="mt-2 h-2 rounded bg-slate-700">
          <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.round(readiness.readiness_score)}%` }} />
        </div>
      </div>

      <div>
        <p className="font-medium text-white">Missing Checklist Items</p>
        {readiness.missing_keys.length === 0 ? (
          <p className="text-emerald-300">All BANT items captured.</p>
        ) : (
          <ul className="list-disc pl-5 text-slate-300">
            {readiness.missing_keys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="font-medium text-white">Suggested Questions</p>
        <ul className="list-disc pl-5 text-slate-300">
          {suggestedQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>

      <div>
        <p className="font-medium text-white">Create Task Actions</p>
        <ul className="list-disc pl-5 text-slate-300">
          {readiness.missing_keys.map((key) => (
            <li key={`task-${key}`}>Create task: clarify {key}</li>
          ))}
        </ul>
      </div>

      <div>
        <p className="font-medium text-white">Captured Facts</p>
        <ul className="list-disc pl-5 text-slate-300">
          {facts.map((fact) => (
            <li key={fact.key}>
              {fact.key}: {JSON.stringify(fact.value_json)} ({Math.round(fact.confidence * 100)}%)
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
