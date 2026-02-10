interface ThreadPageProps {
  params: { threadId: string };
}

export default function ThreadPage({ params }: ThreadPageProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Thread {params.threadId}</h2>
      <p className="text-sm text-slate-300">
        Placeholder for message detail, attachment preview, and extraction timeline.
      </p>
    </section>
  );
}
