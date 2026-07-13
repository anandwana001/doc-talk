import type { ReactNode } from 'react';

/**
 * Minimal layout for the /embed route.
 * No nav, no footer — just the conversation UI for iframe embedding.
 * Inherits html/body from the root layout (app/layout.tsx).
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return <div className="h-screen overflow-hidden">{children}</div>;
}
