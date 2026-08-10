import { db } from '../db/db'
import type { Client, CompanyProfile, Invoice, Payment } from '../db/types'

interface BackupFile {
  version: 1
  exportedAt: string
  clients: Client[]
  invoices: Invoice[]
  payments: Payment[]
  company: CompanyProfile[]
}

export async function exportBackup(): Promise<void> {
  const [clients, invoices, payments, company] = await Promise.all([
    db.clients.toArray(),
    db.invoices.toArray(),
    db.payments.toArray(),
    db.company.toArray(),
  ])
  const backup: BackupFile = { version: 1, exportedAt: new Date().toISOString(), clients, invoices, payments, company }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `backup-faturas-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<{ clients: number; invoices: number; payments: number }> {
  const text = await file.text()
  const data = JSON.parse(text) as BackupFile
  if (!data || data.version !== 1) throw new Error('Arquivo de backup inválido')

  await db.transaction('rw', db.clients, db.invoices, db.payments, db.company, async () => {
    if (data.clients?.length) await db.clients.bulkPut(data.clients)
    if (data.invoices?.length) await db.invoices.bulkPut(data.invoices)
    if (data.payments?.length) await db.payments.bulkPut(data.payments)
    if (data.company?.length) await db.company.bulkPut(data.company)
  })

  return { clients: data.clients?.length ?? 0, invoices: data.invoices?.length ?? 0, payments: data.payments?.length ?? 0 }
}
