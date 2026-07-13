# How DocTalk Works

## Architecture overview

DocTalk has two parts: a **server** you deploy and a **client widget** any website embeds.

```
Your website                        DocTalk server (you deploy)
────────────                        ───────────────────────────
doctalk.js (2 lines)           →    /doctalk.js       widget script
DocTalk.init({ apiBase })      →    /embed            voice UI (iframe)
                               →    /api/invite-agent starts Agora agent
                               →    /api/search-links doc links per response
```

When a user clicks the button, your website opens an iframe pointing to `/embed` on your DocTalk server. That iframe owns the entire voice session — microphone access, Agora SDK, transcript rendering. The host website is never involved.

---

## The full request flow

```
1. User clicks "Talk to Docs" button on your website
2. doctalk.js opens an iframe → /embed?ctx=<page context>
3. DocTalkEmbed calls /api/generate-agora-token   → gets RTC + RTM tokens
4. DocTalkEmbed calls /api/invite-agent           → starts Agora agent
   └─ Server loads docs (MiniSearch) + builds system prompt
   └─ Server calls Agora REST API to create a voice agent
5. Agora agent joins the RTC channel
6. User speaks → Deepgram ASR → GPT-4o-mini → MiniMax TTS → user hears answer
7. Agora RTM sends word-by-word transcript to the browser
8. After each agent turn: /api/search-links fetches top 3 doc pages → shown as chips
```

---

## How Agora powers this

DocTalk would not exist without Agora Conversational AI. Here is what Agora provides:

### Managed voice pipeline

One REST call creates an agent that handles the full pipeline:

```
Deepgram nova-3 (ASR)  →  GPT-4o-mini (LLM)  →  MiniMax TTS
```

You provide the system prompt (which includes your docs). Agora runs the pipeline — no audio processing infrastructure to manage.

### Sub-500ms latency via SD-RTN

Agora's Software Defined Real-time Network is a global private network built for real-time media. The full roundtrip — user speech → transcription → LLM → TTS → audio back — completes in under 500ms in most regions. This is what makes the conversation feel natural.

### Real-time transcripts via RTM

Agora RTM sends word-by-word transcript messages to the browser as the agent speaks. DocTalk subscribes to these messages and:
- Renders the conversation live (words appear as the agent speaks)
- Detects when each turn completes, then fetches relevant doc links

### Token-based auth

Agora uses short-lived tokens scoped per channel. DocTalk generates them server-side from your App Certificate (which never leaves your server). Tokens expire and rotate — the browser client never sees your credentials.

---

## MiniSearch RAG

DocTalk indexes your documentation locally using [MiniSearch](https://github.com/lucasdicioccio/minisearch) — a BM25 keyword search engine that runs in-process with no external dependencies.

### How docs are loaded

When a user starts a session, DocTalk loads docs in two layers:

**Layer 1 — Priority base (always loaded)**
Up to 280,000 characters from your docs, ordered by importance:
1. Introduction / getting started content
2. AI and conversational content
3. Real-time media guides
4. API references
5. Everything else

**Layer 2 — Context search (added per session)**
Up to 40,000 additional characters retrieved by searching for the user's current page context (title + URL path, passed via `?ctx=` on the iframe URL). This ensures the agent has extra detail about whatever section the user is reading.

Total: ~320K characters → roughly 80K tokens, well within GPT-4o-mini's 128K context window.

### Doc links in transcript

After each completed agent response, DocTalk calls `/api/search-links` with the agent's text as a query. MiniSearch finds the top 3 most relevant doc pages, which are shown as pill chips below the agent's bubble.

### Limitations

MiniSearch is BM25 keyword search — not semantic/vector search. It works well for technical documentation where users ask questions using the same terms the docs use. For ambiguous natural-language questions, a vector DB (Pinecone, Weaviate) or a custom LLM proxy would produce better retrieval. See [Roadmap](roadmap.md).

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
│   └── page.tsx                    # Demo landing page
├── components/
│   ├── DocTalkEmbed.tsx            # Embed page orchestration + session lifecycle
│   ├── DocTalkWidget.tsx           # Floating button widget (direct embed)
│   └── DocConversation.tsx         # Core RTC + RTM conversation UI
├── lib/
│   ├── search-index.ts             # MiniSearch index builder + search functions
│   ├── docs-loader.ts              # Docs content loading (path / URL / inline)
│   ├── system-prompt.ts            # Agent system prompt builder
│   └── agora.ts                    # Agora token + agent API helpers
├── public/
│   └── doctalk.js                  # The client SDK — drop into any website
├── types/
│   └── conversation.ts             # Shared TypeScript types
└── docs/                           # This documentation
```
