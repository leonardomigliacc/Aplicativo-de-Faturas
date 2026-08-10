import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db/db'
import { Page, PageHeader, Card, Button, Badge, EmptyState } from '../../components/ui'
import { formatCurrency, formatDate, statusColor, statusLabel } from '../../lib/format'
import { invoiceTotal } from '../../lib/calculations'

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const client = useLiveQuery(() => (id ? db.clients.get(id) : undefined), [id])
  const invoices = useLiveQuery(async () => {
    if (!id) return []
    const all = await db.invoices.where('clientId').equals(id).and((i) => !i.deletedAt).toArray()
    return all.sort((a, b) => b.number - a.number)
  }, [id])

  const totals = useLiveQuery(async () => {
    if (!invoices) return null
    const payments = await db.payments.toArray()
    const received = payments
      .filter((p) => invoices.some((i) => i.id === p.invoiceId))
      .reduce((sum, p) => sum + p.amount, 0)
    const billed = invoices.reduce((sum, inv) => sum + invoiceTotal(inv), 0)
    return { received, billed, pending: billed - received }
  }, [invoices])

  if (!client) return null

  async function handleDelete() {
    if (!id) return
    if (!confirm(`Excluir o cliente "${client!.name}"? Os orçamentos associados não serão apagados.`)) return
    await db.clients.update(id, { deletedAt: new Date().toISOString() })
    navigate('/clients')
  }

  return (
    <>
      <PageHeader title={client.name} back="/clients" />
      <Page>
        <Card className="mb-4">
          <div className="space-y-1.5 text-sm">
            {client.document && <Row label="Documento" value={client.document} />}
            {client.email && <Row label="E-mail" value={client.email} />}
            {client.phone && <Row label="Telefone" value={client.phone} />}
            {client.address && <Row label="Endereço" value={client.address} />}
            {client.notes && <Row label="Observações" value={client.notes} />}
          </div>
          <div className="flex gap-2 mt-4">
            <Link to={`/clients/${id}/edit`} className="flex-1">
              <Button variant="secondary" full>Editar</Button>
            </Link>
            <Button variant="danger" onClick={handleDelete}>Excluir</Button>
          </div>
        </Card>

        {totals && (
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <Card className="p-3">
              <p className="text-xs text-slate-400">Recebido</p>
              <p className="text-sm font-semibold text-green-600">{formatCurrency(totals.received)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-slate-400">Pendente</p>
              <p className="text-sm font-semibold text-amber-600">{formatCurrency(Math.max(totals.pending, 0))}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-slate-400">Orçado</p>
              <p className="text-sm font-semibold text-slate-700">{formatCurrency(totals.billed)}</p>
            </Card>
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-500">Orçamentos</h2>
          <Link to="/invoices/new" state={{ clientId: id }} className="text-sm text-blue-600 font-medium">
            + Novo orçamento
          </Link>
        </div>

        {invoices && invoices.length === 0 && <EmptyState title="Nenhum orçamento para este cliente" />}

        <div className="space-y-2">
          {invoices?.map((inv) => (
            <Link key={inv.id} to={`/invoices/${inv.id}`}>
              <Card className="flex items-center justify-between active:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">Orçamento #{inv.number}</p>
                  <p className="text-xs text-slate-400">Vencimento {formatDate(inv.dueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatCurrency(invoiceTotal(inv))}</p>
                  <Badge className={statusColor(inv.status)}>{statusLabel(inv.status)}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Page>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-700 text-right">{value}</span>
    </div>
  )
}
