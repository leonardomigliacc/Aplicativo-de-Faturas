import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { Page, Card, Badge, EmptyState } from '../components/ui'
import { approvalStatusColor, approvalStatusLabel, formatCurrency, formatDate, statusColor, statusLabel } from '../lib/format'
import { computeInvoiceStatus, getInstallmentPaymentInfo, invoiceRemaining, invoiceTotal } from '../lib/calculations'

const currentMonthKey = new Date().toISOString().slice(0, 7)

function monthLabel(monthKey: string): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${monthKey}-01T12:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function Dashboard() {
  const [period, setPeriod] = useState<string>(currentMonthKey)
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
    const receivedByMonth: Record<string, number> = {}

    for (const inv of invoices) {
      if (inv.status === 'cancelado') continue
      for (const inst of inv.installments) {
        const info = getInstallmentPaymentInfo(inst, payments)
        if (info.isPaid) continue
        pending += info.remaining
      }
    }
    for (const p of payments) {
      received += p.amount
      const monthKey = p.date.slice(0, 7)
      receivedByMonth[monthKey] = (receivedByMonth[monthKey] ?? 0) + p.amount
    }
    const activeInvoices = invoices.filter((invoice) => invoice.status !== 'cancelado')
    const approvalCounts = {
      total: activeInvoices.length,
      approved: activeInvoices.filter((invoice) => invoice.approvalStatus === 'aprovado').length,
      refused: activeInvoices.filter((invoice) => invoice.approvalStatus === 'recusado').length,
    }

    const recent = invoices
      .filter((i) => i.status !== 'cancelado')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((inv) => ({
        invoice: inv,
        status: computeInvoiceStatus(inv, payments),
        approvalStatus: inv.approvalStatus ?? 'pendente',
        remaining: Math.max(invoiceRemaining(inv, payments), 0),
        client: clientById.get(inv.clientId),
      }))

    return { received, receivedByMonth, approvalCounts, pending, recent, hasAny: invoices.length > 0 }
  }, [])

  const selectedReceived = data && period === 'all' ? data.received : data?.receivedByMonth[period] ?? 0
  const selectedPeriodLabel = period === 'all' ? 'Recebido no histórico' : period === currentMonthKey ? 'Recebido este mês' : `Recebido em ${monthLabel(period)}`

  return (
    <>
      <header className="px-4 pt-5 pb-2 safe-top">
        <p className="text-sm text-slate-400">Olá,</p>
        <h1 className="text-xl font-bold text-slate-900">{company?.name || 'Bem-vindo'}</h1>
      </header>
      <Page>
        {!data ? null : !data.hasAny ? (
          <EmptyState
            title="Nenhum orçamento ainda"
            subtitle="Cadastre um cliente e crie seu primeiro orçamento para ver o resumo financeiro aqui."
          />
        ) : (
          <>
            <Card className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-500">{selectedPeriodLabel}</p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="month"
                    value={period === 'all' ? currentMonthKey : period}
                    onChange={(e) => setPeriod(e.target.value || currentMonthKey)}
                    disabled={period === 'all'}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    aria-label="Escolher mês e ano"
                  />
                  <select
                    value={period === 'all' ? 'all' : 'month'}
                    onChange={(e) => setPeriod(e.target.value === 'all' ? 'all' : currentMonthKey)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none"
                    aria-label="Tipo de período"
                  >
                    <option value="month">Mês</option>
                    <option value="all">Histórico</option>
                  </select>
                </div>
              </div>
              <p className="text-3xl font-bold mt-1 text-slate-900">{formatCurrency(selectedReceived)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {period === 'all' ? 'Total acumulado: ' : 'Total recebido no histórico: '}
                <span className="font-semibold text-slate-900">{formatCurrency(data.received)}</span>
              </p>
            </Card>

            <div className="mb-4">
              <Card>
                <p className="text-xs text-slate-400">A receber</p>
                <p className="text-xl font-semibold text-amber-600 mt-1">{formatCurrency(data.pending)}</p>
              </Card>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <Card className="p-3">
                <p className="text-[11px] text-slate-400">Orçamentos</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data.approvalCounts.total}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">total</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] text-slate-400">Aprovados</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{data.approvalCounts.approved}</p>
                <p className="text-[11px] text-emerald-600/70 mt-0.5">fechados</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] text-slate-400">Recusados</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">{data.approvalCounts.refused}</p>
                <p className="text-[11px] text-rose-600/70 mt-0.5">perdidos</p>
              </Card>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-500">Orçamentos recentes</h2>
              <Link to="/invoices" className="text-sm text-blue-600 font-medium">
                Ver todas
              </Link>
            </div>
            <div className="space-y-2">
              {data.recent.map(({ invoice, status, approvalStatus, remaining, client }) => (
                <Link key={invoice.id} to={`/invoices/${invoice.id}`}>
                  <Card className="flex items-center justify-between active:bg-slate-50">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        #{invoice.number} · {client?.name ?? 'Cliente removido'}
                      </p>
                      <p className="text-xs text-slate-400">Feito em {formatDate(invoice.issueDate || invoice.createdAt)}</p>
                      <p className="text-xs text-amber-600">Saldo restante {formatCurrency(remaining)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-semibold text-slate-900">{formatCurrency(invoiceTotal(invoice))}</p>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Badge className={statusColor(status)}>{statusLabel(status)}</Badge>
                        <Badge className={approvalStatusColor(approvalStatus)}>{approvalStatusLabel(approvalStatus)}</Badge>
                      </div>
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
              <p className="text-sm font-semibold text-slate-700">+ Novo orçamento</p>
            </Card>
          </Link>
        </div>
      </Page>
    </>
  )
}
