import { formatConfidence, getThreadDetail } from '../../../lib/queries';

interface ThreadPageProps {
  params: { threadId: string };
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const detail = await getThreadDetail(params.threadId);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Thread {params.threadId}</h2>

      <div>
        <h3 className="font-medium text-white">Messages</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          {detail.messages.map((message) => (
            <li key={message.id} className="rounded border border-slate-800 bg-slate-900 p-3">
              <p>{message.subject}</p>
              <p>{message.from_email}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-medium text-white">Extracted Fields</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          {detail.fields.map((field, index) => (
            <li key={`${field.field_key}-${index}`}>
              {field.field_key}: {JSON.stringify(field.field_value_json)} ({formatConfidence(field.confidence)})
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-medium text-white">Review Items</h3>
        <pre className="text-xs text-slate-300">{JSON.stringify(detail.reviewItems, null, 2)}</pre>
      </div>

      <div>
        <h3 className="font-medium text-white">CRM Writes</h3>
        <pre className="text-xs text-slate-300">{JSON.stringify(detail.crmLog, null, 2)}</pre>
      </div>
    </section>
  );
}
