import { useEffect, useRef, useState } from 'react'
import { McpClient } from './lib/mcp/client'
import { createInProcessPair } from './lib/mcp/transport'
import type { ToolDefinition } from './lib/mcp/types'
import { createCrmServer } from './lib/crm/server'
import { seedCrmIfEmpty } from './lib/crm/seed'
import { useAgent, type AgentStep } from './lib/useAgent'
import { InfoTooltip } from './lib/InfoTooltip'
import { DataBrowser } from './lib/DataBrowser'

type InitStatus = 'initializing' | 'ready' | 'error'

// ── Shared shell components ───────────────────────────────────────────────────

function AppNav({ crumb }: { crumb: string }) {
  return (
    <div style={{
      height: 52, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>bkaanp</span>
        <span style={{ color: 'var(--color-text-faint)', fontSize: 12 }}>/</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text)', letterSpacing: '0.06em' }}>{crumb}</span>
      </div>
      <a href="/" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', textDecoration: 'none', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
        portfolio
      </a>
    </div>
  )
}

function AppHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ padding: '40px 32px 32px', borderBottom: '1px solid var(--color-border)' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-faint)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-block', width: 16, height: 1, background: 'var(--color-border)' }} />
        project
      </p>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 500, color: 'var(--color-text)', marginBottom: 12, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{title}</h1>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--color-text-muted)', maxWidth: 520, fontWeight: 300 }}>{subtitle}</p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-faint)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'inline-block', width: 16, height: 1, background: 'var(--color-border)' }} />
      {children}
    </p>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', background: 'var(--color-tag-bg)', color: 'var(--color-tag-text)', border: '1px solid var(--color-border)', borderRadius: 3 }}>
      {label}
    </span>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [status, setStatus] = useState<InitStatus>('initializing')
  const [errorMsg, setErrorMsg] = useState('')
  const [serverName, setServerName] = useState('')
  const [tools, setTools] = useState<ToolDefinition[]>([])
  const [client, setClient] = useState<McpClient | null>(null)

  const [question, setQuestion] = useState('')

  const { exchanges, isActive, ask, clear: clearChat } = useAgent()

  const chatEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [exchanges])

  useEffect(() => {
    ;(async () => {
      try {
        await seedCrmIfEmpty()
        const { client: ct, server: st } = createInProcessPair()
        const server = createCrmServer()
        server.connect(st)
        const mcp = new McpClient(ct, { name: 'bkaanp-mcp-demo', version: '0.1.0' })
        const init = await mcp.initialize()
        const toolList = await mcp.listTools()
        setServerName(`${init.serverInfo.name} v${init.serverInfo.version}`)
        setTools(toolList)
        setClient(mcp)
        setStatus('ready')
      } catch (err) {
        console.error(err)
        setErrorMsg(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    })()
  }, [])

  async function handleAsk() {
    if (!question.trim() || !client || isActive || tools.length === 0) return
    const q = question
    setQuestion('')
    await ask({ client, tools, question: q })
  }

  const canAsk = status === 'ready' && !isActive

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      <AppNav crumb="mcp-client" />
      <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppHeader
        title="MCP Client"
        subtitle="A browser-native Model Context Protocol client connected to an in-browser CRM server. Watch Claude decide which tools to call and follow the agent loop turn by turn."
      />

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Init status */}
        {status === 'initializing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'oklch(72% 0.12 55)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'oklch(72% 0.12 55)', letterSpacing: '0.06em' }}>INITIALIZING…</span>
          </div>
        )}
        {status === 'error' && (
          <div style={{ padding: '12px 14px', borderRadius: 5, border: '1px solid oklch(65% 0.18 25 / 40%)', background: 'oklch(65% 0.18 25 / 5%)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'oklch(65% 0.18 25)' }}>initialization failed: {errorMsg}</p>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Server status row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'oklch(72% 0.15 145)', boxShadow: '0 0 6px oklch(72% 0.15 145)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'oklch(72% 0.15 145)', letterSpacing: '0.06em' }}>SERVER CONNECTED</span>
            </div>

            {/* Connected server card */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <SectionLabel>Connected server</SectionLabel>
                  <InfoTooltip>
                    <strong>MCP Server.</strong> A process that exposes tools to any MCP-aware client. Here the server runs in-browser, but the protocol is identical to stdio or SSE transports. The LLM decides when and how to use each tool.
                  </InfoTooltip>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text)' }}>{serverName}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {tools.map((t) => <Tag key={t.name} label={t.name} />)}
              </div>
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', cursor: 'pointer' }}>
                  {tools.length} tools — click to see descriptions
                </summary>
                <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tools.map((t) => (
                    <li key={t.name}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text)', marginBottom: 2 }}>{t.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{t.description}</p>
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            {/* Data browser */}
            <DataBrowser />

            {/* Sample prompts */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SectionLabel>Try asking</SectionLabel>
                <InfoTooltip>
                  <strong>Sample prompts.</strong> Designed to trigger different agent behaviors — single tool call, multiple sequential calls, and composed answers. Watch the agent loop unfold below.
                </InfoTooltip>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setQuestion(p)}
                    disabled={!canAsk}
                    style={{
                      padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 4,
                      fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)',
                      background: 'none', cursor: canAsk ? 'pointer' : 'not-allowed',
                      opacity: canAsk ? 1 : 0.5, textAlign: 'left',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Agent loop */}
            {exchanges.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SectionLabel>Agent loop</SectionLabel>
                    <InfoTooltip>
                      <strong>Agent loop.</strong> Each exchange may take multiple turns: Claude calls tools, we execute them, return results, and Claude decides whether to call more tools or produce a final answer.
                    </InfoTooltip>
                  </div>
                  <button
                    onClick={clearChat}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14 }}
                  >
                    clear
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {exchanges.map((ex) => (
                    <div key={ex.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Question */}
                      <div style={{ padding: '11px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 5 }}>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', marginBottom: 4 }}>you asked</p>
                        <p style={{ fontSize: 12, color: 'var(--color-text)' }}>{ex.question}</p>
                      </div>

                      {ex.steps.map((step, i) => <StepView key={i} step={step} />)}

                      {ex.error && (
                        <div style={{ padding: '10px 12px', borderRadius: 5, border: '1px solid oklch(65% 0.18 25 / 40%)', background: 'oklch(65% 0.18 25 / 5%)' }}>
                          <p style={{ fontSize: 12, color: 'oklch(65% 0.18 25)', lineHeight: 1.5 }}>{ex.error}</p>
                        </div>
                      )}

                      {ex.isRunning && ex.steps.length === 0 && (
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)', paddingLeft: 14 }}>starting agent…</p>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}

            {/* Input */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                flex: 1, height: 38, borderRadius: 6, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', display: 'flex', alignItems: 'center', padding: '0 14px',
                opacity: canAsk ? 1 : 0.5,
              }}>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                  placeholder={isActive ? 'agent is running…' : 'ask Claude something about the CRM…'}
                  disabled={!canAsk}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text)' }}
                />
              </div>
              <button
                onClick={handleAsk}
                disabled={!question.trim() || !canAsk}
                style={{
                  height: 38, padding: '0 16px', borderRadius: 6,
                  background: 'var(--color-text)', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-bg)', fontWeight: 500,
                  opacity: !question.trim() || !canAsk ? 0.4 : 1,
                }}
              >
                ask
              </button>
            </div>
          </>
        )}
      </div>

      </div>
    </div>
  )
}

