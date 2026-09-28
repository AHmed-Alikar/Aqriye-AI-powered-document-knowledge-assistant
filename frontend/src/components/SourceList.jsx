export default function SourceList({ sources }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
      <p className="mb-1 font-medium">Sources</p>
      <ul className="space-y-0.5">
        {sources.map((source) => (
          <li key={`${source.documentId}-${source.chunkId}`}>
            {source.documentName}
            {source.chunkIndex !== null && ` — Chunk ${source.chunkIndex}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
