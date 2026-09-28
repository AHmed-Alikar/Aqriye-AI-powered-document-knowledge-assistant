const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.message || "Upload failed");
  }

  return data;
}

export async function listDocuments() {
  const response = await fetch(`${API_URL}/api/documents`);
  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load documents");
  }

  return data.documents;
}

export async function sendChatMessage(message) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to get an answer");
  }

  return data;
}
