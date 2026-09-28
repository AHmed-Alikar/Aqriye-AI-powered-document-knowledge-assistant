import { useRef, useState } from "react";
import { uploadDocument } from "../services/api";
import LoadingIndicator from "./LoadingIndicator";

export default function FileUpload({ onUploaded }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | success | error
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  async function processFile(file) {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setStatus("error");
      setMessage("Only PDF files are supported.");
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
      await onUploaded?.();
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus("error");
      setMessage("Unable to process this PDF. Please try another file.");
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    processFile(file);
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    processFile(file);
  }

  const isUploading = status === "uploading";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        Upload a document
      </h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
          isDragging
            ? "border-slate-500 bg-slate-50 dark:bg-slate-800"
            : "border-slate-300 dark:border-slate-700"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {isUploading ? (
          <div className="flex justify-center py-2">
            <LoadingIndicator label="Uploading & indexing your document..." />
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Drag &amp; drop your PDF here
            </p>
            <p className="my-2 text-xs text-slate-400 dark:text-slate-500">or</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Choose PDF
            </button>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              PDF files up to 10 MB
            </p>
          </>
        )}
      </div>

      <div className="mt-3 min-h-5 text-center">
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
