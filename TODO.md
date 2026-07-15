# TODO

Outstanding engineering work. Items marked `[security]` should be addressed before a public production launch.

---

## Security

- [ ] **[security] Rate limit `/api/mcp`** — currently unrated. Add per-IP sliding window (same pattern as `/api/invite-agent`). Prevents a caller who knows the MCP URL + secret from hammering search.

- [ ] **[security] Rate limit `/api/stop-conversation`** — currently unrated. Low risk but consistent with the rest of the API.

- [ ] **[security] Rotate `MCP_SECRET` on breach** — document how to rotate: change env var, redeploy. Agora will receive the new URL on the next `/api/invite-agent` call; no agent restart needed.

- [ ] **[security] Auth on `/api/invite-agent`** for multi-tenant or public deployments — currently open (intentionally left to integrators). If you expose DocTalk publicly, add `INVITE_SECRET` bearer token validation so arbitrary callers cannot create agents on your Agora account.

- [ ] **[security] `MCP_SECRET` in URL vs header** — currently sent as `?key=` query param (encrypted over HTTPS, visible in server logs). If Agora's ConvoAI adds support for custom HTTP headers in MCP server config, migrate to `Authorization: Bearer` to keep the secret out of logs.

---

## Search quality

- [ ] **Vector search adapter** — MiniSearch is BM25 keyword search. Add optional pgvector / Pinecone adapter behind `VECTOR_DB_URL` env var for semantic retrieval.

- [ ] **Incremental index rebuild** — currently rebuilds the full MiniSearch index on every `npm run dev`. Track file mtimes and only re-index changed files.

- [ ] **Webhook re-index endpoint** — `POST /api/reindex` so docs CI/CD can trigger a fresh index after each docs deploy without a full server restart.

---

## Voice

- [ ] **Language support** — add `DOCS_LANGUAGE` env var, pass to Deepgram nova-3 (supports 36 languages).

- [ ] **Interruption tuning env vars** — expose `speech_threshold`, `interrupt_duration_ms`, `silence_duration_ms` as env vars for fine-tuning per language / speaking style.

---

## Multi-tenant

- [ ] **Per-request company config** — accept `companyId` from widget, look up per-company docs URL + branding from a database. Enables one DocTalk server for multiple companies.

---

## Analytics

- [ ] **Question logging** — log anonymised user questions so docs teams can identify coverage gaps.

- [ ] **Unanswered question detection** — detect "I don't have that in the docs" responses and surface them for docs review.

---

## CLI

- [ ] **`agora init --template doctalk`** — add DocTalk as a template in the Agora CLI so developers can scaffold a configured deployment in one command after `agora login`.
