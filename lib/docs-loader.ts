import { loadBaseDocs, searchDocs } from './search-index';

const MAX_URL_CHARS = 160_000;

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
    // 280K chars ≈ 70K tokens — GPT-4o-mini has a 128K token context window,
    // so this leaves 58K tokens for conversation history. Covers all of
    // introduction + all of AI + significant realtime-media content.
    const { text: baseText, ids: baseIds } = await loadBaseDocs(280_000);

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
