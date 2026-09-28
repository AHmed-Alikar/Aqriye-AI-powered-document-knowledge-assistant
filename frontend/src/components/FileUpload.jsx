import { useRef, useState } from "react";
import { uploadDocument } from "../services/api";
import LoadingIndicator from "./LoadingIndicator";

export default function FileUpload({ onUploaded }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | success | error
  const [message, setMessage] = useState("");

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setStatus("error");
      setMessage("Only PDF files are supported.");
      event.target.value = "";
      return;
    }

    setStatus("uploading");
    setMessage("");

    try {
      const result = await uploadDocument(file);
      setStatus("success");
      setMessage(
        `${result.document.originalName} — ${result.document.totalChunks} chunks indexed.`
      );
      onUploaded?.();
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Choose PDF
      </button>

      <div className="mt-3 min-h-5">
        {status === "uploading" && (
          <div className="flex justify-center">
            <LoadingIndicator label="Uploading and processing..." />
          </div>
        )}
        {status === "success" && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        )}
      </div>
    </div>
  );
}
