# RAG Evaluation Report v2 — Retrieval Quality & Production Pass

**Documents under test:** `chapterOneThesis.pdf` (9 pages, doc id 4) and
`somalia-fundraising-platform-spec.pdf` (18 pages, doc id 1)
**Pipeline:** BAAI/bge-small-en-v1.5 embeddings + pgvector cosine search
(20-candidate pool) → hybrid re-ranking (section-title keyword boost +
exact section-number boost) → similarity floor → reading-order context
construction → Llama-3.1-8B-Instruct generation, with one bounded
silent retry on an exact-phrase refusal.
**Run date:** 2026-09-28

## Summary: 12/12 correctly scoped, 0 cross-document leakage, 0 hallucinations

Every one of the 12 questions below returned sources exclusively from the
document it was scoped to — verified programmatically (`documentId` checked
on every returned source), not just eyeballed. 9 questions got a grounded,
specific answer; 3 correctly refused because the information genuinely
wasn't in the selected document. No fabricated facts, sources, or page
numbers were observed in any answer.

## The concrete bug this pass fixed

The original report (`rag-evaluation-report.md`) documented: asking
"What is the introduction about?" on `chapterOneThesis.pdf` retrieved the
`1.8 Project Organization` chapter-summary chunk instead of the actual
`1.0 Introduction` chunk, which didn't even rank in the top 10 by pure
cosine similarity (0.497).

**Fix 1 — section-title keyword boost.** Chunks whose detected `section`
metadata shares a keyword with the question get `+0.15` per shared word.
Result: `1.0 Introduction` jumped from ~9th place to **1st** for that exact
question, correctly outranking the chapter-summary chunk.

**Fix 2 — exact section-number boost.** The keyword boost alone couldn't
help a literal "What is discussed in section 1.7?" (no shared title words
between the question and "1.7 Significance of the Project"). Added a
separate `+0.25` boost when a dotted number in the question (e.g. "1.7")
exactly matches a chunk's section number. Confirmed via direct retrieval
test: `1.7 Significance of the Project` went from missing entirely to
**1st** (similarity 0.815) for that question.

**Fix 3 — reading-order context construction (found during this
evaluation).** Even with the right chunks retrieved, "What is discussed in
section 1.7?" kept refusing on 3 consecutive attempts. Root cause: chunks
were joined into the LLM's context in *relevance-rank order*, not natural
document order — so a chunk containing the middle of section 1.7's content
appeared *before* the chunk containing its own heading, reading as an
incoherent fragment. Sorting chunks by `(page, chunk_index)` before joining
fixed it immediately and reproducibly (verified across 3 repeat runs). This
was a genuine context-construction bug, not LLM randomness - worth noting
because it was initially misdiagnosed as flakiness.

**Fix 4 — bounded retry on exact-phrase refusal.** Separately, the LLM does
still occasionally refuse with the exact canned phrase even with good
context (observed non-deterministic behavior, documented in the original
report too). Added a single silent retry in the non-streaming path when the
answer is an exact match for the refusal message. Not applied to the live
streaming chat path — see "Known limitations" below for why.

## Results by category

| Category | Question | Scoped correctly | Result |
|---|---|---|---|
| A. Direct factual | "What is the introduction about?" | ✅ | Specific, grounded - seaports, trade, Mogadishu challenges |
| A. Direct factual | "What is the problem statement?" | ✅ | Specific, grounded - manual processes, no centralized DB |
| A. Direct factual | "What are the objectives?" | ✅ | Specific, grounded, cites Section 1.5.2 by name |
| B. Section-specific | "What is discussed in section 1.7?" | ✅ | Correctly identifies "Significance of the Project" |
| B. Section-specific | "What does section 1.2 cover?" | ✅ | Correctly identifies "Problem Statements" |
| C. Summary | "Summarize what this chapter covers overall." | ✅ | Grounded, references real sections, no fabrication |
| D. Cross-chunk | Significance + relation to problems | ✅ | Correctly connects Section 1.7 and 1.2 content |
| E. Unanswerable | "What is the capital of France?" | ✅ | Correctly refused |
| E. Unanswerable | "What programming language is used?" | ✅ | Correctly refused (that detail is in the *other* document) |
| F. Wrong-doc protection | "Introduction?" scoped to doc 1 | ✅ | Answers from the Somalia spec, zero thesis content |
| F. Wrong-doc protection | "Mobile money providers?" scoped to doc 4 | ✅ | Correctly refused rather than leaking doc-1 content |
| G. Document-scoping | "Purpose of this platform?" scoped to doc 1 | ✅ | Grounded Somalia-platform answer, all sources doc 1 |

Full raw data (every retrieved chunk, similarity score, and answer) is in
`results-scoped.json`.

## Known limitations (honest, not hidden)

- **The retry-on-refusal fix only applies to the non-streaming path.**
  Cleanly retrying mid-stream without either double-displaying an answer or
  sacrificing live token-by-token display for every request turned out not
  to be achievable without a real UX trade-off, so the live chat (SSE)
  path streams exactly what the model produces on its first attempt,
  refusal or not. In practice this is now rare given fixes 1-3 above, but
  it can still happen.
- **Section detection heuristic is format-specific.** It reliably finds
  numbered headings like "1.2 Problem Statements" (this thesis's style),
  but a document using "1. Title" (a bare period, no second number) as its
  heading style - like the Somalia spec - produces few or no real section
  matches. Suggested questions for that document fall back to generic
  templates rather than section-specific ones as a result.
- **Re-ranking is a measured improvement, not perfect.** It only helps when
  a real section heading exists to match against; a document with no
  detected structure gets no benefit from either boost, only from the base
  vector search.
