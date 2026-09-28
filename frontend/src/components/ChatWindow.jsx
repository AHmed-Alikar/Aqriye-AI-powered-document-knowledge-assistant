import { useEffect, useState } from "react";
import { sendChatMessage } from "../services/api";
import ChatMessage from "./ChatMessage";
import LoadingIndicator from "./LoadingIndicator";

const EXAMPLE_QUESTIONS = [
  "What is the introduction about?",
  "What is the problem statement?",
  "What are the research questions?",
  "What are the objectives of the project?",
];

export default function ChatWindow({ documentId, documentName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Switching documents starts a fresh conversation - answers from a
  // previous document shouldn't linger once the user moves on.
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [documentId]);

  async function ask(question) {
    if (!question.trim() || isSending || !documentId) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setIsSending(true);

    try {
      const { answer, sources } = await sendChatMessage(question, documentId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, sources },
      ]);
    } catch (error) {
      console.error("Chat request failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something went wrong while answering your question. Please try again.",
          isError: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    ask(input);
  }

  const hasDocument = Boolean(documentId);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {hasDocument && (
        <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          You are chatting with: <span className="font-medium text-slate-700 dark:text-slate-200">{documentName}</span>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!hasDocument && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a document to start asking questions.
          </p>
        )}

        {hasDocument && messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ask a question about your document.
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((question) => (
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
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} {...msg} />
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
              <LoadingIndicator label="Thinking..." />
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
