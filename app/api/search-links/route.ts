import { NextRequest, NextResponse } from 'next/server';
import { searchDocsForLinks } from '@/lib/search-index';

function filePathToUrl(filePath: string): string {
  const base = (process.env.DOCS_BASE_URL ?? '').replace(/\/$/, '');
  const locale = process.env.DOCS_URL_LOCALE ?? 'en';

  const url = filePath
    .replace(/\.(md|mdx)$/, '')   // strip extension
    .replace(/\/index$/, '');      // strip trailing /index

  return base ? `${base}/${locale}/${url}` : '';
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  if (!query.trim()) return NextResponse.json([]);

  const raw = await searchDocsForLinks(query, 3);

  const links = raw
    .map((r) => ({ title: r.title, url: filePathToUrl(r.filePath) }))
    .filter((l) => l.url); // only return if DOCS_BASE_URL is configured

  return NextResponse.json(links);
}
