import { useState, type ReactNode } from 'react'

export function InfoTooltip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <style>{`
        @keyframes info-breathe {
          0%, 100% { color: var(--color-text-faint); border-color: var(--color-border); box-shadow: none; }
          50%       { color: oklch(84% 0.17 88); border-color: oklch(84% 0.17 88); box-shadow: 0 0 7px oklch(84% 0.17 88 / 55%); }
        }
      `}</style>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v) }}
        aria-label="Show info"
        style={{ animation: open ? 'none' : 'info-breathe 2.8s ease-in-out infinite' }}
        className="w-4 h-4 rounded-full border text-[10px] font-mono hover:text-accent hover:border-accent flex items-center justify-center leading-none"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-80 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-normal leading-relaxed text-[var(--color-text)] shadow-lg z-30 whitespace-normal normal-case tracking-normal"
        >
          {children}
        </span>
      )}
    </span>
  )
}
