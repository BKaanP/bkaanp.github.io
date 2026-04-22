import { useEffect, useRef, useState } from 'react'
import { McpClient } from './lib/mcp/client'
import { createInProcessPair } from './lib/mcp/transport'
import type { ToolDefinition } from './lib/mcp/types'
import { createCrmServer } from './lib/crm/server'
import { seedCrmIfEmpty } from './lib/crm/seed'
import { useAgent, type AgentStep } from './lib/useAgent'
import { getApiKey, looksLikeAnthropicKey, setApiKey } from './lib/apiKey'
import { InfoTooltip } from './lib/InfoTooltip'
import { DataBrowser } from './lib/DataBrowser'

type InitStatus = 'initializing' | 'ready' | 'error'

export default function App() {
  const [status, setStatus] = useState<InitStatus>('initializing')
  const [errorMsg, setErrorMsg] = useState('')
  const [serverName, setServerName] = useState('')
  const [tools, setTools] = useState<ToolDefinition[]>([])
  const [client, setClient] = useState<McpClient | null>(null)

  const [question, setQuestion] = useState('')
  const [showKeyDialog, setShowKeyDialog] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [hasKey, setHasKey] = useState<boolean>(() => !!getApiKey())

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
    const apiKey = getApiKey()
    if (!apiKey) {
      setShowKeyDialog(true)
      return
    }
    const q = question
    setQuestion('')
    await ask({ apiKey, client, tools, question: q })
  }

  function handleSaveKey() {
    const trimmed = keyInput.trim()
    if (!looksLikeAnthropicKey(trimmed)) {
      alert('That does not look like an Anthropic API key (expected format: sk-ant-...)')
      return
    }
    setApiKey(trimmed)
    setHasKey(true)
    setShowKeyDialog(false)
    setKeyInput('')
  }

  const canAsk = status === 'ready' && !isActive

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <a
            href="/"
            className="inline-block text-sm font-mono text-[var(--color-accent)] hover:underline"
          >
            &larr; back to portfolio
          </a>
          <button
            onClick={() => setShowKeyDialog(true)}
            className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            {hasKey ? 'api key: set' : 'api key: not set'}
          </button>
        </div>

        <header className="mb-10">
          <h1 className="text-3xl font-semibold mb-3">MCP Client</h1>
          <p className="text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
            A browser-native Model Context Protocol client connected to an in-browser CRM server.
            Watch Claude decide which tools to call, see every request and response, and follow
            the agent loop turn by turn.
          </p>
        </header>

        {status === 'initializing' && (
          <p className="text-sm font-mono text-[var(--color-text-muted)]">Initializing...</p>
        )}

        {status === 'error' && (
          <div className="p-4 rounded-lg border border-red-500/50 bg-[var(--color-surface)]">
            <p className="text-sm font-mono text-red-400">Initialization failed: {errorMsg}</p>
          </div>
        )}

        {status === 'ready' && (
          <>
            <section className="mb-6 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                    connected server
                  </p>
                  <InfoTooltip>
                    <strong>MCP Server.</strong> A process that exposes tools to any MCP-aware
                    client. Here the server runs in-browser (same JS runtime as the client),
                    but the protocol is identical to stdio or SSE transports. The server is
                    passive &mdash; it only responds when called. The LLM is what decides when
                    and how to use each tool.
                  </InfoTooltip>
                </div>
                <span className="text-xs font-mono text-[var(--color-accent)]">{serverName}</span>
              </div>
              <details>
                <summary className="cursor-pointer text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  {tools.length} tools available
                </summary>
                <ul className="mt-3 space-y-2">
                  {tools.map((t) => (
                    <li key={t.name} className="text-xs">
                      <p className="font-mono text-[var(--color-accent)]">{t.name}</p>
                      <p className="text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                        {t.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            </section>

            <DataBrowser />

            <section className="mb-6 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                  try asking
                </p>
                <InfoTooltip>
                  <strong>Sample prompts.</strong> These are designed to trigger different agent
                  behaviors &mdash; single tool call, multiple sequential calls, and composed
                  answers. Watch how the agent loop unfolds in the conversation below.
                </InfoTooltip>
              </div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setQuestion(p)}
                    disabled={!canAsk}
                    className="px-3 py-1.5 text-xs font-mono rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>

            {exchanges.length > 0 && (
              <section className="mb-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                      Agent loop
                    </h2>
                    <InfoTooltip>
                      <strong>Agent loop.</strong> Each exchange may take multiple turns: Claude
                      calls tools, we execute them, return results, and Claude decides whether
                      to call more tools or produce a final answer. Each turn is shown below in
                      order. <em>thinking</em> means Claude is processing; tool calls show input
                      (what Claude asked for) and output (what the MCP server returned).
                    </InfoTooltip>
                  </div>
                  <button
                    onClick={clearChat}
                    className="text-xs font-mono text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                  >
                    clear chat
                  </button>
                </div>

                {exchanges.map((ex) => (
                  <div key={ex.id} className="space-y-3">
                    <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                      <p className="text-xs font-mono text-[var(--color-text-muted)] mb-2">
                        you asked
                      </p>
                      <p className="text-sm leading-relaxed">{ex.question}</p>
                    </div>

                    {ex.steps.map((step, i) => (
                      <StepView key={i} step={step} />
                    ))}

                    {ex.error && (
                      <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/5">
                        <p className="text-sm text-red-400 leading-relaxed">{ex.error}</p>
                      </div>
                    )}

                    {ex.isRunning && ex.steps.length === 0 && (
                      <p className="text-xs font-mono text-[var(--color-accent)] animate-pulse pl-4">
                        starting agent...
                      </p>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </section>
            )}

            <section>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                  placeholder={
                    isActive
                      ? 'Agent is running...'
                      : 'Ask Claude something about the CRM...'
                  }
                  disabled={!canAsk}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
                />
                <button
                  onClick={handleAsk}
                  disabled={!question.trim() || !canAsk}
                  className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-mono text-sm hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ask
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      {showKeyDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-6 z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Anthropic API key</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
              Needed for Claude to decide which tools to call. Your key is stored in localStorage
              and sent directly to api.anthropic.com &mdash; never to any third-party server.
            </p>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 mb-4 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] font-mono text-sm focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowKeyDialog(false)
                  setKeyInput('')
                }}
                className="px-3 py-1.5 text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                cancel
              </button>
              <button
                onClick={handleSaveKey}
                className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-mono text-sm hover:bg-[var(--color-accent-hover)]"
              >
                save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function StepView({ step }: { step: AgentStep }) {
  if (step.kind === 'thinking') {
    return (
      <div className="pl-4 py-1">
        <p className="text-xs font-mono text-[var(--color-accent)] animate-pulse">
          turn {step.turn} &middot; thinking...
        </p>
      </div>
    )
  }

  if (step.kind === 'text') {
    return (
      <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs font-mono text-[var(--color-text-muted)] mb-2">
          turn {step.turn} &middot; claude
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{step.text}</p>
      </div>
    )
  }

  const running = step.output === null
  const errored = step.isError === true

  return (
    <div
      className={`p-4 rounded-lg border bg-[var(--color-surface)] ${
        errored
          ? 'border-red-500/40'
          : running
            ? 'border-[var(--color-accent)]/40'
            : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs font-mono text-[var(--color-text-muted)]">
          turn {step.turn} &middot; tool call
        </p>
        <span
          className={`text-xs font-mono ${
            errored
              ? 'text-red-400'
              : running
                ? 'text-[var(--color-accent)] animate-pulse'
                : 'text-[var(--color-text-muted)]'
          }`}
        >
          {running ? 'running...' : errored ? 'error' : 'ok'}
        </span>
      </div>

      <p className="text-sm font-mono text-[var(--color-accent)] mb-1">{step.name}</p>
      <pre className="text-xs font-mono text-[var(--color-text-muted)] mb-2 whitespace-pre-wrap break-all">
        input: {JSON.stringify(step.input, null, 2)}
      </pre>

      {step.output !== null && (
        <>
          <div className="h-px bg-[var(--color-border)] my-2" />
          <pre className="text-xs font-mono text-[var(--color-text)] whitespace-pre-wrap break-all">
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