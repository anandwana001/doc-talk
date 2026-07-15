# Roadmap

Known limitations and planned improvements. Contributions welcome.

---

## Search quality

**Vector search option**

MiniSearch is BM25 keyword search. For natural-language questions that don't use exact doc terminology, semantic/vector search produces better results. Add an optional adapter for Pinecone, Weaviate, or pgvector as an alternative to MiniSearch when `VECTOR_DB_URL` is set.

**Incremental index updates**

MiniSearch supports `add`/`remove` per document. Track file modification times and only re-index changed files instead of rebuilding the full index on each `npm run dev`.

---

## Docs sync

**Webhook re-index**

Expose `POST /api/reindex`. Call it from your docs CI/CD pipeline after each deploy so the search index stays fresh without a full server restart.

---

## Voice quality

**Interruption tuning**

Expose `speech_threshold`, `interrupt_duration_ms`, and `silence_duration_ms` as env variables. Different languages and speaking styles need different values.

**Language support**

Deepgram nova-3 supports 36 languages. Add a `DOCS_LANGUAGE` env var and pass it to the STT configuration so non-English docs teams can use DocTalk.

---

## Multi-tenant

**Config per-request**

Right now one DocTalk server = one company's docs. Accept a `companyId` from the widget and look up per-company config (docs URL, agent name, branding) from a database or config file. Enables running DocTalk as a shared service for multiple teams.

---

## Analytics

**Question logging**

Log each user question (anonymised) so docs teams can see what users ask most and improve coverage.

**Unanswered question tracking**

Detect when the agent says it doesn't have the answer and flag those questions for docs team review — a direct signal for documentation gaps.

---

## CLI integration

Add DocTalk as an `agora init --template doctalk` template in the [Agora CLI](https://github.com/AgoraIO/agora-cli). One command scaffolds a fully configured DocTalk deployment with the user's Agora credentials pre-filled from `agora login`.
