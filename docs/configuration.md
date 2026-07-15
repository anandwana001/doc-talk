# Configuration

All configuration is done via environment variables in `.env.local`.

Start from the example file:
```bash
cp .env.local.example .env.local
```

---

## Required

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_AGORA_APP_ID` | Your Agora project App ID — get it from [Agora Console](https://console.agora.io) |
| `NEXT_AGORA_APP_CERTIFICATE` | Your Agora App Certificate — same project, keep this server-side only |

---

## Docs source (pick one)

You must provide your documentation content via one of these three options.

### Option A — Local folder

```env
DOCS_PATH=/path/to/your/docs/folder
```

DocTalk recursively reads all `.md` and `.mdx` files in the folder and builds a MiniSearch index. The index is pre-built at startup and serialised to `var/search-index.json` for fast cold starts.

**Not suitable for Vercel or serverless deployments** — the local path does not exist on remote servers. Use Option B instead.

### Option B — Remote `llms.txt` URL (recommended for production)

```env
DOCS_LLM_URL=https://docs.yourcompany.com/llms.txt
```

Many documentation platforms expose an `llms.txt` — a single plain-text file containing the entire documentation, optimised for LLM consumption. DocTalk fetches this URL and caches it for 1 hour.

Check if your docs site has one:
- `https://yourdocs.com/llms.txt`
- `https://yourdocs.com/llms-full.txt`

### Option C — Inline string

```env
DOCS_CONTENT="# My Product\n\nMy product does X..."
```

Paste documentation directly as an env variable. Good for quick tests or very small doc sets.

---

## MCP doc retrieval (required for production)

| Variable | Description |
|---|---|
| `APP_URL` | Publicly reachable base URL of your DocTalk deployment (e.g. `https://your-doctalk.vercel.app`). Agora's cloud calls `/api/mcp` at this URL on every conversation turn to retrieve relevant doc chunks. |
| `MCP_SECRET` | Secret appended as `?key=` on the MCP endpoint URL. Prevents unauthorised callers from using your search index. Generate with `openssl rand -hex 32`. |

Without `APP_URL`, the agent has no access to your documentation and will be unable to answer questions.

For local development, use an ngrok tunnel:
```bash
ngrok http 3000 --host-header=rewrite
# then set APP_URL=https://xxxx.ngrok-free.dev
```

---

## Branding

| Variable | Default | Description |
|---|---|---|
| `COMPANY_NAME` | `"this product"` | Used in the agent's system prompt |
| `AGENT_NAME` | `"Assistant"` | The assistant's display name |
| `AGENT_GREETING` | *(auto)* | First thing the agent says when a session starts |

---

## Transcript doc links

After each agent response, DocTalk shows related doc page links. These require:

| Variable | Description |
|---|---|
| `DOCS_BASE_URL` | Base URL of your docs site, e.g. `https://docs.yourcompany.com` |
| `DOCS_URL_LOCALE` | Locale prefix for doc URLs (default: `en`) |

If `DOCS_BASE_URL` is not set, the related page links are hidden.

---

## Advanced

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_AGENT_UID` | `123456` | RTC UID for the Agora AI agent — must not collide with real user UIDs |
| `AGORA_AREA` | `US` | Agora server region — `US`, `EU`, `AP`, or `CN` |
