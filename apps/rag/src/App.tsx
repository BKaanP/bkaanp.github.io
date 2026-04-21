export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-semibold mb-3">Local-First RAG</h1>
        <p className="text-[var(--color-text-muted)] mb-8 leading-relaxed">
          Chat with your PDFs. Embeddings and retrieval run client-side. Coming soon.
        </p>
        <a href="/" className="inline-block text-sm font-mono text-[var(--color-accent)] hover:underline">
          &larr; back to portfolio
        </a>
      </div>
    </main>
  )
}