# DocTalk SDK

An open-source, self-hosted SDK that adds a **voice AI assistant** to any documentation site — powered by [Agora Conversational AI](https://docs.agora.io/en/ai).

Users click a button, speak naturally, and get spoken answers directly from your documentation. No typing, no searching.

```
User speaks → Agora ASR → GPT-4o-mini (with your docs) → TTS → User hears the answer
```

---

## What you get

- **Server SDK** — a Next.js app you deploy once (Vercel, Railway, anywhere)
- **Client SDK** — `doctalk.js`, a zero-dependency script you drop into any website with 2 lines
- **Your infrastructure** — your Agora account, your docs, your data, your costs

---

## Quick start

### 1. Prerequisites

- [Agora account](https://console.agora.io) — free tier works
- Node.js 18+ and [pnpm](https://pnpm.io)

### 2. Clone and install

```bash
git clone https://github.com/anandwana001/doc-talk.git
cd doc-talk
pnpm install
```

### 3. Configure

```bash
cp .env.local.example .env.local
```

Fill in your Agora credentials and point to your docs. See [Configuration](docs/configuration.md).

### 4. Run

```bash
pnpm dev
# http://localhost:3000
```

Open `http://localhost:3000/embed` to test the voice UI in your browser.

### 5. Add to your website

```html
<script src="https://YOUR-DOCTALK-URL/doctalk.js"></script>
<script>
  DocTalk.init({ apiBase: 'https://YOUR-DOCTALK-URL' });
</script>
```

See [Integration guide](docs/integration.md) for all options.

---

## Documentation

| Guide | What's inside |
|---|---|
| [How it works](docs/how-it-works.md) | Architecture, Agora voice pipeline, MiniSearch RAG, transcript links |
| [Configuration](docs/configuration.md) | All environment variables, docs source options |
| [Integration](docs/integration.md) | Adding to your website, widget options, iframe details |
| [Deployment](docs/deployment.md) | Vercel deploy, production checklist, API auth |
| [Roadmap](docs/roadmap.md) | Known limitations and planned improvements |

---

## Tech stack

| Layer | Technology |
|---|---|
| Voice pipeline | Agora Conversational AI Engine |
| Real-time transport | Agora SD-RTN |
| Transcripts | Agora RTM |
| Framework | Next.js 15 (App Router) |
| Search / RAG | MiniSearch (BM25, in-memory) |
| Client widget | Vanilla JS — zero dependencies |
| Styling | Tailwind CSS |

---

## License

[MIT](LICENSE) — free to use, modify, and self-host commercially.
