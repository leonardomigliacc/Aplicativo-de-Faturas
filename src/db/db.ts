import Dexie, { type Table } from 'dexie'
import type { Client, Invoice, Payment, CompanyProfile, SyncSettings, ServiceType } from './types'

export class AppDatabase extends Dexie {
  clients!: Table<Client, string>
  invoices!: Table<Invoice, string>
  payments!: Table<Payment, string>
  company!: Table<CompanyProfile, string>
  syncSettings!: Table<SyncSettings, string>
  serviceTypes!: Table<ServiceType, string>

  constructor() {
    super('faturas-db')
    this.version(1).stores({
      clients: 'id, name, document, deletedAt, updatedAt',
      invoices: 'id, number, clientId, status, dueDate, deletedAt, updatedAt',
      payments: 'id, invoiceId, installmentId, date',
      company: 'id',
      syncSettings: 'id',
    })
    this.version(2).stores({
      clients: 'id, name, document, deletedAt, updatedAt',
      invoices: 'id, number, clientId, status, dueDate, deletedAt, updatedAt',
      payments: 'id, invoiceId, installmentId, date',
      company: 'id',
      syncSettings: 'id',
      serviceTypes: 'id, description',
    })
  }
}

export const db = new AppDatabase()

export async function ensureCompanyProfile(): Promise<CompanyProfile> {
  const existing = await db.company.get('company')
  if (existing) return existing
  const fresh: CompanyProfile = {
    id: 'company',
    name: '',
    nextInvoiceNumber: 1,
    updatedAt: new Date().toISOString(),
  }
  await db.company.put(fresh)
  return fresh
}

export async function ensureSyncSettings(): Promise<SyncSettings> {
  const existing = await db.syncSettings.get('sync')
  if (existing) return existing
  const fresh: SyncSettings = { id: 'sync', enabled: false }
  await db.syncSettings.put(fresh)
  return fresh
}
