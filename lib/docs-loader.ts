import { loadBaseDocs, searchDocs } from './search-index';

const MAX_URL_CHARS = 80_000;
const MAX_CONTEXT_CHARS = 8_000;
const URL_CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour

let _urlCache: { url: string; content: string; fetchedAt: number } | null = null;

export function invalidateUrlCache(): void {
  _urlCache = null;
}

async function loadFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    console.log(`[DocTalk] Loaded ${text.length} chars from ${url}`);
    return text.slice(0, MAX_URL_CHARS);
  } catch (err) {
    console.error('[DocTalk] Could not fetch DOCS_LLM_URL:', err);
    return '';
  }
}

async function loadFromUrlCached(url: string): Promise<string> {
  const now = Date.now();
  if (_urlCache && _urlCache.url === url && now - _urlCache.fetchedAt < URL_CACHE_TTL_MS) {
    return _urlCache.content;
  }
  const content = await loadFromUrl(url);
  _urlCache = { url, content, fetchedAt: now };
  return content;
}

/**
 * Per-turn context retrieval for the RAG proxy.
 * Returns only the chunks most relevant to `query` — typically 2–3K tokens
 * instead of the 30K loaded at session start in direct mode.
 */
export async function getContextForQuery(query: string): Promise<string> {
  if (process.env.DOCS_CONTENT) {
    return process.env.DOCS_CONTENT.slice(0, MAX_CONTEXT_CHARS);
  }
  if (process.env.DOCS_LLM_URL) {
    const full = await loadFromUrlCached(process.env.DOCS_LLM_URL);
    return full.slice(0, MAX_CONTEXT_CHARS);
  }
  if (process.env.DOCS_PATH) {
    return searchDocs(query, new Set(), 6, MAX_CONTEXT_CHARS);
  }
  return '';
}

/**
 * Load documentation from the configured source.
 *
 * For DOCS_PATH, the strategy is:
 *   1. Always load a broad base of priority docs (intro, AI, realtime-media,
 *      api-reference) — up to 120K chars. This gives Ara comprehensive coverage
 *      of core topics regardless of what the user asks.
 *   2. If a page context hint is provided, also run a targeted search and
 *      append any additional relevant chunks not already in the base load.
 *
 * This two-layer approach covers any-size docs without a per-question RAG proxy.
 */
export async function loadDocumentation(context?: string): Promise<string> {
  if (process.env.DOCS_CONTENT) {
    return process.env.DOCS_CONTENT.slice(0, MAX_URL_CHARS);
  }
  if (process.env.DOCS_LLM_URL) {
    return loadFromUrl(process.env.DOCS_LLM_URL);
  }
  if (process.env.DOCS_PATH) {
    // Layer 1: always load the priority doc base.
    // 120K chars ≈ 30K tokens, leaving ~98K tokens for system prompt overhead
    // and conversation history (maxHistory: 20 turns × ~1K tokens avg = 20K).
    // Covers introduction + AI + significant realtime-media content.
    const { text: baseText, ids: baseIds } = await loadBaseDocs(120_000);

    // Layer 2: if page context is meaningful, add context-specific chunks
    // that aren't already in the base load.
    let contextText = '';
    if (context?.trim() && context.trim().length > 5) {
      contextText = await searchDocs(context, baseIds, 20, 40_000);
    }

    const combined = [baseText, contextText].filter(Boolean).join('\n\n');
    console.log(`[DocTalk] Docs loaded: ${combined.length} chars (base + context)`);
    return combined;
  }
  return '';
}
