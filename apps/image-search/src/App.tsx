import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react'
import { embedText, loadClip, similarity } from './lib/clip'
import { useImages } from './lib/useImages'
 
type ModelStatus = 'loading' | 'ready' | 'error'
 
export default function App() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading')
  const [modelProgress, setModelProgress] = useState('')
  const [query, setQuery] = useState('')
  const [queryEmbedding, setQueryEmbedding] = useState<Float32Array | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [urls, setUrls] = useState<Map<number, string>>(new Map())
 
  const { images, isLoading, processing, uploadImages, removeImage, clearAll } = useImages()
 
  // Load CLIP on mount
  useEffect(() => {
    loadClip((p) => {
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
 
  // Debounced text query embedding
  useEffect(() => {
    if (!query.trim() || modelStatus !== 'ready') {
      setQueryEmbedding(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const emb = await embedText(query)
        setQueryEmbedding(emb)
      } catch (err) {
        console.error(err)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, modelStatus])
 
  // Object URLs for display, cleaned up when images change
  useEffect(() => {
    const next = new Map<number, string>()
    for (const img of images) {
      if (img.id != null) next.set(img.id, URL.createObjectURL(img.blob))
    }
    setUrls(next)
    return () => {
      next.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [images])
 
  // Sort by similarity when query active
  const displayImages = useMemo(() => {
    if (!queryEmbedding) {
      return images.map((img) => ({ ...img, score: null as number | null }))
    }
    return images
      .map((img) => ({ ...img, score: similarity(img.embedding, queryEmbedding) }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }, [images, queryEmbedding])
 
  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const imageFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length > 0) uploadImages(imageFiles)
  }
 
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }
 
  const canUpload = modelStatus === 'ready' && !processing
 
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <a
          href="/"
          className="inline-block text-sm font-mono text-[var(--color-accent)] hover:underline mb-8"
        >
          &larr; back to portfolio
        </a>
 
        <header className="mb-10">
          <h1 className="text-3xl font-semibold mb-3">Semantic Image Search</h1>
          <p className="text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
            Upload photos and search them with natural language. Everything runs in your browser &mdash;
            images and embeddings never leave your device.
          </p>
        </header>
 
        {modelStatus === 'loading' && (
          <div className="mb-6 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <p className="text-sm font-mono text-[var(--color-text-muted)]">
              Loading CLIP model (first visit only, ~150MB)...
            </p>
            {modelProgress && (
              <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1 truncate">
                {modelProgress}
              </p>
            )}
          </div>
        )}
 
        {modelStatus === 'error' && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/50 bg-[var(--color-surface)]">
            <p className="text-sm font-mono text-red-400">
              Failed to load model: {modelProgress}
            </p>
          </div>
        )}
 
        <div className="mb-6">
          <input
            type="text"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            placeholder="Search your images... (e.g. 'a pug in the grass')"
            disabled={modelStatus !== 'ready' || images.length === 0}
            className="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
          />
        </div>
 
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`mb-8 p-8 rounded-lg border-2 border-dashed transition-colors ${
            isDragging
              ? 'border-[var(--color-accent)] bg-[var(--color-surface)]'
              : 'border-[var(--color-border)]'
          } ${!canUpload ? 'opacity-50' : ''}`}
        >
          <label className="block text-center cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              disabled={!canUpload}
              className="hidden"
            />
            <p className="text-[var(--color-text-muted)] mb-2">
              {processing
                ? `Embedding ${processing.current + 1} of ${processing.total}...`
                : 'Drop images here or click to select'}
            </p>
            {!processing && canUpload && (
              <p className="text-xs font-mono text-[var(--color-text-muted)]">
                Multiple files supported. Nothing is uploaded to a server.
              </p>
            )}
          </label>
        </div>
 
        {images.length > 0 && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm font-mono text-[var(--color-text-muted)]">
              {images.length} image{images.length === 1 ? '' : 's'} in library
              {queryEmbedding && ' — sorted by relevance'}
            </p>
            <button
              onClick={() => {
                if (confirm('Delete all images from your library?')) clearAll()
              }}
              className="text-xs font-mono text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
            >
              clear all
            </button>
          </div>
        )}
 
        {isLoading ? (
          <p className="text-center text-[var(--color-text-muted)] py-12">Loading library...</p>
        ) : images.length === 0 ? (
          <p className="text-center text-[var(--color-text-muted)] py-12">
            No images yet. Upload a few to get started.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {displayImages.map((img) => {
              if (img.id == null) return null
              const url = urls.get(img.id)
              if (!url) return null
              return (
                <li
                  key={img.id}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]"
                >
                  <img
                    src={url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {img.score != null && (
                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-xs font-mono text-white">
                      {img.score.toFixed(3)}
                    </div>
                  )}
                  <button
                    onClick={() => removeImage(img.id!)}
                    className="absolute top-2 right-2 w-7 h-7 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                    aria-label="Delete image"
                  >
                    &times;
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}