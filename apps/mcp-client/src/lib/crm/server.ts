import { McpServer } from '../mcp/server'
import type { CallToolResult } from '../mcp/types'
import { crmDb, type Contact, type Interaction, type InteractionKind } from './db'

/**
 * CRM MCP server. Exposes five tools for contact management and interaction
 * logging. Backed by Dexie (IndexedDB) so data persists across reloads.
 *
 * Each tool:
 *   - Has a JSON schema (required for the LLM to know how to call it)
 *   - Has a handler that runs async and returns MCP-format content
 *   - Returns errors as tool errors (isError: true), not JSON-RPC errors,
 *     so the LLM can reason about failures without the protocol blowing up
 */
export function createCrmServer(): McpServer {
  const server = new McpServer({ name: 'crm', version: '0.1.0' })

  server.addTool(
    {
      name: 'find_contacts',
      description:
        'Search contacts by free-text match against name, company, or tags. Returns up to 10 contacts. Use this when the user refers to people or companies by partial or fuzzy name.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free-text query matched case-insensitively against name, company, and tags.',
          },
        },
        required: ['query'],
      },
    },
    async ({ query }) => {
      const q = String(query ?? '').toLowerCase().trim()
      if (!q) return asText('Empty query. Please provide a search term.')

      const all = await crmDb.contacts.toArray()
      const matches = all
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.company?.toLowerCase().includes(q) ?? false) ||
            c.tags.some((t) => t.toLowerCase().includes(q)),
        )
        .slice(0, 10)

      if (matches.length === 0) return asText(`No contacts found matching "${query}".`)
      return asText(formatContactList(matches))
    },
  )

  server.addTool(
    {
      name: 'get_contact',
      description:
        'Fetch full details and recent interactions for a single contact by ID. Use after find_contacts when more detail is needed.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Numeric contact ID from find_contacts.' },
        },
        required: ['id'],
      },
    },
    async ({ id }) => {
      const contactId = Number(id)
      if (!Number.isFinite(contactId)) throw new Error('Invalid contact id')

      const contact = await crmDb.contacts.get(contactId)
      if (!contact) return asText(`No contact with id ${contactId}.`)

      const interactions = await crmDb.interactions
        .where('contactId')
        .equals(contactId)
        .reverse()
        .sortBy('occurredAt')

      return asText(formatContactDetail(contact, interactions.slice(0, 10)))
    },
  )

  server.addTool(
    {
      name: 'create_contact',
      description:
        'Create a new contact in the CRM. Only name is required. Returns the new contact ID.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name of the contact.' },
          company: { type: 'string', description: 'Company or organization.' },
          email: { type: 'string', description: 'Email address.' },
          phone: { type: 'string', description: 'Phone number.' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags like "lead", "customer", "vip".',
          },
        },
        required: ['name'],
      },
    },
    async (args) => {
      const name = String(args.name ?? '').trim()
      if (!name) throw new Error('Name is required')

      const contact: Omit<Contact, 'id'> = {
        name,
        company: args.company ? String(args.company) : null,
        email: args.email ? String(args.email) : null,
        phone: args.phone ? String(args.phone) : null,
        tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
        createdAt: new Date(),
      }

      const id = await crmDb.contacts.add(contact)
      return asText(`Created contact #${id}: ${name}${contact.company ? ` (${contact.company})` : ''}.`)
    },
  )

  server.addTool(
    {
      name: 'log_interaction',
      description:
        'Log an interaction (call, meeting, email, note) for an existing contact.',
      inputSchema: {
        type: 'object',
        properties: {
          contactId: { type: 'number', description: 'ID of the contact this interaction belongs to.' },
          kind: {
            type: 'string',
            enum: ['call', 'meeting', 'email', 'note'],
            description: 'Type of interaction.',
          },
          summary: { type: 'string', description: 'Short summary of what happened.' },
        },
        required: ['contactId', 'kind', 'summary'],
      },
    },
    async ({ contactId, kind, summary }) => {
      const id = Number(contactId)
      const contact = await crmDb.contacts.get(id)
      if (!contact) throw new Error(`Contact ${id} not found`)

      const interaction: Omit<Interaction, 'id'> = {
        contactId: id,
        kind: String(kind) as InteractionKind,
        summary: String(summary),
        occurredAt: new Date(),
      }

      const interactionId = await crmDb.interactions.add(interaction)
      return asText(
        `Logged ${interaction.kind} for ${contact.name}: "${interaction.summary}" (id #${interactionId}).`,
      )
    },
  )

  server.addTool(
    {
      name: 'list_recent_interactions',
      description:
        'List the most recent interactions across all contacts. Useful for daily/weekly summaries.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'How many to return. Default 10, max 50.' },
        },
      },
    },
    async ({ limit }) => {
      const n = Math.min(Math.max(Number(limit) || 10, 1), 50)
      const interactions = await crmDb.interactions.orderBy('occurredAt').reverse().limit(n).toArray()
      if (interactions.length === 0) return asText('No interactions logged yet.')

      const contactIds = [...new Set(interactions.map((i) => i.contactId))]
      const contacts = await crmDb.contacts.bulkGet(contactIds)
      const contactById = new Map<number, Contact>()
      for (const c of contacts) {
        if (c?.id != null) contactById.set(c.id, c)
      }

      return asText(formatInteractionList(interactions, contactById))
    },
  )

  return server
}

// ---------- formatting helpers ----------

function asText(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

function formatContactList(contacts: Contact[]): string {
  return contacts
    .map((c) => {
      const tags = c.tags.length > 0 ? ` [${c.tags.join(', ')}]` : ''
      const company = c.company ? ` — ${c.company}` : ''
      return `#${c.id} ${c.name}${company}${tags}`
    })
    .join('\n')
}

function formatContactDetail(contact: Contact, interactions: Interaction[]): string {
  const lines: string[] = []
  lines.push(`#${contact.id} ${contact.name}`)
  if (contact.company) lines.push(`Company: ${contact.company}`)
  if (contact.email) lines.push(`Email: ${contact.email}`)
  if (contact.phone) lines.push(`Phone: ${contact.phone}`)
  if (contact.tags.length > 0) lines.push(`Tags: ${contact.tags.join(', ')}`)
  lines.push('')

  if (interactions.length === 0) {
    lines.push('No interactions logged.')
  } else {
    lines.push(`Recent interactions (${interactions.length}):`)
    for (const i of interactions) {
      const when = i.occurredAt.toISOString().slice(0, 10)
      lines.push(`  [${when}] ${i.kind}: ${i.summary}`)
    }
  }

  return lines.join('\n')
}

function formatInteractionList(
  interactions: Interaction[],
  contactById: Map<number, Contact>,
): string {
  return interactions
    .map((i) => {
      const when = i.occurredAt.toISOString().slice(0, 10)
      const contact = contactById.get(i.contactId)
      const who = contact ? contact.name : `contact #${i.contactId}`
      return `[${when}] ${i.kind} with ${who}: ${i.summary}`
    })
    .join('\n')
}