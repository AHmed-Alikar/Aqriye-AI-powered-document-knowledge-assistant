import { useEffect, useRef, useState } from "react";
import {
  streamChatMessage,
  getConversationHistory,
  getSuggestedQuestions,
} from "../services/api";
import ChatMessage from "./ChatMessage";
import LoadingIndicator from "./LoadingIndicator";

export default function ChatWindow({ documentId, documentName }) {
  const [messages, setMessages] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("idle"); // idle | loading | success | error
  const [suggestions, setSuggestions] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streaming, setStreaming] = useState(null); // { status, content } | null
  const abortRef = useRef(null);

  // Switching documents: cancel any in-flight answer for the previous
  // document, then load this document's persisted history and its
  // document-specific suggestions. History survives a page refresh
  // because it's fetched fresh from the backend, not kept only in memory.
  useEffect(() => {
    abortRef.current?.abort();
    setStreaming(null);
    setIsSending(false);
    setInput("");

    if (!documentId) {
      setMessages([]);
      setSuggestions([]);
      setHistoryStatus("idle");
      return;
    }

    setHistoryStatus("loading");

    getConversationHistory(documentId)
      .then((history) => {
        setMessages(
          history.map((m) => ({
            role: m.role,
            content: m.content,
            sources: m.sources,
          }))
        );
        setHistoryStatus("success");
      })
      .catch((error) => {
        console.error("Failed to load conversation history:", error);
        setMessages([]);
        setHistoryStatus("error");
      });

    getSuggestedQuestions(documentId)
      .then(setSuggestions)
      .catch((error) => {
        console.error("Failed to load suggestions:", error);
        setSuggestions([]);
      });
  }, [documentId]);

  async function ask(question) {
    if (!question.trim() || isSending || !documentId) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setIsSending(true);
    setStreaming({ status: "Searching document...", content: "" });

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    await streamChatMessage(
      question,
      documentId,
      {
        onStatus: (status) => setStreaming({ status, content: accumulated }),
        onToken: (text) => {
          accumulated += text;
          setStreaming({ status: null, content: accumulated });
        },
        onDone: ({ sources }) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: accumulated, sources },
          ]);
          setStreaming(null);
          setIsSending(false);
        },
        onError: (message) => {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                message ||
                "Unable to generate an answer right now. Please try again.",
              isError: true,
            },
          ]);
          setStreaming(null);
          setIsSending(false);
        },
      },
      controller.signal
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    ask(input);
  }

  const hasDocument = Boolean(documentId);
  const showSuggestions =
    hasDocument &&
    messages.length === 0 &&
    !streaming &&
    historyStatus === "success" &&
    suggestions.length > 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {hasDocument && (
        <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          You are chatting with:{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {documentName}
          </span>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!hasDocument && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a document to start asking questions.
          </p>
        )}

        {hasDocument && historyStatus === "loading" && (
          <LoadingIndicator label="Loading conversation..." />
        )}

        {hasDocument && historyStatus === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Unable to access the document right now. Please try again.
          </p>
        )}

        {hasDocument && messages.length === 0 && !streaming && historyStatus === "success" && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ask a question about your document.
          </p>
        )}

        {showSuggestions && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => ask(question)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} {...msg} />
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800">
              {streaming.content ? (
                <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-100">
                  {streaming.content}
                  <span className="ml-0.5 animate-pulse">▍</span>
                </p>
              ) : (
                <LoadingIndicator label={streaming.status || "Working..."} />
              )}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            hasDocument
              ? "Ask anything about this document..."
              : "Select a document to start asking questions."
          }
          disabled={isSending || !hasDocument}
          className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:opacity-50 dark:border-slate-700"
        />
        <button
          type="submit"
          disabled={isSending || !hasDocument || !input.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Send
        </button>
      </form>
    </div>
  );
}
