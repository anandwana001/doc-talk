# TODO

Outstanding work that requires external infrastructure or a separate repository.

---

## Search quality

- [ ] **Vector search adapter** — MiniSearch is BM25 keyword search. Add optional pgvector / Pinecone adapter behind `VECTOR_DB_URL` for semantic retrieval on ambiguous natural-language questions.

- [ ] **Incremental index rebuild** — currently rebuilds the full MiniSearch index when `invalidateIndex()` is called. Track file mtimes and only re-index changed files for large doc sets.

---

## Multi-tenant

- [ ] **Per-request company config** — accept `companyId` from the widget, look up per-company docs URL + branding from a database. Enables one DocTalk server for multiple companies.

---

## Analytics

- [ ] **Question logging** — log anonymised user questions so docs teams can identify coverage gaps. Requires a logging sink (Postgres, ClickHouse, or a logging service).

- [ ] **Unanswered question detection** — detect "I don't have that in the docs" responses and surface them for docs review.

---

## CLI

- [ ] **`agora init --template doctalk`** — add DocTalk as a template in the Agora CLI so developers can scaffold a configured deployment in one command after `agora login`.

---

## Security (future)

- [ ] **`MCP_SECRET` in request header** — currently sent as `?key=` query param (encrypted over HTTPS, but visible in server logs). Migrate to `Authorization: Bearer` once Agora's ConvoAI supports custom HTTP headers in MCP server config.

- [ ] **Rotate `MCP_SECRET` on breach** — change the env var and redeploy. Agora receives the new URL on the next `/api/invite-agent` call; no agent restart needed.
