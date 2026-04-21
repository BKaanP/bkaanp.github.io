import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { loadEmbedder } from './lib/embeddings'
import { EmptyPdfError, useLibrary } from './lib/useLibrary'
import { useChat } from './lib/useChat'
import { getApiKey, looksLikeAnthropicKey, setApiKey } from './lib/apiKey'
import { InfoTooltip } from './lib/InfoTooltip'
 
type ModelStatus = 'loading' | 'ready' | 'error'
 
const TOP_K = 8
 
export default function App() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading')
  const [modelProgress, setModelProgress] = useState('')
  const [question, setQuestion] = useState('')
  const [alpha, setAlpha] = useState(0.7)
  const [useExpansion, setUseExpansion] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showKeyDialog, setShowKeyDialog] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [hasKey, setHasKey] = useState<boolean>(() => !!getApiKey())
 
  const {
    documents,
    isLoading,
    processing,
    activeCount,
    addPdf,
    removeDocument,
    toggleDocumentActive,
    clearLibrary,
    searchMulti,
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
      .then(() => {
        setModelStatus('ready')
        setModelProgress('')
      })
      .catch((err) => {
        console.error(err)
        setModelStatus('error')
        setModelProgress(String(err))
      })
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
    const apiKey = getApiKey()
    if (!apiKey) {
      setShowKeyDialog(true)
      return
    }
    const q = question
    setQuestion('')
    await ask({
      apiKey,
      question: q,
      alpha,
      topK: TOP_K,
      useExpansion,
      searchMulti,
    })
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
 
  const canInteract = modelStatus === 'ready' && !processing
  const canAsk = activeCount > 0 && modelStatus === 'ready' && !isActive
 
  const alphaLabel =
    alpha === 1
      ? 'semantic only'
      : alpha === 0
        ? 'keyword only'
        : `${Math.round(alpha * 100)}% semantic / ${Math.round((1 - alpha) * 100)}% keyword`
 
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <a href="/" className="inline-block text-sm font-mono text-[var(--color-accent)] hover:underline">
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
          <h1 className="text-3xl font-semibold mb-3">Local-First RAG</h1>
          <p className="text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
            Chat with your PDFs. Text extraction, chunking, and embeddings run entirely in your browser.
            Only the final prompt and retrieved excerpts are sent to Claude &mdash; using your own API key.
          </p>
        </header>
 
        {modelStatus === 'loading' && (
          <div className="mb-6 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <p className="text-sm font-mono text-[var(--color-text-muted)]">
              Loading embedding model (~22MB, cached after first visit)...
            </p>
            {modelProgress && (
              <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1 truncate">{modelProgress}</p>
            )}
          </div>
        )}
 
        {modelStatus === 'error' && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/50 bg-[var(--color-surface)]">
            <p className="text-sm font-mono text-red-400">Failed to load model: {modelProgress}</p>
          </div>
        )}
 
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
              Library
              {documents.length > 0 && (
                <span className="ml-2 normal-case tracking-normal">
                  ({activeCount} of {documents.length} active)
                </span>
              )}
            </h2>
            {documents.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Remove all documents from your library?')) clearLibrary()
                }}
                className="text-xs font-mono text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
              >
                clear all
              </button>
            )}
          </div>
 
          <label
            className={`block p-6 rounded-lg border-2 border-dashed border-[var(--color-border)] text-center cursor-pointer hover:border-[var(--color-accent)] transition-colors mb-4 ${
              !canInteract ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFile}
              disabled={!canInteract}
              className="hidden"
            />
            {processing ? (
              <p className="text-[var(--color-text-muted)]">
                {processing.stage === 'extracting' && `Extracting text from ${processing.fileName}...`}
                {processing.stage === 'chunking' && `Chunking ${processing.fileName}...`}
                {processing.stage === 'embedding' &&
                  `Embedding ${processing.current} of ${processing.total} chunks in ${processing.fileName}...`}
              </p>
            ) : (
              <p className="text-[var(--color-text-muted)]">Click to upload PDFs (multiple files supported)</p>
            )}
          </label>
 
          {uploadError && (
            <div className="mb-4 p-3 rounded-lg border border-red-500/40 bg-red-500/5">
              <p className="text-sm text-red-400 whitespace-pre-line leading-relaxed">{uploadError}</p>
              <button
                onClick={() => setUploadError(null)}
                className="mt-2 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                dismiss
              </button>
            </div>
          )}
 
          {isLoading ? (
            <p className="text-center text-[var(--color-text-muted)] py-6 text-sm">Loading library...</p>
          ) : documents.length === 0 ? (
            <p className="text-center text-[var(--color-text-muted)] py-6 text-sm">No documents yet.</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border bg-[var(--color-surface)] transition-opacity ${
                    doc.isActive ? 'border-[var(--color-border)]' : 'border-[var(--color-border)] opacity-50'
                  }`}
                >
                  <button
                    onClick={() => toggleDocumentActive(doc.id!)}
                    role="switch"
                    aria-checked={doc.isActive}
                    aria-label={doc.isActive ? 'Deactivate document' : 'Activate document'}
                    className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${
                      doc.isActive ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--color-bg)] transition-transform ${
                        doc.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{doc.name}</p>
                    <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                      {doc.pageCount} pages &middot; {doc.chunkCount} chunks
                    </p>
                  </div>
                  <button
                    onClick={() => removeDocument(doc.id!)}
                    className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors text-sm px-2"
                    aria-label={`Remove ${doc.name}`}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
 
        <section className="mb-6 space-y-3">
          <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-[var(--color-text-muted)]">retrieval mode</label>
                <InfoTooltip>
                  <strong>Hybrid retrieval.</strong> Combines two ways of finding relevant chunks:{' '}
                  <em>semantic search</em> (meaning-based, via embeddings) and <em>keyword search</em> (BM25,
                  lexical overlap). Semantic handles synonyms and paraphrases well but can drift into
                  thematically similar but irrelevant content. Keyword is precise when the query shares words
                  with the document. Slide to see how each end behaves &mdash; the middle usually wins.
                </InfoTooltip>
              </div>
              <span className="text-xs font-mono text-[var(--color-accent)]">{alphaLabel}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
              aria-label="Hybrid search weight"
            />
            <div className="flex justify-between text-xs font-mono text-[var(--color-text-muted)] mt-1">
              <span>keyword (BM25)</span>
              <span>semantic (embeddings)</span>
            </div>
          </div>
 
          <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="expansion-toggle" className="text-xs font-mono text-[var(--color-text-muted)] cursor-pointer">
                  query expansion
                </label>
                <InfoTooltip>
                  <strong>Query expansion via LLM.</strong> Before retrieval, a small Claude model rewrites
                  your question into 2&ndash;3 phrasings that match how an answer is likely worded inside a
                  document. Example: <em>&quot;what is his experience&quot;</em> &rarr;{' '}
                  <em>&quot;programming languages python java&quot;</em>. Retrieval then runs over all variants
                  and deduplicates. Fixes the vocabulary-mismatch problem that plain retrieval struggles with.
                </InfoTooltip>
              </div>
              <button
                id="expansion-toggle"
                onClick={() => setUseExpansion((v) => !v)}
                role="switch"
                aria-checked={useExpansion}
                className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${
                  useExpansion ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--color-bg)] transition-transform ${
                    useExpansion ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
 
        {messages.length > 0 && (
          <section className="mb-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                Conversation
              </h2>
              <button
                onClick={clearChat}
                className="text-xs font-mono text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
              >
                clear chat
              </button>
            </div>
 
            {messages.map((m) => (
              <div key={m.id} className="space-y-3">
                <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <p className="text-xs font-mono text-[var(--color-text-muted)] mb-2">you asked</p>
                  <p className="text-sm leading-relaxed">{m.question}</p>
                </div>
 
                {(m.isExpanding || m.expansions.length > 0) && (
                  <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <p className="text-xs font-mono text-[var(--color-text-muted)] mb-2">
                      {m.isExpanding ? 'expanding query...' : 'query expanded to:'}
                    </p>
                    {m.isExpanding ? (
                      <p className="text-xs font-mono text-[var(--color-accent)] animate-pulse">thinking...</p>
                    ) : (
                      <ul className="space-y-1">
                        {m.expansions.map((e, i) => (
                          <li key={i} className="text-xs font-mono text-[var(--color-text)]">
                            <span className="text-[var(--color-text-muted)]">&rarr;</span> {e}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
 
                <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-mono text-[var(--color-text-muted)]">claude answered</p>
                    {m.isStreaming && (
                      <span className="text-xs font-mono text-[var(--color-accent)] animate-pulse">streaming...</span>
                    )}
                  </div>
                  {m.error ? (
                    <p className="text-sm text-red-400 leading-relaxed">{m.error}</p>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {m.answer}
                      {m.isStreaming && (
                        <span className="inline-block w-2 h-4 align-middle ml-0.5 bg-[var(--color-accent)] animate-pulse" />
                      )}
                    </p>
                  )}
                </div>
 
                {m.citations.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                      sources &middot; {m.citations.length} excerpts retrieved
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {m.citations.map((c, i) => (
                        <li
                          key={`${m.id}-${c.chunk.id}-${i}`}
                          className="p-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
                        >
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <p className="text-xs font-mono text-[var(--color-text-muted)] truncate">
                              <span className="text-[var(--color-accent)]">[{i + 1}]</span>{' '}
                              {c.documentName} &middot; page {c.chunk.page}
                            </p>
                            <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0">
                              {c.score.toFixed(3)}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed text-[var(--color-text-muted)] mb-1">
                            {c.chunk.text}
                          </p>
                          {m.expansions.length > 0 && c.matchedQuery !== m.question && (
                            <p className="text-[10px] font-mono text-[var(--color-accent)] mt-1 opacity-70">
                              matched via: &quot;{c.matchedQuery}&quot;
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
                documents.length === 0
                  ? 'Upload a document first...'
                  : activeCount === 0
                    ? 'Enable at least one document...'
                    : isActive
                      ? 'Claude is answering...'
                      : 'Ask Claude about your documents...'
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
      </div>
 
      {showKeyDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-6 z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Anthropic API key</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
              Needed to generate answers with Claude. Your key is stored in localStorage and sent
              directly to api.anthropic.com &mdash; never to any third-party server.
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
 