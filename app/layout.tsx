import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocTalk — Talk to Your Documentation',
  description: 'Voice AI assistant powered by Agora Conversational AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
