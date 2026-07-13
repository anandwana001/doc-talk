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

### 3. Set environment variables

In the Vercel dashboard → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_AGORA_APP_ID` | Your Agora App ID |
| `NEXT_AGORA_APP_CERTIFICATE` | Your Agora App Certificate |
| `DOCS_LLM_URL` | `https://docs.yourcompany.com/llms.txt` |
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
- **Self-hosted** — `pnpm build && pnpm start`, run behind nginx

---

## Production checklist

Complete these before exposing DocTalk to real users:

### Must have

- [ ] **Use `DOCS_LLM_URL`** — local `DOCS_PATH` does not work on cloud deployments
- [ ] **Add API auth to `/api/invite-agent`** — without this, anyone can call your endpoint and create agents on your Agora account

  Add to `/api/invite-agent/route.ts`:
  ```ts
  const secret = process.env.API_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  ```

  Add to `public/doctalk.js` fetch call:
  ```js
  headers: { 'Authorization': 'Bearer ' + apiSecret }
  ```

  Set `API_SECRET=your-random-secret` in your env. Pass the same value to `DocTalk.init({ apiSecret: '...' })`.

- [ ] **Set `DOCS_BASE_URL`** to your real docs URL so transcript links work

### Recommended

- [ ] **Rate limit `/api/invite-agent`** per IP — protects your Agora credits from abuse. Use `@upstash/ratelimit` (free tier available) or a simple in-memory counter.
- [ ] **Enable Agora Presence** in the Agora Console — suppresses a non-fatal `-13001` RTM warning in logs
- [ ] **Test at real iframe dimensions** — the widget renders at ~380×560px; test at that size, not at full-browser `/embed`

---

## Agora Console setup

1. Create a project at [console.agora.io](https://console.agora.io)
2. Copy the **App ID** and **App Certificate** into your env vars
3. Enable **Conversational AI** for your project
4. (Optional) Enable **Presence** under the RTM section to suppress the -13001 log warning

Agora's free tier includes enough usage to run demos and development. Check [Agora pricing](https://www.agora.io/en/pricing/) for production estimates.
