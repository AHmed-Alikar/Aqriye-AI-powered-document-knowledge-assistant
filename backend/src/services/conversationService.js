const db = require("../db");

// One conversation per document - the app has no multi-user/auth concept
// yet, so this is the simplest correct model. Created lazily on first use.
async function getOrCreateConversation(documentId) {
  const existing = await db.query(
    `SELECT id FROM conversations WHERE document_id = $1 LIMIT 1`,
    [documentId]
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const created = await db.query(
    `INSERT INTO conversations (document_id) VALUES ($1) RETURNING id`,
    [documentId]
  );

  return created.rows[0].id;
}

// Every query here is scoped through document_id -> conversation_id, so
// one document's history can never surface under another document.
async function getMessages(documentId) {
  const result = await db.query(
    `
    SELECT m.id, m.role, m.content, m.sources, m.created_at
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.document_id = $1
    ORDER BY m.created_at ASC
    `,
    [documentId]
  );

  return result.rows;
}

async function saveMessage(conversationId, role, content, sources = null) {
  await db.query(
    `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );

  const result = await db.query(
    `
    INSERT INTO messages (conversation_id, role, content, sources)
    VALUES ($1, $2, $3, $4)
    RETURNING id, created_at
    `,
    [conversationId, role, content, sources ? JSON.stringify(sources) : null]
  );

  return result.rows[0];
}

module.exports = {
  getOrCreateConversation,
  getMessages,
  saveMessage,
};
