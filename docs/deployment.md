# Deployment

## Deploy to Vercel (recommended)

### 1. Push to GitHub

```bash
git remote add origin https://github.com/your-org/doc-talk.git
git push -u origin main
```

### 2. Import on Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
2. Vercel auto-detects Next.js — no build config needed
3. The `prebuild` script runs automatically and builds the search index before each deploy

### 3. Set environment variables

In the Vercel dashboard → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_AGORA_APP_ID` | Your Agora App ID |
| `NEXT_AGORA_APP_CERTIFICATE` | Your Agora App Certificate |
| `DOCS_LLM_URL` | `https://docs.yourcompany.com/llms.txt` |
| `APP_URL` | Your Vercel deployment URL, e.g. `https://your-doctalk.vercel.app` |
| `MCP_SECRET` | Output of `openssl rand -hex 32` |
| `COMPANY_NAME` | Your company name |
| `AGENT_NAME` | Your assistant's name |
| `AGENT_GREETING` | Opening message |
| `DOCS_BASE_URL` | Your docs site base URL |
| `DOCS_URL_LOCALE` | `en` (or your locale) |

> **Do not use `DOCS_PATH` on Vercel** — local file paths do not exist in serverless environments. Use `DOCS_LLM_URL` instead.

### 4. Deploy

Click Deploy. Your DocTalk URL will be `https://your-project.vercel.app`.

### 5. Update your website

```html
<script src="https://your-project.vercel.app/doctalk.js"></script>
<script>
  DocTalk.init({ apiBase: 'https://your-project.vercel.app' });
</script>
```

---

## Deploy to other platforms

DocTalk is a standard Next.js app. It runs on any platform that supports Node.js:

- **Railway** — connect GitHub repo, set env vars, deploy
- **Render** — same as Railway
- **Self-hosted** — `npm run build && npm start`, run behind nginx

---

## Production checklist

Complete these before exposing DocTalk to real users.

### Must have

- [ ] **Set `APP_URL`** to your deployment URL — without it, the agent has no documentation access
- [ ] **Set `MCP_SECRET`** — without it, `/api/mcp` is open to anyone
- [ ] **Use `DOCS_LLM_URL`** on cloud deployments — local `DOCS_PATH` does not exist on remote servers
- [ ] **Set `DOCS_BASE_URL`** so transcript doc links work

### Recommended

- [ ] **Enable Agora Presence** in the Agora Console — suppresses a non-fatal `-13001` RTM warning in logs
- [ ] **Test at real iframe dimensions** — the widget renders at ~380×560px; test at that size

---

## Agora Console setup

1. Create a project at [console.agora.io](https://console.agora.io)
2. Copy the **App ID** and **App Certificate** into your env vars
3. Enable **Conversational AI** for your project
4. (Optional) Enable **Presence** under the RTM section to suppress the `-13001` log warning

Agora's free tier includes enough usage to run demos and development. Check [Agora pricing](https://www.agora.io/en/pricing/) for production estimates.

---

## Local development with ngrok

To test the full MCP flow locally, Agora's cloud needs to reach your machine:

```bash
# Terminal 1 — start DocTalk
npm run dev -- -p 3002

# Terminal 2 — open tunnel
ngrok http 3002 --host-header=rewrite
```

Set in `.env.local`:
```env
APP_URL=https://xxxx.ngrok-free.dev
MCP_SECRET=<your secret>
```

Restart the dev server after changing `.env.local`.
