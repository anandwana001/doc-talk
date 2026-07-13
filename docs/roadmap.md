# Roadmap

Known limitations and planned improvements. Contributions welcome.

---

## RAG quality (most impactful)

**Per-question retrieval** (high priority)

Currently docs are loaded once at session start based on the page context. The right solution is a custom LLM proxy at `/api/llm/chat/completions` that intercepts every LLM call, searches MiniSearch with the user's actual question, and injects the most relevant chunks — then forwards to OpenAI. This makes DocTalk handle any docs size with no quality loss regardless of how large the documentation is.

Requires a publicly reachable URL (so Agora can call it) and adds per-request latency for the search step.

**Persistent index**

MiniSearch rebuilds from disk on every cold start. For large doc sets this is slow. Fix: serialise the index to a file on first build, reload from file on subsequent starts.

**Vector search option**

MiniSearch is BM25 keyword search. For natural-language questions that don't use exact doc terminology, semantic/vector search produces better results. Add an optional adapter for Pinecone, Weaviate, or pgvector.

---

## Security

**API auth on `/api/invite-agent`**

Currently open — anyone can call it and create agents on your Agora account. Add `Authorization: Bearer <token>` validation. See [Deployment → Production checklist](deployment.md#production-checklist) for the implementation.

**Rate limiting**

Add per-IP rate limiting on `/api/invite-agent` to prevent credit abuse. `@upstash/ratelimit` is a good fit (free tier, works on Vercel edge).

---

## Multi-tenant

**Config per-request**

Right now one DocTalk server = one company's docs. Accept `companyId` from the widget and look up per-company config (docs URL, agent name, branding) from a database or config file. Enables running DocTalk as a shared service for multiple teams or customers.

**Multiple doc sources**

Let different pages or embed instances point to different docs sources at runtime, rather than one fixed env variable per deployment.

---

## Docs sync

**Webhook re-index**

Expose `POST /api/reindex`. Call it from your docs CI/CD pipeline after each docs deploy so the search index stays fresh without a full server restart.

**Incremental updates**

MiniSearch supports `add`/`remove` per document. Track file modification times and only re-index changed files instead of rebuilding the full index.

---

## Voice quality

**Interruption tuning**

Expose `speech_threshold`, `interrupt_duration_ms`, and `silence_duration_ms` as env variables. Different languages and speaking styles need different values.

**Language support**

Deepgram nova-3 supports 36 languages. Add a `DOCS_LANGUAGE` env var and pass it to the STT configuration so non-English docs teams can use DocTalk.

---

## Analytics

**Question logging**

Log each user question (anonymised) so docs teams can see what users ask most and improve coverage accordingly.

**Unanswered question tracking**

Detect when the agent says it doesn't have the answer and flag those questions for docs team review — a direct signal for docs gaps.
