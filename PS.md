Background & Context
The world's knowledge is no longer just text. It lives in research PDFs, scanned documents,
YouTube lectures, podcast transcripts, dataset repositories, Wikipedia articles, government
portals, and open-access archives — each with different formats, structures, and modalities.
Finding the right information is hard enough. Understanding it in context is harder. Connecting
insights across all of these sources — coherently, accurately, and without hallucination — remains
an unsolved, high-value problem.
State-of-the-art approaches exist: vector databases, semantic search, knowledge graphs, re-
ranking pipelines. But no single solution fits every scenario, and most systems fail the moment
they're pushed beyond clean, homogeneous inputs.
The deeper problem is trust. Users have no way of knowing whether an AI system is drawing from
what it actually ingested — or confabulating from training memory. No way of knowing whether
two conflicting sources genuinely disagree, or simply reflect knowledge that evolved over time.
No way of knowing whether the answer they received was even possible to produce from the
documents they provided.
That's the gap your system needs to close.
What You're Building
Build an intelligent Multi-Document Intelligence Assistant that ingests content from
heterogeneous public sources and allows a user to query across all of them through a single
natural-language interface.
Your system must be able to:
Ingest content from at least 4 source types across at least 4 modalities:
PDF documents (research papers, reports, policy documents)
Web pages / HTML articles (Wikipedia, news, government portals)
YouTube video transcripts
Audio transcripts (podcast episodes, interviews)
Structured datasets (CSV / JSON from open data portals)
Images with embedded text or diagrams (scanned docs, infographics)PS 2 - Genai
Store and index ingested content using a retrieval strategy you design, justify, and defend —
vector embeddings, keyword search, hybrid retrieval, knowledge graphs, or any combination
Answer natural language queries with grounded, source-cited responses — every answer
must reference its document, section, or timestamp
Synthesise across multiple sources in a single response — not just retrieve, but connect
Know its limits — refuse to answer from training memory when content is outside the ingested
corpus, and tell the user exactly what falls outside its knowledge
Detect temporal drift — distinguish between sources that contradict each other and sources
that simply reflect how understanding evolved over time
How you store, index, and retrieve content is entirely up to you. Your architecture choices are a
core part of what will be evaluated — not just your outputs.
Rules of Engagement
Sources must span at least 4 modalities — not all PDFs, not all web pages
Every answer must be source-cited — document name or URL, section or timestamp, and a
supporting excerpt
The system must refuse parametric answers — if the answer isn't in the corpus, it must say so
and redirect, never guess from training memory
All ingested content must be PII-scanned at ingestion time — no personally identifiable
information may appear in any system output
Your system must be able to explain its architecture choices at demo time — judges will ask
why you made the decisions you did
All 11 advanced requirements are mandatory — claiming a feature without a live demo scores
zero for that requirementPS 2 - Genai
MVP Checklist
Your solution must demonstrate:
1.Multi-source ingestion — at least 3 source types across at least 2 modalities, handling
varying length, language, and quality
2.Justified retrieval architecture — a storage and indexing strategy you can explain and
defend, with chunking, embedding, and retrieval decisions clearly reasoned
3.Natural language Q&A — grounded answers with source citations including document name,
section, and timestamp
4.Summarisation and synthesis — per-document TL;DR and cross-source synthesis in
response to a single query
5.Source transparency — every answer shows which sources were retrieved and how they
contributed
6.Temporal drift detection — system distinguishes between sources that contradict and
sources that reflect evolving knowledge, and communicates this clearly to the user
7.Knowledge boundary awareness — system refuses to answer outside the corpus, surfaces
adjacent content, and explicitly states what it cannot answer
8.PII detection and redaction — automatic detection at ingestion time, full redaction from
outputs, with a per-source report of what was found and removed
9.Table and chart understanding — structured extraction from PDF tables with row/column
relationships preserved; quantitative queries answered with specific table attribution
10.Cross-lingual retrieval — English queries answered against sources in at least one other
language, with answers returned in the query language and source language noted
11.Duplicate and near-duplicate detection — semantic deduplication at ingestion time;
duplicated sources flagged in the source panel rather than silently droppedPS 2 - Genai
Brownie Points
Going above and beyond? Impress us with:
Autonomous gap detection and ingestion — when the corpus cannot answer a query, the
system autonomously finds and ingests a relevant public source, discloses what it found and
why, and re-runs retrieval — capped at 2 attempts per query
Self-correcting answer pipeline — after generating a draft answer, the system runs an
independent critique pass checking faithfulness and citation completeness, rewrites if
needed, and shows the user what changed and why
Clarification agent — ambiguous queries trigger exactly one targeted clarifying question
derived from retrieved content; clear queries never trigger clarification
Multi-hop reasoning chain — queries requiring evidence from multiple sources are
automatically decomposed into sub-questions, retrieved independently, and synthesised
with the full reasoning chain shown to the user
Source credibility agent — each ingested source is autonomously investigated for credibility,
tiered from peer-reviewed to user-generated content, and answers are weighted and
displayed by credibility tier
Deliverables

By the end of 24 hours, your team must submit:
A working prototype / demo
A pitch deck covering your approach, architecture, and design decisions
A live or recorded demo walkthrough (3–5 minutes)