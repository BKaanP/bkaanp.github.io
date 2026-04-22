import Dexie, { type Table } from 'dexie'

export type InteractionKind = 'call' | 'meeting' | 'email' | 'note'

export interface Contact {
  id?: number
  name: string
  company: string | null
  email: string | null
  phone: string | null
  tags: string[]
  createdAt: Date
}

export interface Interaction {
  id?: number
  contactId: number
  kind: InteractionKind
  summary: string
  occurredAt: Date
}

class CrmDB extends Dexie {
  contacts!: Table<Contact, number>
  interactions!: Table<Interaction, number>

  constructor() {
    super('mcp-crm')
    this.version(1).stores({
      contacts: '++id, name, company, createdAt, *tags',
      interactions: '++id, contactId, occurredAt',
    })
  }
}

export const crmDb = new CrmDB()