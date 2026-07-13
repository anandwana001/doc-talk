import { DocTalkEmbed } from '@/components/DocTalkEmbed';

interface EmbedPageProps {
  searchParams: Promise<{ ctx?: string }>;
}

/**
 * Full-screen conversation embed.
 * Load this URL inside an iframe: <iframe src="http://localhost:3001/embed?ctx=Page+Title+/path" allow="microphone" />
 * The `ctx` param carries the host page's title + URL path for MiniSearch retrieval.
 */
export default async function EmbedPage({ searchParams }: EmbedPageProps) {
  const { ctx } = await searchParams;
  return (
    <div className="h-screen">
      <DocTalkEmbed context={ctx} />
    </div>
  );
}
