# RAG Evaluation Report

**Document under test:** `somalia-fundraising-platform-spec.pdf` (Kaalmo — Somalia-first fundraising platform spec, 18 pages, 64 chunks)
**Pipeline:** BAAI/bge-small-en-v1.5 embeddings (384-dim) + pgvector cosine search (top-5) + Llama-3.1-8B-Instruct generation
**Run date:** 2026-09-28

## Result: 9 of 16 questions completed

The remaining 7 (2 paraphrased, 4 unanswerable, 1 ambiguous) were blocked mid-run by Hugging Face's
shared Inference Providers credit pool being fully depleted for this billing period — confirmed to be
account-wide across all paid third-party providers (switching from `openai/gpt-oss-120b` to
`meta-llama/Llama-3.1-8B-Instruct` hit the identical `402` error after only 9 more calls). This is a
useful finding on its own: it's exactly the kind of failure the upcoming rate-limiting/production
milestone needs to account for. Raw data for every question, including the ones that failed, is in
`results.json`.

## Findings by category

### Direct questions (6 asked, 6 completed)

| # | Question | Top similarity | Verdict |
|---|---|---|---|
| 1 | Platform name | 0.732 | **Correct** — "Kaalmo", grounded |
| 2 | Backend stack | 0.721 | **False negative** — see below |
| 3 | Mobile money providers | 0.706 | Correct (EVC Plus, eDahab, Zaad); missed "Sahal" mentioned once in a table |
| 4 | Transaction fee % | 0.736 | **Correct** — cited the right chunk (43) by number in the answer text |
| 5 | Campaign lifecycle statuses | 0.704 | **Correct and complete**, all 9 statuses in order |
| 6 | Main user roles | 0.717 | Correct; omitted "Support Agent" (a 7th, less prominent role) |

**Question 2 is the most important finding of this evaluation.** The correct chunk (containing the
"Backend: Node.js + Express.js" table row) *was* retrieved — it appears at rank 5 with similarity 0.653,
inside the context sent to the LLM — but the model answered "The information is not available in the
provided documents" anyway. This is a real groundedness failure: retrieval worked, generation didn't
use what it was given. It's the safe failure mode (refusing rather than hallucinating), but it shows the
system prompt/model combination can be overcautious when the answer is present but not in the
highest-ranked chunk.

### Paraphrased questions (4 asked, 2 completed)

| # | Question | Top similarity | Verdict |
|---|---|---|---|
| 7 | "Which framework powers the server side?" (paraphrase of Q2) | 0.668 | **Also "not available"** — and this time the stack chunk didn't even make the top 5 (lower similarity than Q2's phrasing). Paraphrasing measurably weakened retrieval here. |
| 8 | "How does the platform make money?" | 0.684 | **Correct** — cited the $10,000/4%/$400 example directly |
| 9, 10 | Withdrawal approver / fraud freeze consequence | — | Blocked by quota |

Q7 confirms a real limitation: `bge-small-en-v1.5` (384-dim, a small/fast model) is more sensitive to
exact phrasing than a larger embedding model would be. The same underlying fact was retrievable with
one phrasing (Q2, rank 5) but fell out of the top-5 entirely with a different phrasing (Q7). Worth
watching if paraphrase recall matters more as the document set grows.

### Unanswerable questions (4 asked, 0 completed)

All 4 were blocked by the quota limit before they could run. Based on the manual spot-check done during
the chat-endpoint milestone ("What is the capital of France?" → correctly refused, similarity ~0.40 vs
~0.65-0.68 for on-topic questions), the mechanism is known to work; it just wasn't re-verified against
this specific question set.

### Ambiguous questions (2 asked, 1 completed)

| # | Question | Top similarity | Verdict |
|---|---|---|---|
| 16 | "Is this platform safe?" | 0.642 | **Correct handling** — grounded the answer entirely in the Security Architecture section (HTTPS, bcrypt/argon2, CSRF, webhook signature verification, etc.) and explicitly noted the excerpts "do not provide a comprehensive assessment of the platform's overall safety" instead of giving an unqualified yes. |

## Overall assessment

- **Retrieval relevance:** Good. On-topic questions consistently scored 0.62–0.74 cosine similarity;
  the one prior off-topic test scored ~0.40. That gap is a usable signal for a future "low-confidence
  answer" threshold.
- **Groundedness:** Mostly good, with one confirmed false-negative (Q2/Q7) where present evidence was
  ignored in favor of an over-cautious refusal.
- **Hallucination:** None observed. No invented facts, sources, or page numbers in any of the 9
  completed answers.
- **Citation correctness:** Every chunk number the model referenced in its answer text matched the
  actual retrieved chunk metadata.
- **Operational risk:** Confirmed the Hugging Face free/included credit pool is shared across all paid
  providers and depletes fast under repeated testing (~19 chat calls total exhausted it twice). This is
  a direct argument for rate limiting `/api/chat` and surfacing a clean 429/503 to the frontend instead
  of a raw 500, which is exactly the next milestone.

## Suggested follow-ups (not blocking)

- Re-run the 7 blocked questions once credits reset, to confirm unanswerable-question handling still
  holds across a full batch.
- If paraphrase recall becomes a recurring problem, consider a larger embedding model (with a matching
  schema migration) before reaching for chunking changes.
