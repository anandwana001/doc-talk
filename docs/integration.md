# Integration Guide

This guide explains how to add DocTalk to your website once you have the server deployed.

---

## The 2-line embed

Add these two lines to the bottom of your `<body>` on any HTML page:

```html
<script src="https://YOUR-DOCTALK-URL/doctalk.js"></script>
<script>
  DocTalk.init({
    apiBase: 'https://YOUR-DOCTALK-URL'
  });
</script>
```

Replace `YOUR-DOCTALK-URL` with your deployed DocTalk server URL (e.g. `https://doc-talk.vercel.app`).

A floating "Talk to Docs" button appears in the bottom-right corner. Users click it to start a voice conversation.

---

## All widget options

```js
DocTalk.init({
  apiBase:  'https://your-doctalk.vercel.app', // required
  label:    'Talk to Docs',                    // button label
  position: 'bottom-right',                   // or 'bottom-left'
  color:    '#2563eb',                         // button background color
});
```

---

## How page context is passed

When a user opens the widget, `doctalk.js` automatically captures:
- `document.title` — the current page title
- `window.location.pathname` — the current URL path

This is passed as a `?ctx=` parameter on the iframe URL. DocTalk's server uses it to do an extra MiniSearch query and preload relevant docs for that specific page — so if the user is on your "Authentication" page, the agent loads authentication-related content first.

This is automatic and requires no configuration.

---

## Embedding in a React / Next.js docs site

If your docs site is a React app, you can load the widget script in a `useEffect`:

```tsx
useEffect(() => {
  const script = document.createElement('script');
  script.src = 'https://your-doctalk.vercel.app/doctalk.js';
  script.onload = () => {
    (window as any).DocTalk.init({ apiBase: 'https://your-doctalk.vercel.app' });
  };
  document.body.appendChild(script);
  return () => document.body.removeChild(script);
}, []);
```

---

## Using the `/embed` page directly

The `/embed` page can be used directly without `doctalk.js` if you want to embed DocTalk in your own iframe:

```html
<iframe
  src="https://your-doctalk.vercel.app/embed?ctx=Getting+Started"
  width="400"
  height="600"
  allow="microphone"
  style="border: none; border-radius: 12px;"
/>
```

The `allow="microphone"` attribute is required — without it, the browser blocks microphone access inside the iframe.

The `?ctx=` parameter is optional. Pass a topic hint (page title + path) for better doc relevance.

---

## Microphone permissions

DocTalk requires microphone access. Browsers prompt the user once and remember the choice. The permission is scoped to your DocTalk server's origin, not your docs site's origin (because the voice UI runs in an iframe from DocTalk's domain).

Users on mobile (iOS Safari, Android Chrome) will see the permission prompt the first time they click the button.
