interface Props {
  transcript: string;
}

export function TranscriptPanel({ transcript }: Props) {
  if (!transcript) return null;
  return (
    <section className="panel panel--transcript">
      <h2>You said</h2>
      <p>{transcript}</p>
    </section>
  );
}
