import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import { Page, PageHeader, Card, Select, Input, Badge, EmptyState, FAB } from '../../components/ui'
import { formatCurrency, formatDate, statusColor, statusLabel } from '../../lib/format'
import { computeInvoiceStatus, invoiceTotal } from '../../lib/calculations'
import type { InvoiceStatus } from '../../db/types'

export default function InvoiceList() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'todas'>('todas')
  const [clientFilter, setClientFilter] = useState<string>('todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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

  const clientOptions = useMemo(() => {
    if (!data) return []
    const seen = new Map<string, string>()
    for (const { client } of data) {
      if (client && !seen.has(client.id)) seen.set(client.id, client.name)
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.filter(({ invoice, status }) => {
      if (statusFilter !== 'todas' && status !== statusFilter) return false
      if (clientFilter !== 'todos' && invoice.clientId !== clientFilter) return false
      if (dateFrom && invoice.issueDate < dateFrom) return false
      if (dateTo && invoice.issueDate > dateTo) return false
      return true
    })
  }, [data, statusFilter, clientFilter, dateFrom, dateTo])

  const hasActiveFilters = statusFilter !== 'todas' || clientFilter !== 'todos' || dateFrom || dateTo

  function clearFilters() {
    setStatusFilter('todas')
    setClientFilter('todos')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <>
      <PageHeader title="Orçamentos" />
      <Page>
        <Card className="mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'todas')}>
              <option value="todas">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="parcial">Parcial</option>
              <option value="pago">Pago</option>
              <option value="atrasado">Atrasado</option>
              <option value="rascunho">Rascunho</option>
              <option value="cancelado">Cancelado</option>
            </Select>
            <Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="todos">Todos os clientes</option>
              {clientOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">Emitido de</span>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">até</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-xs text-blue-600 font-medium">
              Limpar filtros
            </button>
          )}
        </Card>

        {data && filtered.length === 0 && (
          <EmptyState
            title="Nenhum orçamento encontrado"
            subtitle={hasActiveFilters ? 'Tente ajustar os filtros' : 'Toque em "Nova" para criar seu primeiro orçamento'}
          />
        )}

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
