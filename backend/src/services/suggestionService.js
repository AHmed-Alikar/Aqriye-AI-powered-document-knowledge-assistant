const db = require("../db");

const FALLBACK_QUESTIONS = [
  "What is this document about?",
  "What is the main topic discussed?",
  "What are the key points?",
  "What conclusions does it reach?",
];

// Strips a leading numbering scheme like "1.2" or "1.5.2" off a detected
// section heading, e.g. "1.2 Problem Statements" -> "1.2" / "Problem Statements".
function splitHeading(section) {
  const match = section.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
  if (!match) return { number: null, title: section };
  return { number: match[1], title: match[2] };
}

function toQuestion(section) {
  const { number, title } = splitHeading(section);

  if (number) {
    return `What does section ${number} (${title}) cover?`;
  }

  return `What does the "${title}" section cover?`;
}

// Deterministic, no LLM call: suggestions come straight from the real
// section headings detected for this document during upload, so they're
// always specific to the actual document rather than a generic static
// list. Falls back to a generic list only if the document has no detected
// sections at all (e.g. a PDF without numbered headings).
async function getSuggestedQuestions(documentId, limit = 5) {
  const result = await db.query(
    `
    SELECT DISTINCT ON (metadata->>'section')
      metadata->>'section' AS section,
      (metadata->>'page_number')::int AS page_number
    FROM document_chunks
    WHERE document_id = $1 AND metadata->>'section' IS NOT NULL
    ORDER BY metadata->>'section', page_number ASC
    `,
    [documentId]
  );

  const sections = result.rows
    .sort((a, b) => a.page_number - b.page_number)
    .map((row) => row.section)
    .slice(0, limit);

  const questions = sections.map(toQuestion);

  // Some documents don't use a numbered-heading style the detector
  // recognizes (e.g. "1. Title" vs "1.0 Title"), so very few or no real
  // sections may be found. Pad with generic fallbacks rather than showing
  // a single lonely suggestion or none at all - still contextual whenever
  // any real sections exist, since those are always shown first.
  const MIN_SUGGESTIONS = 3;
  for (const fallback of FALLBACK_QUESTIONS) {
    if (questions.length >= Math.max(MIN_SUGGESTIONS, sections.length)) break;
    if (!questions.includes(fallback)) questions.push(fallback);
  }

  return questions.slice(0, limit);
}

module.exports = {
  getSuggestedQuestions,
};
