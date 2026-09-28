require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { answerQuestion } = require("../src/services/ragService");

async function run() {
  const questions = JSON.parse(
    fs.readFileSync(path.join(__dirname, "questions-scoped.json"), "utf8")
  );

  const results = [];

  for (const q of questions) {
    console.log(`[${q.category}] documentId=${q.documentId}: ${q.question}`);

    try {
      const { answer, sources } = await answerQuestion(q.question, q.documentId);

      const allScopedCorrectly = sources.every(
        (s) => String(s.documentId) === String(q.documentId)
      );

      results.push({
        category: q.category,
        documentId: q.documentId,
        question: q.question,
        expectedIdea: q.expectedIdea,
        answer,
        allScopedCorrectly,
        sources: sources.map((s) => ({
          documentId: s.documentId,
          documentName: s.documentName,
          page: s.page,
          section: s.section,
          similarity: s.similarity,
        })),
      });
    } catch (error) {
      console.error(`  Failed: ${error.message}`);
      results.push({
        category: q.category,
        documentId: q.documentId,
        question: q.question,
        expectedIdea: q.expectedIdea,
        answer: null,
        error: error.message,
        sources: [],
      });
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "results-scoped.json"),
    JSON.stringify(results, null, 2)
  );

  console.log(`\nDone. ${results.length} questions evaluated.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Evaluation run failed:", err);
    process.exit(1);
  });
