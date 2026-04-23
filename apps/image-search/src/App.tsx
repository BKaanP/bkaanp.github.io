import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { embedText, loadClip, similarity } from './lib/clip'
import { useImages } from './lib/useImages'

type ModelStatus = 'loading' | 'ready' | 'error'

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

// ── App ───────────────────────────────────────────────────────────────────────

const SEED_IMAGES = [
  { url: 'https://picsum.photos/seed/mountain1/400/300', name: 'mountains.jpg' },
  { url: 'https://picsum.photos/seed/ocean1/400/300', name: 'ocean.jpg' },
  { url: 'https://picsum.photos/seed/city1/400/300', name: 'city.jpg' },
  { url: 'https://picsum.photos/seed/forest1/400/300', name: 'forest.jpg' },
  { url: 'https://picsum.photos/seed/animal1/400/300', name: 'animal.jpg' },
  { url: 'https://picsum.photos/seed/food1/400/300', name: 'food.jpg' },
  { url: 'https://picsum.photos/seed/building1/400/300', name: 'architecture.jpg' },
  { url: 'https://picsum.photos/seed/street1/400/300', name: 'street.jpg' },
]

export default function App() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading')
  const [modelProgress, setModelProgress] = useState('')
  const [query, setQuery] = useState('')
  const [queryEmbedding, setQueryEmbedding] = useState<Float32Array | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [urls, setUrls] = useState<Map<number, string>>(new Map())
  const hasSeeded = useRef(false)

  const { images, isLoading, processing, uploadImages, removeImage, clearAll } = useImages()

  useEffect(() => {
    loadClip((p) => {
      if (p.status === 'progress' && typeof p.progress === 'number' && p.file) {
        const name = p.file.split('/').pop() ?? p.file
        setModelProgress(`${name}: ${Math.round(p.progress)}%`)
      }
    })
      .then(() => { setModelStatus('ready'); setModelProgress('') })
      .catch((err) => { console.error(err); setModelStatus('error'); setModelProgress(String(err)) })
  }, [])

  useEffect(() => {
    if (modelStatus !== 'ready' || isLoading || hasSeeded.current) return
    hasSeeded.current = true
    if (images.length === 0) {
      Promise.all(
        SEED_IMAGES.map(async ({ url, name }) => {
          const resp = await fetch(url)
          const blob = await resp.blob()
          return new File([blob], name, { type: 'image/jpeg' })
        })
      ).then((files) => uploadImages(files)).catch(console.error)
    }
  }, [modelStatus, isLoading])

  useEffect(() => {
    if (!query.trim() || modelStatus !== 'ready') { setQueryEmbedding(null); return }
    const timer = setTimeout(async () => {
      try { setQueryEmbedding(await embedText(query)) } catch (err) { console.error(err) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, modelStatus])

  useEffect(() => {
    const next = new Map<number, string>()
    for (const img of images) {
      if (img.id != null) next.set(img.id, URL.createObjectURL(img.blob))
    }
    setUrls(next)
    return () => { next.forEach((url) => URL.revokeObjectURL(url)) }
  }, [images])

  const displayImages = useMemo(() => {
    if (!queryEmbedding) return images.map((img) => ({ ...img, score: null as number | null }))
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

  const statusColor =
    modelStatus === 'ready' ? 'oklch(72% 0.15 145)' :
    modelStatus === 'error' ? 'oklch(65% 0.18 25)'  :
    'oklch(72% 0.12 55)'

  const statusLabel =
    modelStatus === 'ready'   ? 'CLIP MODEL READY' :
    modelStatus === 'error'   ? 'MODEL ERROR'       :
    modelProgress             ? modelProgress        :
    'LOADING CLIP MODEL…'

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      <AppNav crumb="semantic-image-search" />
      <div style={{ maxWidth: 860, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppHeader
        title="Semantic Image Search"
        subtitle="Upload photos and search them with natural language. Everything runs in your browser — images and embeddings never leave your device."
      />

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Model status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: statusColor,
            boxShadow: modelStatus === 'ready' ? `0 0 6px ${statusColor}` : 'none',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: statusColor, letterSpacing: '0.06em' }}>
            {statusLabel}
          </span>
        </div>

        {/* Search bar */}
        <div style={{
          height: 40, borderRadius: 6, border: `1px solid var(--color-border)`,
          background: 'var(--color-surface)', display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 8,
          opacity: modelStatus !== 'ready' || images.length === 0 ? 0.4 : 1,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            placeholder="search your images…"
            disabled={modelStatus !== 'ready' || images.length === 0}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text)',
            }}
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `1px dashed ${isDragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: 6, padding: '18px', textAlign: 'center',
            opacity: canUpload ? 1 : 0.5,
            background: isDragging ? 'var(--color-surface)' : 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <label style={{ cursor: canUpload ? 'pointer' : 'not-allowed', display: 'block' }}>
            <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} disabled={!canUpload} style={{ display: 'none' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)' }}>
              {processing
                ? `embedding ${processing.current + 1} of ${processing.total}…`
                : 'drop images here or click to select'}
            </p>
            {!processing && canUpload && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', marginTop: 4 }}>nothing is uploaded to a server</p>
            )}
          </label>
        </div>

        {/* Library header */}
        {images.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionLabel>
              {images.length} image{images.length === 1 ? '' : 's'}
              {queryEmbedding ? ' — sorted by relevance' : ''}
            </SectionLabel>
            <button
              onClick={() => { if (confirm('Delete all images from your library?')) clearAll() }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              clear all
            </button>
          </div>
        )}

        {/* Image grid */}
        {isLoading ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', padding: '48px 0' }}>loading library…</p>
        ) : images.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-faint)', textAlign: 'center', padding: '48px 0' }}>no images yet — upload a few to get started</p>
        ) : (
          <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
            {displayImages.map((img) => {
              if (img.id == null) return null
              const url = urls.get(img.id)
              if (!url) return null
              return (
                <li key={img.id} style={{
                  position: 'relative', aspectRatio: '1', borderRadius: 5,
                  border: '1px solid var(--color-border)', overflow: 'hidden',
                  background: 'var(--color-surface)',
                }}>
                  <img src={url} alt={img.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {img.score != null && (
                    <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.65)', borderRadius: 3, padding: '2px 5px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text)' }}>{img.score.toFixed(3)}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeImage(img.id!)}
                    aria-label="Delete image"
                    className="group-hover:opacity-100"
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 22, height: 22, borderRadius: 4,
                      background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text)', fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      </div>
    </div>
  )
}
