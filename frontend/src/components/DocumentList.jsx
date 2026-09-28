import LoadingIndicator from "./LoadingIndicator";

export default function DocumentList({ documents, status, error }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        Documents
      </h2>

      {status === "loading" && <LoadingIndicator label="Loading documents..." />}

      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {status === "success" && documents.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No documents uploaded yet.
        </p>
      )}

      {status === "success" && documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              title={doc.fileName}
            >
              {doc.fileName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
