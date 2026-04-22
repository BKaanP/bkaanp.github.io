import { crmDb, type Contact, type Interaction } from './db'

/**
 * Seed the CRM with a realistic-looking dataset the first time the app runs.
 *
 * Race-safe: wraps check-and-insert in a single Dexie transaction so that
 * concurrent invocations (e.g. React StrictMode double-firing useEffect,
 * or hot reload) cannot both pass the "empty?" check. One wins, the rest
 * see the populated DB and return immediately.
 */
export async function seedCrmIfEmpty(): Promise<void> {
  await crmDb.transaction('rw', crmDb.contacts, crmDb.interactions, async () => {
    const count = await crmDb.contacts.count()
    if (count > 0) return

    const now = Date.now()
    const day = 86_400_000

    const contacts: Omit<Contact, 'id'>[] = [
      {
        name: 'Anna Weber',
        company: 'Müller Maschinenbau GmbH',
        email: 'a.weber@mueller-mb.de',
        phone: '+49 30 1234567',
        tags: ['lead', 'enterprise', 'manufacturing'],
        createdAt: new Date(now - 45 * day),
      },
      {
        name: 'Tobias Becker',
        company: 'Richter Logistik AG',
        email: 't.becker@richter-log.com',
        phone: '+49 40 9876543',
        tags: ['customer', 'logistics'],
        createdAt: new Date(now - 120 * day),
      },
      {
        name: 'Dr. Miriam Schulz',
        company: 'Schulz Chemie',
        email: 'miriam@schulz-chemie.de',
        phone: null,
        tags: ['lead', 'chemistry', 'decision-maker'],
        createdAt: new Date(now - 12 * day),
      },
      {
        name: 'Kai Lorenz',
        company: 'Lorenz Fahrzeugbau',
        email: 'kai.lorenz@lfb-gmbh.de',
        phone: '+49 711 4455667',
        tags: ['customer', 'automotive', 'renewal-due'],
        createdAt: new Date(now - 400 * day),
      },
      {
        name: 'Sandra Baumann',
        company: 'Baumann & Partner Consulting',
        email: 's.baumann@bpc.de',
        phone: '+49 89 3344556',
        tags: ['partner', 'consulting'],
        createdAt: new Date(now - 200 * day),
      },
      {
        name: 'Henrik Jensen',
        company: 'NordTech Solutions',
        email: 'h.jensen@nordtech.dk',
        phone: null,
        tags: ['lead', 'international', 'manufacturing'],
        createdAt: new Date(now - 8 * day),
      },
      {
        name: 'Carolin Fischer',
        company: 'Fischer Werkzeugbau',
        email: 'fischer@fwb.de',
        phone: '+49 2151 778899',
        tags: ['customer', 'manufacturing', 'vip'],
        createdAt: new Date(now - 600 * day),
      },
      {
        name: 'Paul Ostermann',
        company: null,
        email: 'paul@ostermann-it.de',
        phone: '+49 176 12345678',
        tags: ['freelancer', 'it'],
        createdAt: new Date(now - 30 * day),
      },
    ]

    const contactIds = await crmDb.contacts.bulkAdd(contacts, { allKeys: true })

    const interactions: Omit<Interaction, 'id'>[] = [
      {
        contactId: contactIds[0] as number,
        kind: 'email',
        summary: 'Sent initial proposal for ERP integration project',
        occurredAt: new Date(now - 40 * day),
      },
      {
        contactId: contactIds[0] as number,
        kind: 'call',
        summary: 'Discovery call about pain points in their production planning',
        occurredAt: new Date(now - 35 * day),
      },
      {
        contactId: contactIds[0] as number,
        kind: 'meeting',
        summary: 'On-site demo scheduled for next month',
        occurredAt: new Date(now - 3 * day),
      },
      {
        contactId: contactIds[1] as number,
        kind: 'meeting',
        summary: 'Quarterly business review, contract renewal discussed',
        occurredAt: new Date(now - 18 * day),
      },
      {
        contactId: contactIds[1] as number,
        kind: 'email',
        summary: 'Sent renewal contract for 2026',
        occurredAt: new Date(now - 5 * day),
      },
      {
        contactId: contactIds[2] as number,
        kind: 'note',
        summary: 'Referred by Anna Weber — interested in same integration',
        occurredAt: new Date(now - 10 * day),
      },
      {
        contactId: contactIds[3] as number,
        kind: 'call',
        summary: 'Renewal conversation — budget approved, waiting on legal',
        occurredAt: new Date(now - 7 * day),
      },
      {
        contactId: contactIds[5] as number,
        kind: 'email',
        summary: 'Cold outreach via LinkedIn connection',
        occurredAt: new Date(now - 6 * day),
      },
      {
        contactId: contactIds[6] as number,
        kind: 'meeting',
        summary: 'Annual strategy workshop with leadership team',
        occurredAt: new Date(now - 90 * day),
      },
      {
        contactId: contactIds[7] as number,
        kind: 'call',
        summary: 'Scoping conversation for consulting engagement',
        occurredAt: new Date(now - 20 * day),
      },
    ]

    await crmDb.interactions.bulkAdd(interactions)
  })
}

/**
 * Nuke everything and re-seed. Useful during development and also exposed
 * in the UI as a "reset demo data" button.
 */
export async function resetCrm(): Promise<void> {
  await crmDb.transaction('rw', crmDb.contacts, crmDb.interactions, async () => {
    await crmDb.contacts.clear()
    await crmDb.interactions.clear()
  })
  await seedCrmIfEmpty()
}