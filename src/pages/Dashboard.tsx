import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { Page, Card, Badge, EmptyState } from '../components/ui'
import { formatCurrency, formatDate, statusColor, statusLabel } from '../lib/format'
import { computeInvoiceStatus, getInstallmentPaymentInfo, invoiceTotal } from '../lib/calculations'

export default function Dashboard() {
  const company = useLiveQuery(() => db.company.get('company'), [])

  const data = useLiveQuery(async () => {
    const [invoices, payments, clients] = await Promise.all([
      db.invoices.filter((i) => !i.deletedAt).toArray(),
      db.payments.toArray(),
      db.clients.toArray(),
    ])
    const clientById = new Map(clients.map((c) => [c.id, c]))

    let received = 0
    let pending = 0
    let overdue = 0
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    let receivedThisMonth = 0

    for (const inv of invoices) {
      if (inv.status === 'cancelado') continue
      for (const inst of inv.installments) {
        const info = getInstallmentPaymentInfo(inst, payments)
        if (info.isPaid) continue
        if (info.isOverdue) overdue += info.remaining
        else pending += info.remaining
      }
    }
    for (const p of payments) {
      received += p.amount
      if (p.date >= startOfMonth) receivedThisMonth += p.amount
    }

    const recent = invoices
      .filter((i) => i.status !== 'cancelado')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((inv) => ({ invoice: inv, status: computeInvoiceStatus(inv, payments), client: clientById.get(inv.clientId) }))

    return { received, receivedThisMonth, pending, overdue, recent, hasAny: invoices.length > 0 }
  }, [])

  return (
    <>
      <header className="px-4 pt-5 pb-2 safe-top">
        <p className="text-sm text-slate-400">Olá,</p>
        <h1 className="text-xl font-bold text-slate-900">{company?.name || 'Bem-vindo'}</h1>
      </header>
      <Page>
        {!data ? null : !data.hasAny ? (
          <EmptyState
            title="Nenhuma fatura ainda"
            subtitle="Cadastre um cliente e crie sua primeira fatura para ver o resumo financeiro aqui."
          />
        ) : (
          <>
            <Card className="mb-4 bg-blue-600 text-white border-blue-600">
              <p className="text-xs text-blue-100">Recebido este mês</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(data.receivedThisMonth)}</p>
              <p className="text-xs text-blue-100 mt-1">Total recebido: {formatCurrency(data.received)}</p>
            </Card>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Card>
                <p className="text-xs text-slate-400">A receber</p>
                <p className="text-xl font-semibold text-amber-600 mt-1">{formatCurrency(data.pending)}</p>
              </Card>
              <Card>
                <p className="text-xs text-slate-400">Atrasado</p>
                <p className="text-xl font-semibold text-red-600 mt-1">{formatCurrency(data.overdue)}</p>
              </Card>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-500">Faturas recentes</h2>
              <Link to="/invoices" className="text-sm text-blue-600 font-medium">
                Ver todas
              </Link>
            </div>
            <div className="space-y-2">
              {data.recent.map(({ invoice, status, client }) => (
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
          </>
        )}

        <div className="grid grid-cols-2 gap-3 mt-6">
          <Link to="/clients/new">
            <Card className="text-center active:bg-slate-50">
              <p className="text-sm font-semibold text-slate-700">+ Novo cliente</p>
            </Card>
          </Link>
          <Link to="/invoices/new">
            <Card className="text-center active:bg-slate-50">
              <p className="text-sm font-semibold text-slate-700">+ Nova fatura</p>
            </Card>
          </Link>
        </div>
      </Page>
    </>
  )
}
