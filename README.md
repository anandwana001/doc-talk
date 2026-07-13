# DocTalk

A self-hosted voice AI assistant for documentation sites — powered by [Agora Conversational AI](https://docs.agora.io/en/ai). Add a floating "Talk to Docs" button to any website. Users speak naturally; the AI answers from your documentation.

```
User speaks → Agora ASR → GPT-4o-mini (with your docs) → TTS → User hears the answer
```

---

## How it works

DocTalk is a **Next.js server** you deploy once. It:

1. Indexes your documentation with MiniSearch (no external DB needed)
2. Exposes an `/embed` page — a full-screen voice conversation UI
3. Serves `doctalk.js` — a tiny vanilla JS file (zero dependencies) that any website loads with a `<script>` tag

When a user clicks the button on your site, an iframe loads `/embed`. The iframe handles the full Agora voice pipeline (microphone, speech recognition, AI, text-to-speech). The host site never touches any Agora SDK.

```
Your website                      DocTalk server (you deploy this)
────────────                      ────────────────────────────────
<script src="/doctalk.js">   →    /doctalk.js          (widget JS)
DocTalk.init({ apiBase })    →    /embed               (voice UI iframe)
                             →    /api/invite-agent    (starts Agora agent)
                             →    /api/search-links    (doc links in transcript)
```

---

## Quick start (local)

### 1. Prerequisites

- [Agora account](https://console.agora.io) — free tier works
- Node.js 18+ and [pnpm](https://pnpm.io)

### 2. Clone and install

```bash
git clone https://github.com/your-org/doc-talk.git
cd doc-talk
pnpm install
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```env
# Required — Agora Console → your project
NEXT_PUBLIC_AGORA_APP_ID=your_app_id
NEXT_AGORA_APP_CERTIFICATE=your_app_certificate

# Your docs (choose one — see "Docs source" section below)
DOCS_PATH=/path/to/your/docs/folder

# Optional branding
COMPANY_NAME=Acme Corp
AGENT_NAME=Alex
AGENT_GREETING=Hi! I'm Alex, here to help with the docs.
```

### 4. Run

```bash
pnpm dev
# DocTalk is now running at http://localhost:3000
```

Open `http://localhost:3000` to see the landing page. Open `http://localhost:3000/embed` to test the voice UI directly in your browser.

---

## Add the button to your website

Once DocTalk is running (locally or deployed), add **two lines** to any HTML page:

```html
<!-- At the bottom of your <body> -->
<script src="https://YOUR-DOCTALK-URL/doctalk.js"></script>
<script>
  DocTalk.init({
    apiBase: 'https://YOUR-DOCTALK-URL'
  });
</script>
```

Replace `https://YOUR-DOCTALK-URL` with your deployed DocTalk server URL (e.g. `https://doc-talk.vercel.app`).

That's it. A floating microphone button appears in the bottom-right corner. Users click it to start talking.

### Options

```js
DocTalk.init({
  apiBase:  'https://your-doctalk.vercel.app', // required
  label:    'Talk to Docs',                    // button label (default: "Talk to Docs")
  position: 'bottom-right',                   // or "bottom-left"
  color:    '#2563eb',                         // button background color
});
```

---

## Docs source

DocTalk needs your documentation content to answer questions. Choose **one** of these three options in `.env.local`:

### Option A — Local folder (development)

```env
DOCS_PATH=/path/to/your/docs/folder
```

DocTalk recursively reads all `.md` and `.mdx` files in this folder. It builds a MiniSearch index at startup and loads the most relevant ~280K characters into each agent's context.

**Not suitable for cloud deployment** — the path doesn't exist on a remote server.

### Option B — Remote `llms.txt` URL (recommended for production)

```env
DOCS_LLM_URL=https://docs.yourcompany.com/llms.txt
```

Many documentation sites expose an `llms.txt` or `llms-full.txt` file — a plain text representation of the entire docs, designed for LLM consumption. Point DocTalk here and it works in any cloud environment.

Check if your docs site has one: `https://yourdocs.com/llms.txt` or `https://yourdocs.com/llms-full.txt`.

### Option C — Inline content

```env
DOCS_CONTENT="# My Product\n\nMy product does X, Y, and Z..."
```

Paste your documentation content directly as an environment variable. Good for small docs or quick tests.

---

## Deploy to production (Vercel)

### 1. Push to GitHub

```bash
git add .
git commit -m "initial commit"
git remote add origin https://github.com/your-org/doc-talk.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
2. Set these environment variables in the Vercel dashboard:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_AGORA_APP_ID` | Your Agora App ID |
| `NEXT_AGORA_APP_CERTIFICATE` | Your Agora App Certificate |
| `DOCS_LLM_URL` | `https://docs.yourcompany.com/llms.txt` |
| `COMPANY_NAME` | Your company name |
| `AGENT_NAME` | Your assistant's name |
| `AGENT_GREETING` | Opening message |
| `DOCS_BASE_URL` | Your docs site URL (for transcript links) |

3. Deploy. Your DocTalk URL will be `https://your-project.vercel.app`.

### 3. Update your website

```html
<script src="https://your-project.vercel.app/doctalk.js"></script>
<script>
  DocTalk.init({ apiBase: 'https://your-project.vercel.app' });
</script>
```

---

## All environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_AGORA_APP_ID` | ✅ | Agora project App ID |
| `NEXT_AGORA_APP_CERTIFICATE` | ✅ | Agora project App Certificate |
| `NEXT_PUBLIC_AGENT_UID` | — | RTC UID for the AI agent (default: `123456`) |
| `COMPANY_NAME` | — | Used in the system prompt (default: `"this product"`) |
| `AGENT_NAME` | — | Assistant's name (default: `"Assistant"`) |
| `AGENT_GREETING` | — | First thing the agent says |
| `DOCS_PATH` | one of these | Local folder of `.md`/`.mdx` files |
| `DOCS_LLM_URL` | one of these | Remote `llms.txt` URL |
| `DOCS_CONTENT` | one of these | Inline docs string |
| `DOCS_BASE_URL` | — | Your docs site base URL — enables clickable links in the transcript |
| `DOCS_URL_LOCALE` | — | Locale prefix for doc URLs (default: `en`) |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Voice pipeline | Agora Conversational AI Engine |
| Speech-to-text | Deepgram nova-3 |
| LLM | GPT-4o-mini (via Agora managed) |
| Text-to-speech | MiniMax speech_2_6_turbo |
| Search / RAG | MiniSearch (BM25, in-memory) |
| Widget | Vanilla JS — zero dependencies |
| Styling | Tailwind CSS |

---

## Project structure

```
doc-talk/
├── app/
│   ├── api/
│   │   ├── generate-agora-token/   # RTC + RTM token generation
│   │   ├── invite-agent/           # Starts the Agora voice agent
│   │   ├── stop-conversation/      # Stops the agent
│   │   └── search-links/          # Returns related doc links for transcript
│   ├── embed/                      # Full-screen voice UI (loaded in iframe)
│   └── page.tsx                    # Landing / demo page
├── components/
│   ├── DocTalkEmbed.tsx            # Embed page orchestration
│   ├── DocTalkWidget.tsx           # Floating button widget (direct embed)
│   └── DocConversation.tsx         # Core RTC + RTM conversation UI
├── lib/
│   ├── search-index.ts             # MiniSearch index builder + search functions
│   ├── docs-loader.ts              # Docs content loading (path / URL / inline)
│   └── system-prompt.ts            # Agent system prompt builder
├── public/
│   └── doctalk.js                  # The SDK — drop this into any website
└── types/
    └── conversation.ts             # Shared TypeScript types
```

---

## TODOs — Performance & Scale

These are the known limitations and the next steps to make DocTalk production-grade:

### RAG (most impactful)
- [ ] **Per-question retrieval** — currently docs are loaded at session start based on page context. The right solution is a custom LLM proxy (`/api/llm/chat/completions`) that intercepts each LLM call, searches MiniSearch with the user's actual question, and injects relevant chunks before forwarding to OpenAI. This makes DocTalk truly handle any docs size with no quality degradation.
- [ ] **Persistent index** — MiniSearch index rebuilds from disk on every cold start. Write the serialized index to a file on first build; reload from file on subsequent starts.

### Security
- [ ] **API auth** — `/api/invite-agent` is open. Anyone can call it and start an agent on your Agora account. Add a shared secret (e.g. `Authorization: Bearer <token>`) that the widget sends and the API validates.
- [ ] **Rate limiting** — add per-IP rate limiting on `/api/invite-agent` using `@upstash/ratelimit` or a simple in-memory counter.

### Multi-tenant
- [ ] **Config per-request** — right now one DocTalk server = one company's docs. Accept `companyId` from the widget and look up per-company config (docs URL, agent name, branding) from a database or config file.
- [ ] **Multiple doc sources** — let different pages pass different `DOCS_LLM_URL` values at runtime rather than one fixed env variable.

### Docs sync
- [ ] **Webhook re-index** — expose a `POST /api/reindex` endpoint. Call it from your docs CI/CD pipeline after each docs deploy so the search index stays fresh without a server restart.
- [ ] **Incremental updates** — MiniSearch supports `add`/`remove` per document. Track file modification times and only re-index changed files.

### Voice quality
- [ ] **Interruption tuning** — expose `speech_threshold`, `interrupt_duration_ms`, and `silence_duration_ms` as env variables so each company can tune for their language and speaking style.
- [ ] **Language support** — Deepgram nova-3 supports 36 languages. Add a `DOCS_LANGUAGE` env var and pass it to the STT config.

### Analytics
- [ ] **Question logging** — log each user question (anonymised) to a store so you can see what users ask most and improve your docs accordingly.
- [ ] **Unanswered tracking** — detect when the agent says "I don't have that in the docs" and flag those questions for docs team review.

---

## License

MIT
