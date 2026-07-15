import { NextRequest, NextResponse } from 'next/server';
import { invalidateIndex, searchDocs } from '@/lib/search-index';
import { invalidateUrlCache } from '@/lib/docs-loader';

export async function POST(request: NextRequest) {
  const secret = process.env.REINDEX_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  const start = Date.now();

  // Invalidate both caches so the next search triggers a full rebuild.
  invalidateIndex();
  invalidateUrlCache();

  // Warm up immediately — don't make the first real user request pay the cost.
  await searchDocs('index', new Set(), 1, 100);

  return NextResponse.json({
    ok: true,
    rebuilt_in_ms: Date.now() - start,
    docs_source: process.env.DOCS_PATH
      ? 'DOCS_PATH'
      : process.env.DOCS_LLM_URL
        ? 'DOCS_LLM_URL'
        : 'DOCS_CONTENT',
  });
}
