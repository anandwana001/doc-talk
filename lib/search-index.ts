import MiniSearch from 'minisearch';
import fs from 'fs/promises';
import path from 'path';

interface DocChunk {
  id: string;
  title: string;
  content: string;
  filePath: string;
  priorityRank: number;
}

const CHUNK_SIZE = 1_500;
const PRIORITY_DIRS = ['introduction', 'ai', 'realtime-media', 'api-reference'];
const PREBUILT_PATH = path.join(process.cwd(), 'var', 'search-index.json');

const MINISEARCH_OPTIONS = {
  fields: ['title', 'content'] as string[],
  storeFields: ['title', 'content', 'filePath', 'priorityRank'] as string[],
  searchOptions: { boost: { title: 2 }, fuzzy: 0.2 as number, prefix: true },
};

interface SearchIndex {
  index: MiniSearch<DocChunk>;
  chunks: Map<string, DocChunk>;
  prioritySorted: DocChunk[];
}

// ---------------------------------------------------------------------------
// Helpers shared with scripts/build-search-index.mjs
// (keep in sync if you change the chunking logic)
// ---------------------------------------------------------------------------

function getPriorityRank(filePath: string): number {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = PRIORITY_DIRS.findIndex((d) => normalized.startsWith(d));
  return idx === -1 ? PRIORITY_DIRS.length : idx;
}

function extractTitle(raw: string, file: string): string {
  const m = raw.match(/^---[\s\S]*?title:\s*["']?([^\n"']+)["']?[\s\S]*?---/m);
  if (m) return m[1].trim();
  return path.basename(file, path.extname(file)).replace(/[-_]/g, ' ');
}

function extractText(raw: string): string {
  let content = raw.replace(/^---[\s\S]*?---\n?/m, '');
  content = content.replace(/^import\s.+$/gm, '');

  const propTexts: string[] = [];
  content = content.replace(
    /\b(?:title|description|label|heading)\s*=\s*"([^"]+)"/g,
    (_, val: string) => { propTexts.push(val.trim()); return ''; },
  );

  content = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\{[^}]*\}/g, '');

  const body = content.replace(/\n{3,}/g, '\n\n').trim();
  const props = propTexts.filter(Boolean).join('\n');
  return [props, body].filter(Boolean).join('\n\n');
}

