import MiniSearch from 'minisearch';
import fs from 'fs/promises';
import path from 'path';

interface DocChunk {
  id: string;
  title: string;
  content: string;
  filePath: string;
  priorityRank: number; // lower = higher priority
}

const CHUNK_SIZE = 1_500;

// Priority order: lower index = loaded first and boosted in search
const PRIORITY_DIRS = ['introduction', 'ai', 'realtime-media', 'api-reference'];

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
    (_, val: string) => {
      propTexts.push(val.trim());
      return '';
    },
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

interface SearchIndex {
  index: MiniSearch;
  chunks: Map<string, DocChunk>;
  // Chunks pre-sorted by priority for the base load
  prioritySorted: DocChunk[];
}

let _indexPromise: Promise<SearchIndex> | null = null;

function getIndex(): Promise<SearchIndex> {
  if (_indexPromise) return _indexPromise;

  _indexPromise = (async (): Promise<SearchIndex> => {
    const docsPath = process.env.DOCS_PATH;
    if (!docsPath) {
      return {
        index: new MiniSearch({ fields: ['title', 'content'] }),
        chunks: new Map(),
        prioritySorted: [],
      };
    }

    const allChunks = await buildChunks(docsPath);

    const index = new MiniSearch<DocChunk>({
      fields: ['title', 'content'],
      storeFields: ['title', 'content', 'filePath', 'priorityRank'],
      searchOptions: {
        boost: { title: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    index.addAll(allChunks);

    // Pre-sort by priority rank then by file depth (shallower = more overview)
    const prioritySorted = [...allChunks].sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
      const aDepth = (a.filePath.match(/\//g) || []).length;
      const bDepth = (b.filePath.match(/\//g) || []).length;
      return aDepth - bDepth;
    });

    const chunks = new Map(allChunks.map((c) => [c.id, c]));
    const fileCount = new Set(allChunks.map((c) => c.filePath)).size;
    console.log(`[DocTalk] Search index ready: ${allChunks.length} chunks from ${fileCount} files`);
    return { index, chunks, prioritySorted };
  })();

  return _indexPromise;
}

/**
 * Load a broad base of high-priority documentation — always included regardless
 * of what the user asks. Covers intro, AI, realtime-media, and api-reference
 * sections comprehensively so Ara isn't blind to core topics.
 */
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

/**
 * Search for the top matching doc pages for a given query.
 * Returns one link per unique file (deduped across chunks).
 * Used to show "Related docs" links in the transcript.
 */
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
    seen.add(chunk.filePath);
    links.push({ title: chunk.title, filePath: chunk.filePath });
  }

  return links;
}

/**
 * Search for chunks relevant to a specific query (e.g. user's question or page context).
 * Excludes IDs already included in the base load.
 */
export async function searchDocs(
  query: string,
  excludeIds: Set<string> = new Set(),
  topK = 20,
  maxChars = 40_000,
): Promise<string> {
  if (!query.trim()) return '';

  const { index, chunks } = await getIndex();
  if (index.documentCount === 0) return '';

  const results = index.search(query).slice(0, topK * 3); // fetch extra to account for exclusions
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

// Warm up the index on module load so the first request is fast.
if (process.env.DOCS_PATH) {
  getIndex().catch(() => {});
}
