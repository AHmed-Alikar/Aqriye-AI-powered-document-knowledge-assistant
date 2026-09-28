export default function LoadingIndicator({ label = "Loading..." }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent dark:border-slate-500" />
      {label}
    </div>
  );
}