// ── Step renderer ─────────────────────────────────────────────────────────────

function StepView({ step }: { step: AgentStep }) {
  if (step.kind === 'thinking') {
    return (
      <div style={{ paddingLeft: 14 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)' }}>
          turn {step.turn} · thinking…
        </p>
      </div>
    )
  }

  if (step.kind === 'text') {
    return (
      <div style={{ padding: '11px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 5 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', marginBottom: 4 }}>turn {step.turn} · claude</p>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{step.text}</p>
      </div>
    )
  }

  const running = step.output === null
  const errored = step.isError === true

  return (
    <div style={{
      padding: '11px 14px', background: 'var(--color-surface)', borderRadius: 5,
      border: `1px solid ${errored ? 'oklch(65% 0.18 25 / 40%)' : running ? 'var(--color-text-muted)' : 'var(--color-border)'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)' }}>turn {step.turn} · tool call</p>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: errored ? 'oklch(65% 0.18 25)' : 'var(--color-text-muted)' }}>
          {running ? 'running…' : errored ? 'error' : 'ok'}
        </span>
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text)', marginBottom: 5 }}>{step.name}</p>
      <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
        input: {JSON.stringify(step.input, null, 2)}
      </pre>
      {step.output !== null && (
        <>
          <div style={{ height: 1, background: 'var(--color-border)', margin: '7px 0' }} />
          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
            {step.output}
          </pre>
        </>
      )}
    </div>
  )
}

const SAMPLE_PROMPTS = [
  'Which leads are in the manufacturing sector?',
  'Give me a summary of my interactions this week',
  'What is the status with Anna Weber?',
  'Add a new lead: Lukas Schmidt, Schmidt IT GmbH, lukas@schmidt-it.de, tag as "lead" and "it"',
  'Who have I not talked to in a long time?',
]
