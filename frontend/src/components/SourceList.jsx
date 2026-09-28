// Every source in one answer belongs to the same document (retrieval is
// scoped by document_id), so the document name is shown once, then the
// referenced pages/sections are grouped underneath - never raw chunk
// numbers, and never a page number that wasn't actually in the metadata.
function formatPageLabel(pages) {
  const sorted = [...pages].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return min === max ? `Page ${min}` : `Pages ${min}–${max}`;
}

function groupSources(sources) {
  const withPages = sources.filter((s) => s.page !== null);
  const withoutPages = sources.filter((s) => s.page === null);

  const bySection = new Map();
  for (const source of withPages) {
    const key = source.section ?? "";
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(source.page);
  }

  const groups = [...bySection.entries()].map(([section, pages]) => ({
    label: formatPageLabel(pages),
    section: section || null,
  }));

  if (withoutPages.length > 0) {
    groups.push({ label: "Referenced content", section: null });
  }

  return groups;
}

export default function SourceList({ sources }) {
  if (!sources || sources.length === 0) return null;

  const documentName = sources[0].documentName;
  const groups = groupSources(sources);

  return (
    <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
      <p className="mb-1.5 font-medium text-slate-600 dark:text-slate-300">Sources</p>
      <div className="space-y-1">
        <p className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
          <span>📄</span> {documentName}
        </p>
        {groups.map((group, i) => (
          <p key={i} className="pl-5">
            {group.label}
            {group.section && ` · ${group.section}`}
          </p>
        ))}
      </div>
    </div>
  );
}
