import { useState, type ReactNode } from 'react'
 
export function InfoTooltip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
 
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault()
          setOpen((v) => !v)
        }}
        aria-label="Show info"
        className="w-4 h-4 rounded-full border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors flex items-center justify-center leading-none"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-72 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-normal leading-relaxed text-[var(--color-text)] shadow-lg z-30 whitespace-normal normal-case tracking-normal"
        >
          {children}
        </span>
      )}
    </span>
  )
}
 