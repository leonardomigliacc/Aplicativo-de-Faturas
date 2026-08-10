import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureCompanyProfile } from '../../db/db'
import { Page, PageHeader, Field, Input, Select, Textarea, Button, Card } from '../../components/ui'
import type { AdjustmentValue, Invoice, InvoiceItem } from '../../db/types'
import { computeInvoiceTotals, distributeInstallments } from '../../lib/calculations'
import { formatCurrency, todayIso } from '../../lib/format'

function emptyItem(): InvoiceItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 }
}

export default function InvoiceForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const location = useLocation() as { state?: { clientId?: string } }

  const clients = useLiveQuery(() => db.clients.filter((c) => !c.deletedAt).toArray(), [])

  const [clientId, setClientId] = useState(location.state?.clientId ?? '')
  const [issueDate, setIssueDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState(todayIso())
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()])
  const [discount, setDiscount] = useState<AdjustmentValue>({ type: 'fixed', value: 0 })
  const [tax, setTax] = useState<AdjustmentValue>({ type: 'fixed', value: 0 })
  const [surcharge, setSurcharge] = useState<AdjustmentValue>({ type: 'fixed', value: 0 })
  const [installmentsCount, setInstallmentsCount] = useState(1)
  const [installmentInterval, setInstallmentInterval] = useState(30)
  const [notes, setNotes] = useState('')
  const [existingInvoice, setExistingInvoice] = useState<Invoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [hasPayments, setHasPayments] = useState(false)

  useEffect(() => {
    if (!id) return
    db.invoices.get(id).then(async (inv) => {
      if (!inv) return
      setExistingInvoice(inv)
      setClientId(inv.clientId)
      setIssueDate(inv.issueDate)
      setDueDate(inv.installments[0]?.dueDate ?? inv.dueDate)
      setItems(inv.items)
      setDiscount(inv.discount)
      setTax(inv.tax)
      setSurcharge(inv.surcharge)
      setInstallmentsCount(inv.installments.length || 1)
      if (inv.installments.length > 1) {
        const d1 = new Date(inv.installments[0].dueDate)
        const d2 = new Date(inv.installments[1].dueDate)
        setInstallmentInterval(Math.round((d2.getTime() - d1.getTime()) / 86400000))
      }
      setNotes(inv.notes ?? '')
      const payments = await db.payments.where('invoiceId').equals(inv.id).count()
      setHasPayments(payments > 0)
    })
  }, [id])

  const totals = useMemo(() => computeInvoiceTotals({ items, discount, tax, surcharge }), [items, discount, tax, surcharge])

  function updateItem(itemId: string, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }
  function removeItem(itemId: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== itemId) : prev))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) return alert('Selecione um cliente.')
    if (items.every((it) => !it.description.trim())) return alert('Adicione ao menos um item.')
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const cleanItems = items.filter((it) => it.description.trim())

      let installments = distributeInstallments(totals.total, installmentsCount, dueDate, installmentInterval)
      if (existingInvoice) {
        installments = installments.map((inst, idx) => ({ ...inst, id: existingInvoice.installments[idx]?.id ?? inst.id }))
      }

      if (existingInvoice) {
        const updated: Invoice = {
          ...existingInvoice,
          clientId,
          issueDate,
          dueDate,
          items: cleanItems,
          discount,
          tax,
          surcharge,
          installments,
          notes,
          updatedAt: now,
        }
        await db.invoices.put(updated)
        navigate(`/invoices/${updated.id}`)
      } else {
        const company = await ensureCompanyProfile()
        const invoice: Invoice = {
          id: crypto.randomUUID(),
          number: company.nextInvoiceNumber,
          clientId,
          issueDate,
          dueDate,
          items: cleanItems,
          discount,
          tax,
          surcharge,
          installments,
          notes,
          status: 'pendente',
          createdAt: now,
          updatedAt: now,
        }
        await db.invoices.put(invoice)
        await db.company.update('company', { nextInvoiceNumber: company.nextInvoiceNumber + 1 })
        navigate(`/invoices/${invoice.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title={isEdit ? 'Editar orçamento' : 'Novo orçamento'} back={isEdit ? `/invoices/${id}` : '/invoices'} />
      <Page>
        <form onSubmit={handleSubmit} className="pb-4">
          <Field label="Cliente *">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">Selecione um cliente</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Emissão">
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field label="1º vencimento">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>

          <h2 className="text-sm font-semibold text-slate-500 mt-2 mb-2">Itens</h2>
          <div className="space-y-2 mb-3">
            {items.map((item) => (
              <Card key={item.id} className="p-3">
                <Input
                  placeholder="Produto ou serviço"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  className="mb-2"
                />
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={(e) => updateItem(item.id, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                    placeholder="Qtd"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice === 0 ? '' : item.unitPrice}
                    onChange={(e) => updateItem(item.id, { unitPrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                    placeholder="Preço unit."
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{formatCurrency(item.quantity * item.unitPrice)}</span>
                    <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 p-1" aria-label="Remover item">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Button type="button" variant="secondary" onClick={addItem} className="mb-4">
            + Adicionar item
          </Button>

          <h2 className="text-sm font-semibold text-slate-500 mb-2">Ajustes</h2>
          <div className="grid grid-cols-1 gap-2 mb-4">
            <AdjustmentRow label="Desconto" value={discount} onChange={setDiscount} />
            <AdjustmentRow label="Imposto" value={tax} onChange={setTax} />
            <AdjustmentRow label="Acréscimo" value={surcharge} onChange={setSurcharge} />
          </div>

          <h2 className="text-sm font-semibold text-slate-500 mb-2">Parcelamento</h2>
          {hasPayments ? (
            <p className="text-xs text-amber-600 mb-3 bg-amber-50 rounded-lg p-2">
              Este orçamento já tem pagamentos registrados. O número de parcelas fica bloqueado; os valores serão redistribuídos mantendo a
              quantidade atual.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-2">
              <Field label="Nº de parcelas">
                <Input
                  type="number"
                  min={1}
                  max={36}
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(Math.max(1, Number(e.target.value)))}
                />
              </Field>
              <Field label="Intervalo (dias)">
                <Input
                  type="number"
                  min={1}
                  value={installmentInterval}
                  onChange={(e) => setInstallmentInterval(Math.max(1, Number(e.target.value)))}
                  disabled={installmentsCount <= 1}
                />
              </Field>
            </div>
          )}

          <Field label="Observações">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condições, prazo de entrega, garantia, etc." />
          </Field>

          <Card className="mb-4">
            <TotalsRow label="Subtotal" value={totals.subtotal} />
            {totals.discountAmount > 0 && <TotalsRow label="Desconto" value={-totals.discountAmount} />}
            {totals.taxAmount > 0 && <TotalsRow label="Imposto" value={totals.taxAmount} />}
            {totals.surchargeAmount > 0 && <TotalsRow label="Acréscimo" value={totals.surchargeAmount} />}
            <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="font-bold text-lg text-slate-900">{formatCurrency(totals.total)}</span>
            </div>
          </Card>

          <Button type="submit" full disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar orçamento'}
          </Button>
        </form>
      </Page>
    </>
  )
}

function AdjustmentRow({ label, value, onChange }: { label: string; value: AdjustmentValue; onChange: (v: AdjustmentValue) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600 w-20 shrink-0">{label}</span>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value.value === 0 ? '' : value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value === '' ? 0 : Number(e.target.value) })}
        placeholder="0"
        className="flex-1"
      />
      <Select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as AdjustmentValue['type'] })} className="w-24">
        <option value="fixed">R$</option>
        <option value="percent">%</option>
      </Select>
    </div>
  )
}

function TotalsRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700">{formatCurrency(value)}</span>
    </div>
  )
}
