import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "../services/api";
import FileUpload from "../components/FileUpload";
import DocumentList from "../components/DocumentList";
import ChatWindow from "../components/ChatWindow";

export default function Home() {
  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [error, setError] = useState("");

  const refreshDocuments = useCallback(async () => {
    setStatus("loading");
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          Aqriye
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Akhri. Raadi. Faham. — ask questions about your documents.
        </p>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-4">
          <FileUpload onUploaded={refreshDocuments} />
          <DocumentList documents={documents} status={status} error={error} />
        </div>

        <div className="min-h-[500px]">
          <ChatWindow hasDocuments={documents.length > 0} />
        </div>
      </div>
    </div>
  );
}
