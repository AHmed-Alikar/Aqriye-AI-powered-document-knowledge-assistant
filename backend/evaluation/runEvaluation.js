require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { answerQuestion } = require("../src/services/ragService");

async function run() {
  const questions = JSON.parse(
    fs.readFileSync(path.join(__dirname, "questions.json"), "utf8")
  );

  const results = [];

  for (const q of questions) {
    console.log(`Running: ${q.question}`);

    try {
      const { answer, sources } = await answerQuestion(q.question);

      results.push({
        category: q.category,
        question: q.question,
        expectedIdea: q.expectedIdea,
        answer,
        topSimilarity: sources[0]?.similarity ?? null,
        sources: sources.map((s) => ({
          documentName: s.documentName,
          chunkIndex: s.chunkIndex,
          similarity: s.similarity,
        })),
      });
    } catch (error) {
      console.error(`  Failed: ${error.message}`);
      results.push({
        category: q.category,
        question: q.question,
        expectedIdea: q.expectedIdea,
        answer: null,
        error: error.message,
        sources: [],
      });
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "results.json"),
    JSON.stringify(results, null, 2)
  );

  console.log(`\nDone. ${results.length} questions evaluated.`);
  console.log("Results written to evaluation/results.json");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Evaluation run failed:", err);
    process.exit(1);
  });
