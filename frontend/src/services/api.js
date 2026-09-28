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

export async function getConversationHistory(documentId) {
  const response = await fetch(`${API_URL}/api/documents/${documentId}/messages`);
  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load conversation history");
  }

  return data.messages;
}

export async function getSuggestedQuestions(documentId) {
  const response = await fetch(`${API_URL}/api/documents/${documentId}/suggestions`);
  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load suggestions");
  }

  return data.suggestions;
}

// Real Server-Sent Events streaming, not a fake progress simulation: the
// backend emits "status" events tied to actual pipeline stages, "token"
// events as the LLM's real streamed output arrives, and a final "done"
// event with sources. Uses a raw fetch + stream reader (not EventSource,
// since EventSource can't send a POST body).
export async function streamChatMessage(
  message,
  documentId,
  { onStatus, onToken, onDone, onError },
  signal
) {
  let response;

  try {
    response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, documentId }),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") return;
    onError?.("Aqriye AI is temporarily unable to connect to the server.");
    return;
  }

  if (!response.ok) {
    const data = await parseJsonSafely(response);
    onError?.(data?.message || "Failed to get an answer");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch (error) {
      if (error.name === "AbortError") return;
      throw error;
    }

    if (chunk.done) break;

    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop(); // keep any incomplete event for the next read

    for (const block of events) {
      const eventLine = block.split("\n").find((l) => l.startsWith("event: "));
      const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
      if (!eventLine || !dataLine) continue;

      const eventType = eventLine.slice(7).trim();
      const data = JSON.parse(dataLine.slice(6));

      if (eventType === "status") onStatus?.(data.message);
      else if (eventType === "token") onToken?.(data.text);
      else if (eventType === "done") onDone?.(data);
      else if (eventType === "error") onError?.(data.message);
    }
  }
}
