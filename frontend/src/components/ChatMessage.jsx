import SourceList from "./SourceList";

export default function ChatMessage({ role, content, sources, isError }) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
          isUser
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : isError
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
        }`}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        {!isUser && !isError && <SourceList sources={sources} />}
      </div>
    </div>
  );
}