function sortByPriority(chunks: DocChunk[]): DocChunk[] {
  return [...chunks].sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    const aDepth = (a.filePath.match(/\//g) ?? []).length;
    const bDepth = (b.filePath.match(/\//g) ?? []).length;
    return aDepth - bDepth;
  });
}

// ---------------------------------------------------------------------------
// Fast path: load the pre-built index from var/search-index.json
// ---------------------------------------------------------------------------

async function tryLoadPrebuilt(): Promise<SearchIndex | null> {
  try {
    const raw = await fs.readFile(PREBUILT_PATH, 'utf-8');
    const data = JSON.parse(raw) as {
      version: number;
      docsPath: string;
      indexJson: string;
      chunks: DocChunk[];
    };

    if (data.version !== 1) return null;

    if (data.docsPath !== process.env.DOCS_PATH) {
      console.warn('[DocTalk] Pre-built index is for a different DOCS_PATH — rebuilding in memory. Run `node scripts/build-search-index.mjs` to update.');
      return null;
    }

    const index = MiniSearch.loadJSON<DocChunk>(data.indexJson, MINISEARCH_OPTIONS);
    const chunks = new Map(data.chunks.map((c) => [c.id, c]));
    const prioritySorted = sortByPriority(data.chunks);

    const fileCount = new Set(data.chunks.map((c) => c.filePath)).size;
    console.log(`[DocTalk] Loaded pre-built index: ${data.chunks.length} chunks from ${fileCount} files.`);
    return { index, chunks, prioritySorted };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Slow path: build in memory (dev without a pre-built file, or DOCS_LLM_URL)
// ---------------------------------------------------------------------------

async function buildChunks(docsPath: string): Promise<DocChunk[]> {
  let entries: string[];
  try {
    const raw = await fs.readdir(docsPath, { recursive: true });
    entries = raw.map(String).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
  } catch (err) {
    console.error('[DocTalk] Could not read DOCS_PATH for search index:', err);
    return [];
  }

  const chunks: DocChunk[] = [];

  for (const file of entries) {
    try {
      const absPath = path.join(docsPath, file);
      const raw = await fs.readFile(absPath, 'utf-8');
      const title = extractTitle(raw, file);
      const text = extractText(raw);
      if (!text) continue;

      const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
      const priorityRank = getPriorityRank(file);
      let pos = 0;
      let idx = 0;

      while (pos < normalized.length) {
        let end = Math.min(pos + CHUNK_SIZE, normalized.length);
        if (end < normalized.length) {
          const split = normalized.lastIndexOf('\n\n', end);
          if (split > pos + CHUNK_SIZE * 0.5) end = split;
        }
        const chunk = normalized.slice(pos, end).trim();
        if (chunk) {
          chunks.push({ id: `${file}:${idx}`, title, content: chunk, filePath: file.replace(/\\/g, '/'), priorityRank });
          idx++;
        }
        pos = end;
      }
    } catch {
      // skip unreadable files
    }
  }

  return chunks;
}

async function buildInMemory(docsPath: string): Promise<SearchIndex> {
  const allChunks = await buildChunks(docsPath);

  const index = new MiniSearch<DocChunk>(MINISEARCH_OPTIONS);
  index.addAll(allChunks);

  const prioritySorted = sortByPriority(allChunks);
  const chunks = new Map(allChunks.map((c) => [c.id, c]));
  const fileCount = new Set(allChunks.map((c) => c.filePath)).size;
  console.log(`[DocTalk] Search index built in memory: ${allChunks.length} chunks from ${fileCount} files`);
  return { index, chunks, prioritySorted };
}

// ---------------------------------------------------------------------------
// Singleton with fast/slow path selection
// ---------------------------------------------------------------------------

let _indexPromise: Promise<SearchIndex> | null = null;

function getIndex(): Promise<SearchIndex> {
  if (_indexPromise) return _indexPromise;

  _indexPromise = (async (): Promise<SearchIndex> => {
    const docsPath = process.env.DOCS_PATH;
    if (!docsPath) {
      return { index: new MiniSearch(MINISEARCH_OPTIONS), chunks: new Map(), prioritySorted: [] };
    }

    // Fast path: pre-built JSON written by scripts/build-search-index.mjs
    const prebuilt = await tryLoadPrebuilt();
    if (prebuilt) return prebuilt;

    // Slow path: scan and parse all Markdown files at runtime
    return buildInMemory(docsPath);
  })();

  return _indexPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadBaseDocs(maxChars = 120_000): Promise<{ text: string; ids: Set<string> }> {
  const { prioritySorted } = await getIndex();
  const sections: string[] = [];
  const ids = new Set<string>();
  let total = 0;

  for (const chunk of prioritySorted) {
    if (total >= maxChars) break;
    const section = `### ${chunk.title} (${chunk.filePath})\n${chunk.content}`;
    sections.push(section);
    ids.add(chunk.id);
    total += section.length;
  }

  return { text: sections.join('\n\n'), ids };
}

export interface DocLink {
  title: string;
  filePath: string;
}

export async function searchDocsForLinks(query: string, topK = 3): Promise<DocLink[]> {
  if (!query.trim()) return [];
  const { index, chunks } = await getIndex();
  if (index.documentCount === 0) return [];

  const results = index.search(query).slice(0, topK * 6);
  const seen = new Set<string>();
  const links: DocLink[] = [];

  for (const r of results) {
    if (links.length >= topK) break;
    const chunk = chunks.get(r.id);
    if (!chunk) continue;
    if (seen.has(chunk.filePath)) continue;
    if (seen.has(chunk.title)) continue;
    seen.add(chunk.filePath);
    seen.add(chunk.title);
    links.push({ title: chunk.title, filePath: chunk.filePath });
  }

  return links;
}

export async function searchDocs(
  query: string,
  excludeIds: Set<string> = new Set(),
  topK = 20,
  maxChars = 40_000,
): Promise<string> {
  if (!query.trim()) return '';

  const { index, chunks } = await getIndex();
  if (index.documentCount === 0) return '';

  const results = index.search(query).slice(0, topK * 3);
  const sections: string[] = [];
  let total = 0;

  for (const r of results) {
    if (sections.length >= topK) break;
    if (excludeIds.has(r.id)) continue;
    const chunk = chunks.get(r.id);
    if (!chunk) continue;
    const section = `### ${chunk.title} (${chunk.filePath})\n${chunk.content}`;
    if (total + section.length > maxChars) break;
    sections.push(section);
    total += section.length;
  }

  return sections.join('\n\n');
}

// Warm up the index on module load so the first request is instant.
if (process.env.DOCS_PATH) {
  getIndex().catch(() => {});
}
