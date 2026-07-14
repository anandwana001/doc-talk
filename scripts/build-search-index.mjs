/**
 * Pre-builds the MiniSearch index from DOCS_PATH and writes it to
 * var/search-index.json so cold starts load a JSON file instead of
 * scanning and parsing every Markdown file from scratch.
 *
 * Runs automatically via the "prebuild" and "predev" npm scripts.
 * Re-run manually after editing docs: `node scripts/build-search-index.mjs`
 */

import MiniSearch from 'minisearch';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

// ---------------------------------------------------------------------------
// Load .env.local without requiring a dotenv dependency
// ---------------------------------------------------------------------------
async function loadEnvLocal() {
  try {
    const content = await readFile(join(process.cwd(), '.env.local'), 'utf-8');
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local is optional (CI, Docker, etc.)
  }
}

// ---------------------------------------------------------------------------
// Chunking logic — must stay in sync with lib/search-index.ts
// ---------------------------------------------------------------------------
const CHUNK_SIZE = 1_500;
const PRIORITY_DIRS = ['introduction', 'ai', 'realtime-media', 'api-reference'];

function getPriorityRank(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = PRIORITY_DIRS.findIndex((d) => normalized.startsWith(d));
  return idx === -1 ? PRIORITY_DIRS.length : idx;
}

function extractTitle(raw, file) {
  const m = raw.match(/^---[\s\S]*?title:\s*["']?([^\n"']+)["']?[\s\S]*?---/m);
  if (m) return m[1].trim();
  return basename(file, extname(file)).replace(/[-_]/g, ' ');
}

function extractText(raw) {
  let content = raw.replace(/^---[\s\S]*?---\n?/m, '');
  content = content.replace(/^import\s.+$/gm, '');

  const propTexts = [];
  content = content.replace(
    /\b(?:title|description|label|heading)\s*=\s*"([^"]+)"/g,
    (_, val) => { propTexts.push(val.trim()); return ''; },
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

async function buildChunks(docsPath) {
  let entries;
  try {
    const raw = await readdir(docsPath, { recursive: true });
    entries = raw.map(String).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
  } catch (err) {
    console.error('[DocTalk] Could not read DOCS_PATH:', err.message);
    return [];
  }

  const chunks = [];

  for (const file of entries) {
    try {
      const raw = await readFile(join(docsPath, file), 'utf-8');
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
          chunks.push({
            id: `${file}:${idx}`,
            title,
            content: chunk,
            filePath: file.replace(/\\/g, '/'),
            priorityRank,
          });
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const OUTPUT_PATH = join(process.cwd(), 'var', 'search-index.json');

async function main() {
  await loadEnvLocal();

  const docsPath = process.env.DOCS_PATH;
  if (!docsPath) {
    console.log('[DocTalk] prebuild: DOCS_PATH not set — skipping index build.');
    return;
  }

  console.log(`[DocTalk] Building search index from: ${docsPath}`);
  const allChunks = await buildChunks(docsPath);

  if (allChunks.length === 0) {
    console.warn('[DocTalk] No doc chunks found — check that DOCS_PATH contains .md / .mdx files.');
    return;
  }

  const index = new MiniSearch({
    fields: ['title', 'content'],
    storeFields: ['title', 'content', 'filePath', 'priorityRank'],
    searchOptions: { boost: { title: 2 }, fuzzy: 0.2, prefix: true },
  });
  index.addAll(allChunks);

  const payload = JSON.stringify({
    version: 1,
    builtAt: Date.now(),
    docsPath,
    indexJson: JSON.stringify(index),
    chunks: allChunks,
  });

  await mkdir(join(process.cwd(), 'var'), { recursive: true });
  await writeFile(OUTPUT_PATH, payload, 'utf-8');

  const fileCount = new Set(allChunks.map((c) => c.filePath)).size;
  console.log(
    `[DocTalk] Search index written → var/search-index.json` +
    ` (${allChunks.length} chunks, ${fileCount} files, ${(payload.length / 1024).toFixed(0)} KB)`,
  );
}

main().catch((err) => {
  console.error('[DocTalk] Index build failed:', err);
  process.exit(1);
});
