import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { loadEmbedder } from './lib/embeddings'
import { EmptyPdfError, useLibrary } from './lib/useLibrary'
import { useChat } from './lib/useChat'
import { InfoTooltip } from './lib/InfoTooltip'

type ModelStatus = 'loading' | 'ready' | 'error'

const TOP_K = 8

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
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading')
  const [modelProgress, setModelProgress] = useState('')
  const [question, setQuestion] = useState('')
  const [alpha, setAlpha] = useState(0.7)
  const [useExpansion, setUseExpansion] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const {
    documents, isLoading, processing, activeCount,
    addPdf, removeDocument, toggleDocumentActive, clearLibrary, searchMulti,
  } = useLibrary()

  const { messages, isActive, ask, clear: clearChat } = useChat()

  const chatEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => {
    loadEmbedder((p) => {
      if (p.status === 'progress' && typeof p.progress === 'number' && p.file) {
        const name = p.file.split('/').pop() ?? p.file
        setModelProgress(`${name}: ${Math.round(p.progress)}%`)
      }
    })
      .then(() => { setModelStatus('ready'); setModelProgress('') })
      .catch((err) => { console.error(err); setModelStatus('error'); setModelProgress(String(err)) })
  }, [])

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadError(null)
    const errors: string[] = []
    for (const file of Array.from(files)) {
      try {
        await addPdf(file)
      } catch (err) {
        console.error(`Failed to process ${file.name}:`, err)
        if (err instanceof EmptyPdfError) errors.push(err.message)
        else errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    if (errors.length > 0) setUploadError(errors.join('\n'))
    e.target.value = ''
  }

  async function handleAsk() {
    if (!question.trim() || activeCount === 0 || isActive) return
    const q = question
    setQuestion('')
    await ask({ question: q, alpha, topK: TOP_K, useExpansion, searchMulti })
  }

  const canInteract = modelStatus === 'ready' && !processing
  const canAsk = activeCount > 0 && modelStatus === 'ready' && !isActive
  const alphaLabel =
    alpha === 1 ? 'semantic only' :
    alpha === 0 ? 'keyword only'  :
    `${Math.round(alpha * 100)}% semantic / ${Math.round((1 - alpha) * 100)}% keyword`

  const statusColor =
    modelStatus === 'ready' ? 'oklch(72% 0.15 145)' :
    modelStatus === 'error' ? 'oklch(65% 0.18 25)'  :
    'oklch(72% 0.12 55)'

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      <AppNav crumb="local-first-rag" />
      <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppHeader
        title="Local-First RAG"
        subtitle="Chat with your PDFs. Text extraction, chunking, and embeddings run entirely in your browser. Only the final prompt is sent to Claude using your own API key."
      />

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Model status + API key */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
              background: statusColor,
              boxShadow: modelStatus === 'ready' ? `0 0 6px ${statusColor}` : 'none',
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: statusColor, letterSpacing: '0.06em' }}>
              {modelStatus === 'ready' ? 'EMBEDDING MODEL READY' :
               modelStatus === 'error' ? 'MODEL ERROR' :
               modelProgress || 'LOADING MODEL…'}
            </span>
          </div>
        </div>

        {/* Library */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionLabel>
              Library{documents.length > 0 ? ` — ${activeCount} of ${documents.length} active` : ''}
            </SectionLabel>
            {documents.length > 0 && (
              <button
                onClick={() => { if (confirm('Remove all documents from your library?')) clearLibrary() }}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14 }}
              >
                clear all
              </button>
            )}
          </div>

          {/* Upload drop */}
          <label style={{
            display: 'block', border: '1px dashed var(--color-border)', borderRadius: 6,
            padding: '14px', textAlign: 'center', marginBottom: 10,
            cursor: canInteract ? 'pointer' : 'not-allowed', opacity: canInteract ? 1 : 0.5,
          }}>
            <input type="file" accept="application/pdf" multiple onChange={handleFile} disabled={!canInteract} style={{ display: 'none' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)' }}>
              {processing
                ? processing.stage === 'embedding'
                  ? `embedding ${processing.current} of ${processing.total} chunks in ${processing.fileName}…`
                  : `${processing.stage} ${processing.fileName}…`
                : 'click to upload PDFs'}
            </span>
          </label>

          {uploadError && (
            <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 5, border: '1px solid oklch(65% 0.18 25 / 40%)', background: 'oklch(65% 0.18 25 / 5%)' }}>
              <p style={{ fontSize: 12, color: 'oklch(65% 0.18 25)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{uploadError}</p>
              <button onClick={() => setUploadError(null)} style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>dismiss</button>
            </div>
          )}

          {/* Doc list */}
          {isLoading ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-faint)', padding: '16px 0', textAlign: 'center' }}>loading library…</p>
          ) : documents.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-faint)', padding: '16px 0', textAlign: 'center' }}>no documents yet</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {documents.map((doc) => (
                <li key={doc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 5, opacity: doc.isActive ? 1 : 0.45,
                }}>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleDocumentActive(doc.id!)}
                    role="switch"
                    aria-checked={doc.isActive}
                    aria-label={doc.isActive ? 'Deactivate document' : 'Activate document'}
                    style={{
                      position: 'relative', flexShrink: 0, width: 28, height: 15, borderRadius: 8,
                      background: doc.isActive ? 'oklch(72% 0.15 145)' : 'var(--color-border)',
                      border: 'none', cursor: 'pointer', transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, width: 11, height: 11, borderRadius: '50%',
                      background: 'var(--color-bg)',
                      left: doc.isActive ? 15 : 2,
                      transition: 'left 0.2s',
                    }} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {doc.pageCount} pages · {doc.chunkCount} chunks
                    </p>
                  </div>
                  <button
                    onClick={() => removeDocument(doc.id!)}
                    aria-label={`Remove ${doc.name}`}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Retrieval controls */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>retrieval mode</span>
              <InfoTooltip>
                <strong>Hybrid retrieval.</strong> Combines semantic search (embeddings) and keyword search (BM25).
                Semantic handles synonyms well; keyword is precise on exact terms. The middle usually wins.
              </InfoTooltip>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text)' }}>{alphaLabel}</span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: 'var(--color-surface-2)', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, width: `${alpha * 100}%`, height: '100%', borderRadius: 2, background: 'var(--color-text)' }} />
            <div style={{
              position: 'absolute', left: `${alpha * 100}%`, transform: 'translateX(-50%)',
              top: '50%', marginTop: -5, width: 10, height: 10, borderRadius: '50%',
              background: 'var(--color-text)', border: '2px solid var(--color-bg)',
            }} />
          </div>
          <input
            type="range" min="0" max="1" step="0.05" value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            aria-label="Hybrid search weight"
            style={{ position: 'absolute', opacity: 0, width: '100%', left: 0, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-faint)' }}>keyword</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-faint)' }}>semantic</span>
          </div>
          {/* Accessible range input on top (visually hidden) */}
        </div>

        {/* Query expansion toggle */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>query expansion</span>
              <InfoTooltip>
                <strong>Query expansion via LLM.</strong> Rewrites your question into 2–3 phrasings that match how an answer is likely worded inside a document. Fixes vocabulary-mismatch issues.
              </InfoTooltip>
            </div>
            <button
              onClick={() => setUseExpansion((v) => !v)}
              role="switch"
              aria-checked={useExpansion}
              style={{
                position: 'relative', flexShrink: 0, width: 28, height: 15, borderRadius: 8,
                background: useExpansion ? 'oklch(72% 0.15 145)' : 'var(--color-border)',
                border: 'none', cursor: 'pointer', transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, width: 11, height: 11, borderRadius: '50%',
                background: 'var(--color-bg)', left: useExpansion ? 15 : 2, transition: 'left 0.2s',
              }} />
            </button>
          </div>
        </div>

        {/* Conversation */}
        {messages.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel>Conversation</SectionLabel>
              <button
                onClick={clearChat}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14 }}
              >
                clear
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((m) => (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Question */}
                  <div style={{ padding: '12px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 5 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', marginBottom: 5 }}>you asked</p>
                    <p style={{ fontSize: 12, color: 'var(--color-text)' }}>{m.question}</p>
                  </div>

                  {/* Expansion */}
                  {(m.isExpanding || m.expansions.length > 0) && (
                    <div style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 5 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', marginBottom: 5 }}>
                        {m.isExpanding ? 'expanding query…' : 'expanded to:'}
                      </p>
                      {m.isExpanding ? (
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)' }}>thinking…</p>
                      ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {m.expansions.map((e, i) => (
                            <li key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text)' }}>
                              <span style={{ color: 'var(--color-text-faint)' }}>→</span> {e}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Answer */}
                  <div style={{ padding: '12px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)' }}>claude answered</p>
                      {m.isStreaming && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)' }}>streaming…</span>}
                    </div>
                    {m.error ? (
                      <p style={{ fontSize: 12, color: 'oklch(65% 0.18 25)', lineHeight: 1.6 }}>{m.error}</p>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {m.answer}
                        {m.isStreaming && <span style={{ display: 'inline-block', width: 6, height: 12, background: 'var(--color-text-muted)', marginLeft: 2, verticalAlign: 'middle' }} />}
                      </p>
                    )}
                  </div>

                  {/* Citations */}
                  {m.citations.length > 0 && (
                    <details style={{ marginTop: 2 }}>
                      <summary style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', cursor: 'pointer' }}>
                        sources · {m.citations.length} excerpts retrieved
                      </summary>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {m.citations.map((c, i) => (
                          <li key={`${m.id}-${c.chunk.id}-${i}`} style={{ padding: '10px 12px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ color: 'var(--color-text)' }}>[{i + 1}]</span> {c.documentName} · page {c.chunk.page}
                              </p>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', flexShrink: 0 }}>{c.score.toFixed(3)}</span>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{c.chunk.text}</p>
                            {m.expansions.length > 0 && c.matchedQuery !== m.question && (
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', marginTop: 4 }}>
                                matched via: "{c.matchedQuery}"
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
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
              placeholder={
                documents.length === 0   ? 'upload a document first…' :
                activeCount === 0        ? 'enable at least one document…' :
                isActive                 ? 'claude is answering…' :
                'ask Claude about your documents…'
              }
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
      </div>

      </div>
    </div>
  )
}
