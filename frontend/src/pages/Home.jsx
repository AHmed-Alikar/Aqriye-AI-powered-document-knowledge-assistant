import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "../services/api";
import FileUpload from "../components/FileUpload";
import DocumentList from "../components/DocumentList";
import ChatWindow from "../components/ChatWindow";

export default function Home() {
  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);

  const refreshDocuments = useCallback(async () => {
    setStatus("loading");
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      setStatus("success");
      return docs;
    } catch (err) {
      console.error("Failed to load documents:", err);
      setStatus("error");
      return [];
    }
  }, []);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  async function handleUploaded() {
    const docs = await refreshDocuments();
    // Select the just-uploaded document so the user can start asking
    // questions immediately instead of having to pick it again.
    if (docs.length > 0) {
      setSelectedDocumentId(docs[0].id);
    }
  }

  const selectedDocument = documents.find((doc) => doc.id === selectedDocumentId);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          Aqriye AI
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Akhri. Raadi. Faham.
        </p>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-4">
          <FileUpload onUploaded={handleUploaded} />
          <DocumentList
            documents={documents}
            status={status}
            selectedDocumentId={selectedDocumentId}
            onSelect={setSelectedDocumentId}
          />
        </div>

        <div className="min-h-[500px]">
          <ChatWindow
            documentId={selectedDocument?.id ?? null}
            documentName={selectedDocument?.fileName ?? null}
          />
        </div>
      </div>
    </div>
  );
}
