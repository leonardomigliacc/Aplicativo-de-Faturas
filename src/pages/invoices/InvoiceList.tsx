import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import { Page, PageHeader, Card, Select, Badge, EmptyState, FAB } from '../../components/ui'
import { formatCurrency, formatDate, statusColor, statusLabel } from '../../lib/format'
import { computeInvoiceStatus, invoiceTotal } from '../../lib/calculations'
import type { InvoiceStatus } from '../../db/types'

export default function InvoiceList() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'todas'>('todas')

  const data = useLiveQuery(async () => {
    const [invoices, clients, payments] = await Promise.all([
      db.invoices.filter((i) => !i.deletedAt).toArray(),
      db.clients.toArray(),
      db.payments.toArray(),
    ])
    const clientById = new Map(clients.map((c) => [c.id, c]))
    const withStatus = invoices.map((inv) => {
      const status = computeInvoiceStatus(inv, payments)
      return { invoice: inv, status, client: clientById.get(inv.clientId) }
    })
    return withStatus.sort((a, b) => b.invoice.number - a.invoice.number)
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    if (statusFilter === 'todas') return data
    return data.filter((d) => d.status === statusFilter)
  }, [data, statusFilter])

  return (
    <>
      <PageHeader title="Faturas" />
      <Page>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'todas')} className="mb-4">
          <option value="todas">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="parcial">Parcial</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
          <option value="rascunho">Rascunho</option>
          <option value="cancelado">Cancelado</option>
        </Select>

        {data && filtered.length === 0 && <EmptyState title="Nenhuma fatura encontrada" subtitle='Toque em "Nova" para criar sua primeira fatura' />}

        <div className="space-y-2">
          {filtered.map(({ invoice, status, client }) => (
            <Link key={invoice.id} to={`/invoices/${invoice.id}`}>
              <Card className="flex items-center justify-between active:bg-slate-50">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    #{invoice.number} · {client?.name ?? 'Cliente removido'}
                  </p>
                  <p className="text-xs text-slate-400">Vencimento {formatDate(invoice.installments[0]?.dueDate ?? invoice.dueDate)}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="font-semibold text-slate-900">{formatCurrency(invoiceTotal(invoice))}</p>
                  <Badge className={statusColor(status)}>{statusLabel(status)}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Page>
      <FAB to="/invoices/new" label="Nova" />
    </>
  )
}
