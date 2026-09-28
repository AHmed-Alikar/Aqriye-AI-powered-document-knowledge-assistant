import LoadingIndicator from "./LoadingIndicator";

export default function DocumentList({
  documents,
  status,
  selectedDocumentId,
  onSelect,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        Documents
      </h2>

      {status === "loading" && <LoadingIndicator label="Loading documents..." />}

      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Unable to load your documents. Please refresh the page.
        </p>
      )}

      {status === "success" && documents.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No documents yet.
          <br />
          Upload a PDF to start asking questions.
        </p>
      )}

      {status === "success" && documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const isActive = doc.id === selectedDocumentId;

            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => onSelect(doc.id)}
                  title={doc.fileName}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    isActive
                      ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900 dark:border-slate-100 dark:bg-slate-800 dark:ring-slate-100"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none">📄</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                        {doc.fileName}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {doc.pageCount && <span>{doc.pageCount} pages</span>}
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ✓ Ready
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-medium ${
                      isActive
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    {isActive ? "Chatting" : "Chat"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
