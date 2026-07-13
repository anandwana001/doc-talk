import { DocTalkWidget } from '@/components/DocTalkWidget';

const companyName = process.env.COMPANY_NAME ?? 'Agora';
const agentName = process.env.AGENT_NAME ?? 'Doc Assistant';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">{companyName}</span>
            <span className="text-sm text-muted-foreground">/ Docs</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Overview</a>
            <a href="#" className="hover:text-foreground transition-colors">API Reference</a>
            <a href="#" className="hover:text-foreground transition-colors">Guides</a>
          </nav>
        </div>
      </header>

      {/* Main content — simulates a documentation page */}
      <main className="mx-auto max-w-5xl px-6 py-12 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Getting Started
          </p>
          {['Overview', 'Quickstart', 'Authentication', 'Concepts'].map((item) => (
            <a
              key={item}
              href="#"
              className="block text-sm py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {item}
            </a>
          ))}
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-3">
            Core SDK
          </p>
          {['RTC (Audio/Video)', 'RTM (Signaling)', 'Conversational AI', 'Cloud Recording'].map((item) => (
            <a
              key={item}
              href="#"
              className="block text-sm py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {item}
            </a>
          ))}
        </aside>

        {/* Doc body */}
        <article className="space-y-8 max-w-3xl">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Documentation</span>
              <span>/</span>
              <span>Conversational AI</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Conversational AI Engine
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Build low-latency voice AI agents that join real-time channels and
              converse with your users — with managed ASR, LLM, and TTS pipelines.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">How it works</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your server calls the Agora REST API to create an agent with your
              chosen LLM, ASR, and TTS providers. The agent joins an Agora RTC
              channel and subscribes to your user&apos;s audio stream. Speech is
              transcribed, sent to the LLM, and the response is synthesized back as
              audio — all with sub-500ms latency on Agora&apos;s SD-RTN.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="text-primary">✦</span>
              Try the voice widget below
            </h3>
            <p className="text-sm text-muted-foreground">
              Click <strong>Talk to Docs</strong> in the bottom-right corner to start a
              voice conversation with {agentName}. Ask anything about the
              documentation — the assistant knows your docs and answers in real time.
            </p>
            <div className="rounded-md bg-muted/50 px-4 py-3 font-mono text-sm text-foreground">
              {`<DocTalkWidget buttonLabel="Talk to Docs" />`}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Integration</h2>
            <p className="text-muted-foreground leading-relaxed">
              Drop the <code className="text-primary text-sm bg-muted px-1 py-0.5 rounded">DocTalkWidget</code> component anywhere
              in your docs site. Configure your documentation source and Agora
              credentials in <code className="text-primary text-sm bg-muted px-1 py-0.5 rounded">.env.local</code>, and your
              users can talk to your docs with zero additional infrastructure.
            </p>
          </section>

          <section className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 border-b border-border">
              <span className="text-xs font-mono text-muted-foreground">.env.local</span>
            </div>
            <pre className="p-4 text-sm font-mono text-foreground overflow-x-auto bg-card">
{`# Agora credentials (required)
NEXT_PUBLIC_AGORA_APP_ID=your_app_id
NEXT_AGORA_APP_CERTIFICATE=your_certificate

# Your company branding
COMPANY_NAME=${companyName}
AGENT_NAME=${agentName}

# Point at your docs (one option)
DOCS_PATH=/path/to/your/docs
# or DOCS_LLM_URL=https://docs.example.com/llms.txt
# or DOCS_CONTENT="Your documentation text..."`}
            </pre>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Architecture</h2>
            <div className="rounded-lg border border-border bg-muted/30 p-5">
              <pre className="text-sm font-mono text-muted-foreground whitespace-pre leading-relaxed">
{`Your docs (md/mdx/llms.txt)
        ↓
  System prompt builder
        ↓
  POST /api/invite-agent
        ↓
Agora ConvoAI Engine → Agent joins RTC channel
        ↓                          ↓
  ASR → LLM → TTS       Browser (RTC + RTM)
                         ↓
                   DocTalkWidget
                   (voice + transcript)`}
              </pre>
            </div>
          </section>
        </article>
      </main>

      {/* The embeddable widget — this is all a company needs to add */}
      <DocTalkWidget
        buttonLabel="Talk to Docs"
        panelTitle={agentName}
        position="bottom-right"
      />
    </div>
  );
}
