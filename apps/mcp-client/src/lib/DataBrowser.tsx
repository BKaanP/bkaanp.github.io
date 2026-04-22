import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { crmDb, type Contact, type Interaction } from './crm/db'
import { resetCrm } from './crm/seed'
import { InfoTooltip } from './InfoTooltip'

type Tab = 'contacts' | 'interactions'

/**
 * Live-updating view of the CRM database. Uses dexie-react-hooks' useLiveQuery
 * so any write from anywhere (a tool call from Claude, the reset button, etc.)
 * automatically refreshes this panel without prop drilling.
 */
export function DataBrowser() {
  const [tab, setTab] = useState<Tab>('contacts')
  const [isResetting, setIsResetting] = useState(false)

  const contacts = useLiveQuery(() => crmDb.contacts.orderBy('id').toArray(), []) ?? []
  const interactions =
    useLiveQuery(() => crmDb.interactions.orderBy('occurredAt').reverse().toArray(), []) ?? []

  async function handleReset() {
    if (!confirm('Reset the CRM to initial seed data? Any contacts or interactions you added will be lost.')) return
    setIsResetting(true)
    try {
      await resetCrm()
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <section className="mb-6 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
            data browser
          </p>
          <InfoTooltip>
            <strong>What's in the database.</strong> The CRM server stores data in the browser's
            IndexedDB. This panel shows the raw records so you can verify what tools return
            against what's actually stored. When Claude calls a tool, watch how the result in
            the agent loop matches the rows here.
          </InfoTooltip>
        </div>
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="text-xs font-mono text-[var(--color-text-muted)] hover:text-red-400 disabled:opacity-50 transition-colors"
        >
          {isResetting ? 'resetting...' : 'reset to seed'}
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <TabButton active={tab === 'contacts'} onClick={() => setTab('contacts')}>
          contacts ({contacts.length})
        </TabButton>
        <TabButton active={tab === 'interactions'} onClick={() => setTab('interactions')}>
          interactions ({interactions.length})
        </TabButton>
      </div>

      <div className="max-h-64 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
        {tab === 'contacts' ? (
          <ContactsTable contacts={contacts} />
        ) : (
          <InteractionsTable interactions={interactions} contacts={contacts} />
        )}
      </div>
    </section>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors ${
        active
          ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      }`}
    >
      {children}
    </button>
  )
}

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return <p className="p-4 text-xs text-[var(--color-text-muted)] text-center">No contacts.</p>
  }
  return (
    <table className="w-full text-xs font-mono">
      <thead className="sticky top-0 bg-[var(--color-surface)]">
        <tr className="text-left text-[var(--color-text-muted)]">
          <th className="px-3 py-2 w-10">id</th>
          <th className="px-3 py-2">name</th>
          <th className="px-3 py-2">company</th>
          <th className="px-3 py-2">tags</th>
        </tr>
      </thead>
      <tbody>
        {contacts.map((c) => (
          <tr key={c.id} className="border-t border-[var(--color-border)]">
            <td className="px-3 py-2 text-[var(--color-accent)]">#{c.id}</td>
            <td className="px-3 py-2">{c.name}</td>
            <td className="px-3 py-2 text-[var(--color-text-muted)]">{c.company ?? '—'}</td>
            <td className="px-3 py-2 text-[var(--color-text-muted)]">
              {c.tags.length > 0 ? c.tags.join(', ') : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function InteractionsTable({
  interactions,
  contacts,
}: {
  interactions: Interaction[]
  contacts: Contact[]
}) {
  const contactById = new Map(contacts.map((c) => [c.id!, c]))

  if (interactions.length === 0) {
    return <p className="p-4 text-xs text-[var(--color-text-muted)] text-center">No interactions.</p>
  }
  return (
    <table className="w-full text-xs font-mono">
      <thead className="sticky top-0 bg-[var(--color-surface)]">
        <tr className="text-left text-[var(--color-text-muted)]">
          <th className="px-3 py-2 w-20">date</th>
          <th className="px-3 py-2 w-16">kind</th>
          <th className="px-3 py-2">contact</th>
          <th className="px-3 py-2">summary</th>
        </tr>
      </thead>
      <tbody>
        {interactions.map((i) => {
          const c = contactById.get(i.contactId)
          return (
            <tr key={i.id} className="border-t border-[var(--color-border)]">
              <td className="px-3 py-2 text-[var(--color-text-muted)]">
                {i.occurredAt.toISOString().slice(0, 10)}
              </td>
              <td className="px-3 py-2">{i.kind}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">
                {c ? `#${c.id} ${c.name}` : `#${i.contactId}`}
              </td>
              <td className="px-3 py-2">{i.summary}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}