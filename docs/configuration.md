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

### Option A — Local folder (development only)

```env
DOCS_PATH=/path/to/your/docs/folder
```

DocTalk recursively reads all `.md` and `.mdx` files in the folder. Builds a MiniSearch index at startup. Fast for local development.

**Not suitable for Vercel or any cloud deployment** — the local path does not exist on remote servers.

### Option B — Remote `llms.txt` URL (recommended for production)

```env
DOCS_LLM_URL=https://docs.yourcompany.com/llms.txt
```

Many documentation platforms expose an `llms.txt` or `llms-full.txt` — a single plain-text file containing the entire documentation, optimised for LLM consumption. DocTalk fetches this URL on each session start.

Check if your docs site has one:
- `https://yourdocs.com/llms.txt`
- `https://yourdocs.com/llms-full.txt`

If not, you can generate one from your docs build pipeline (e.g. concatenate all markdown files).

### Option C — Inline string

```env
DOCS_CONTENT="# My Product\n\nMy product does X..."
```

Paste documentation directly as an env variable. Good for quick tests or very small docs sets.

---

## Branding

| Variable | Default | Description |
|---|---|---|
| `COMPANY_NAME` | `"this product"` | Used in the agent's system prompt |
| `AGENT_NAME` | `"Assistant"` | The assistant's display name |
| `AGENT_GREETING` | *(none)* | First thing the agent says when a session starts |

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
| `NEXT_PUBLIC_AGENT_UID` | `123456` | RTC UID for the Agora AI agent |
