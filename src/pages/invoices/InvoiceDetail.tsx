import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, ensureCompanyProfile } from '../../db/db'
import { Page, PageHeader, Card, Button, Badge, Sheet, Field, Input, Select, Textarea } from '../../components/ui'
import PdfPreviewSheet from '../../components/PdfPreviewSheet'
import {
  approvalStatusColor,
  formatCurrency,
  formatDate,
  invoicePdfFileName,
  paymentMethodLabel,
  receiptPdfFileName,
  statusColor,
  statusLabel,
  todayIso,
} from '../../lib/format'
import { computeInvoiceStatus, computeInvoiceTotals, getInstallmentPaymentInfo, invoiceReceivedAmount, invoiceTotal, itemTotal } from '../../lib/calculations'
import { whatsappLink, mailtoLink, downloadPdf, sharePdf, shareReceiptPdf } from '../../lib/share'
import type { ApprovalStatus, Payment, PaymentMethod } from '../../db/types'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [paySheetOpen, setPaySheetOpen] = useState(false)
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState<'whatsapp' | 'email' | 'generic' | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewFileName, setPreviewFileName] = useState<string | undefined>(undefined)
  const [receiptBusyId, setReceiptBusyId] = useState<string | null>(null)

  useEffect(() => {
    // Warm the lazy chunks before the user taps a share button: fetching them at click time can
    // eat up iOS's brief "user activation" window, which makes navigator.share() silently no-op.
    import('../../lib/pdf')
    import('../../lib/share')
  }, [])

  const invoice = useLiveQuery(() => (id ? db.invoices.get(id) : undefined), [id])
  const client = useLiveQuery(() => (invoice ? db.clients.get(invoice.clientId) : undefined), [invoice])
  const payments = useLiveQuery(async () => {
    if (!id) return []
    const all = await db.payments.where('invoiceId').equals(id).toArray()
    return all.sort((a, b) => b.date.localeCompare(a.date))
  }, [id])

  const totals = useMemo(() => (invoice ? computeInvoiceTotals(invoice) : null), [invoice])
  const status = useMemo(() => (invoice && payments ? computeInvoiceStatus(invoice, payments) : invoice?.status), [invoice, payments])

  if (!invoice || !totals || !payments) return null

  const received = invoiceReceivedAmount(invoice, payments)
  const total = invoiceTotal(invoice)
  const remaining = total - received
  const approvalStatus = invoice.approvalStatus ?? 'pendente'

  function openPaySheet(installmentId?: string) {
    setSelectedInstallmentId(installmentId ?? invoice!.installments.find((inst) => !getInstallmentPaymentInfo(inst, payments!).isPaid)?.id ?? null)
    setPaySheetOpen(true)
  }

  async function updateApprovalStatus(next: ApprovalStatus) {
    await db.invoices.update(invoice!.id, { approvalStatus: next, updatedAt: new Date().toISOString() })
  }

  async function handleShareTo(target: 'whatsapp' | 'email' | 'generic') {
    setShareBusy(target)
    try {
      const { generateInvoicePdf } = await import('../../lib/pdf')
      const company = await ensureCompanyProfile()
      const doc = generateInvoicePdf(invoice!, client, company, payments!)
      const title = `Orçamento #${invoice!.number}`
      const text =
        target === 'whatsapp'
          ? `Olá${client?.name ? ' ' + client.name : ''}! Encaminho o orçamento para sua apreciação. Fico à disposição para quaisquer esclarecimentos.`
          : title
      const fileName = invoicePdfFileName(invoice!)
      const result = await sharePdf(doc, fileName, title, text)
      if (result.status === 'downloaded') {
        // Web Share with files isn't supported here (e.g. desktop browser) — fall back to a
        // text-only deep link and let the user attach the file that was just downloaded.
        if (target === 'whatsapp') window.open(whatsappLink(invoice!, client), '_blank')
        else if (target === 'email') window.location.href = mailtoLink(invoice!, client)
        else alert('O PDF foi baixado. Anexe o arquivo manualmente no app que preferir.')
      } else if (result.status === 'manual') {
        setPreviewTitle(title)
        setPreviewFileName(fileName)
        setPreviewUrl(result.url)
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') alert(`Não foi possível compartilhar.\n${(err as Error)?.message ?? err}`)
    } finally {
      setShareBusy(null)
    }
  }

  async function handleDownload() {
    const { generateInvoicePdf } = await import('../../lib/pdf')
    const company = await ensureCompanyProfile()
    const doc = generateInvoicePdf(invoice!, client, company, payments!)
    downloadPdf(doc, invoicePdfFileName(invoice!))
  }

  async function handlePreview() {
    // Render the PDF inline (iframe over the current page) instead of window.open: opening a new
    // tab/window is unreliable inside an installed iOS PWA (standalone mode has no tab chrome to
    // open into, and window.open can silently fail or throw there).
    setPreviewBusy(true)
    try {
      const { generateInvoicePdf } = await import('../../lib/pdf')
      const company = await ensureCompanyProfile()
      const doc = generateInvoicePdf(invoice!, client, company, payments!)
      setPreviewTitle(`Orçamento #${invoice!.number}`)
      setPreviewFileName(invoicePdfFileName(invoice!))
      setPreviewUrl(URL.createObjectURL(doc.output('blob')))
    } catch (err) {
      alert(`Não foi possível gerar a visualização.\n${(err as Error)?.message ?? err}`)
    } finally {
      setPreviewBusy(false)
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFileName(undefined)
  }

  async function handleReceipt(payment: Payment) {
    setReceiptBusyId(payment.id)
    try {
      const { generateReceiptPdf } = await import('../../lib/pdf')
      const company = await ensureCompanyProfile()
      const doc = generateReceiptPdf(invoice!, client, company, payment)
      const fileName = receiptPdfFileName(invoice!, payment.date)
      // Try the native share sheet first (custom message, no stray URL). Only fall back to
      // opening the plain preview — where Safari's own share button leaks a "blob:" link
      // alongside the file, since it has no way to attach our custom text — if that's
      // unavailable.
      const result = await shareReceiptPdf(doc, invoice!, client, payment, fileName)
      if (result.status === 'downloaded') {
        alert('O recibo foi baixado. Anexe o arquivo manualmente no app que preferir.')
      } else if (result.status === 'manual') {
        setPreviewTitle(`Recibo - Orçamento #${invoice!.number}`)
        setPreviewFileName(fileName)
        setPreviewUrl(result.url)
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') alert(`Não foi possível gerar o recibo.\n${(err as Error)?.message ?? err}`)
    } finally {
      setReceiptBusyId(null)
    }
  }

  async function handleCancel() {
    if (!confirm('Cancelar este orçamento? Ele deixará de contar como pendente ou atrasado.')) return
    await db.invoices.update(invoice!.id, { status: 'cancelado', updatedAt: new Date().toISOString() })
  }

  async function handleDelete() {
    if (!confirm('Excluir este orçamento permanentemente da lista?')) return
    await db.invoices.update(invoice!.id, { deletedAt: new Date().toISOString() })
    navigate('/invoices')
  }

  return (
    <>
      <PageHeader
        title={`Orçamento #${invoice.number}`}
        back="/invoices"
        right={
          <Link to={`/invoices/${invoice.id}/edit`} className="text-sm text-blue-600 font-medium">
            Editar
          </Link>
        }
      />
      <Page>
        <Card className="mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <Link to={`/clients/${invoice.clientId}`} className="font-semibold text-slate-900">
                {client?.name ?? 'Cliente removido'}
              </Link>
              <p className="text-xs text-slate-400 mt-0.5">
                Emissão {formatDate(invoice.issueDate)} · Vencimento {formatDate(invoice.installments[0]?.dueDate ?? invoice.dueDate)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColor(status ?? invoice.status)}>{statusLabel(status ?? invoice.status)}</Badge>
              <Select
                value={approvalStatus}
                onChange={(e) => updateApprovalStatus(e.target.value as ApprovalStatus)}
                className={`w-auto min-w-0 py-1.5 text-xs font-semibold ${approvalStatusColor(approvalStatus)}`}
                aria-label="Status de aprovação do orçamento"
              >
                <option value="pendente">Aguardando resposta</option>
                <option value="aprovado">Aprovado</option>
                <option value="recusado">Recusado</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-slate-400">Total</p>
              <p className="font-semibold text-slate-900">{formatCurrency(total)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Recebido</p>
              <p className="font-semibold text-green-600">{formatCurrency(received)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Restante</p>
              <p className="font-semibold text-amber-600">{formatCurrency(Math.max(remaining, 0))}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <Button variant="secondary" onClick={handlePreview} disabled={previewBusy}>
            {previewBusy ? 'Abrindo…' : 'Visualizar PDF'}
          </Button>
          <Button variant="secondary" onClick={handleDownload}>
            Baixar PDF
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button variant="secondary" onClick={() => handleShareTo('whatsapp')} disabled={shareBusy !== null}>
            {shareBusy === 'whatsapp' ? 'Preparando…' : 'WhatsApp'}
          </Button>
          <Button variant="secondary" onClick={() => handleShareTo('email')} disabled={shareBusy !== null}>
            {shareBusy === 'email' ? 'Preparando…' : 'E-mail'}
          </Button>
        </div>
        <Button onClick={() => handleShareTo('generic')} disabled={shareBusy !== null} full className="mb-4">
          {shareBusy === 'generic' ? 'Preparando…' : 'Compartilhar PDF'}
        </Button>

        <h2 className="text-sm font-semibold text-slate-500 mb-2">Itens</h2>
        <Card className="mb-4 divide-y divide-slate-100">
          {invoice.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm text-slate-800 truncate">{item.description}</p>
                <p className="text-xs text-slate-400">
                  {item.quantity} × {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <p className="text-sm font-medium text-slate-700 shrink-0 ml-2">{formatCurrency(itemTotal(item))}</p>
            </div>
          ))}
          <div className="pt-2 space-y-1">
            <TotalsRow label="Subtotal" value={totals.subtotal} />
            {totals.discountAmount > 0 && <TotalsRow label="Desconto" value={-totals.discountAmount} />}
            {totals.taxAmount > 0 && <TotalsRow label="Imposto" value={totals.taxAmount} />}
            {totals.surchargeAmount > 0 && <TotalsRow label="Acréscimo" value={totals.surchargeAmount} />}
          </div>
        </Card>

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-500">Parcelas</h2>
          {remaining > 0.009 && (
            <button onClick={() => openPaySheet()} className="text-sm text-blue-600 font-medium">
              + Registrar pagamento
            </button>
          )}
        </div>
        <div className="space-y-2 mb-4">
          {invoice.installments.map((inst) => {
            const info = getInstallmentPaymentInfo(inst, payments)
            return (
              <Card key={inst.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Parcela {inst.number}/{invoice.installments.length}
                  </p>
                  <p className="text-xs text-slate-400">Vencimento {formatDate(inst.dueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(inst.amount)}</p>
                  {info.isPaid ? (
                    <Badge className="bg-green-100 text-green-700">Pago</Badge>
                  ) : info.paid > 0 ? (
                    <Badge className="bg-blue-100 text-blue-700">Falta {formatCurrency(info.remaining)}</Badge>
                  ) : info.isOverdue ? (
                    <button onClick={() => openPaySheet(inst.id)}>
                      <Badge className="bg-red-100 text-red-700">Atrasado</Badge>
                    </button>
                  ) : (
                    <button onClick={() => openPaySheet(inst.id)}>
                      <Badge className="bg-amber-100 text-amber-700">Pendente</Badge>
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        {payments.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-slate-500 mb-2">Pagamentos registrados</h2>
            <Card className="mb-4 divide-y divide-slate-100">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm text-slate-800">{formatDate(p.date)}</p>
                    <p className="text-xs text-slate-400">
                      {paymentMethodLabel(p.method)}
                      {p.notes ? ` · ${p.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-green-600">{formatCurrency(p.amount)}</span>
                    <button
                      className="text-slate-400 p-1"
                      aria-label="Compartilhar recibo em PDF"
                      disabled={receiptBusyId === p.id}
                      onClick={() => handleReceipt(p)}
                    >
                      {receiptBusyId === p.id ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M9 8h6M9 12h6" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                    <button
                      className="text-slate-300 p-1"
                      aria-label="Remover pagamento"
                      onClick={async () => {
                        if (confirm('Remover este pagamento?')) await db.payments.delete(p.id)
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {invoice.notes && (
          <>
            <h2 className="text-sm font-semibold text-slate-500 mb-2">Observações</h2>
            <Card className="mb-4">
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
            </Card>
          </>
        )}

        <div className="flex gap-2 mb-8">
          {invoice.status !== 'cancelado' && (
            <Button variant="secondary" full onClick={handleCancel}>
              Cancelar orçamento
            </Button>
          )}
          <Button variant="danger" full onClick={handleDelete}>
            Excluir
          </Button>
        </div>
      </Page>

      <PaymentSheet
        open={paySheetOpen}
        onClose={() => setPaySheetOpen(false)}
        invoiceId={invoice.id}
        installments={invoice.installments}
        payments={payments}
        preselectedInstallmentId={selectedInstallmentId}
      />

      <PdfPreviewSheet url={previewUrl} title={previewTitle} fileName={previewFileName} onClose={closePreview} />
    </>
  )
}

function TotalsRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-600">{formatCurrency(value)}</span>
    </div>
  )
}

function PaymentSheet({
  open,
  onClose,
  invoiceId,
  installments,
  payments,
  preselectedInstallmentId,
}: {
  open: boolean
  onClose: () => void
  invoiceId: string
  installments: { id: string; number: number; amount: number; dueDate: string }[]
  payments: { installmentId?: string; amount: number }[]
  preselectedInstallmentId: string | null
}) {
  const [installmentId, setInstallmentId] = useState(preselectedInstallmentId ?? installments[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const activeInstallmentId = open ? preselectedInstallmentId ?? installmentId : installmentId

  const info = useMemo(() => {
    const inst = installments.find((i) => i.id === activeInstallmentId)
    if (!inst) return null
    const paid = payments.filter((p) => p.installmentId === inst.id).reduce((s, p) => s + p.amount, 0)
    return { inst, remaining: Math.max(inst.amount - paid, 0) }
  }, [activeInstallmentId, installments, payments])

  if (!open) return null

  async function handleSave() {
    const value = Number(amount || info?.remaining || 0)
    if (!value || value <= 0) return
    setSaving(true)
    await db.payments.put({
      id: crypto.randomUUID(),
      invoiceId,
      installmentId: activeInstallmentId || undefined,
      amount: value,
      date,
      method,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    })
    setSaving(false)
    setAmount('')
    setNotes('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Registrar pagamento">
      <Field label="Parcela">
        <Select value={activeInstallmentId} onChange={(e) => setInstallmentId(e.target.value)}>
          {installments.map((inst) => (
            <option key={inst.id} value={inst.id}>
              Parcela {inst.number} — {formatCurrency(inst.amount)} (venc. {formatDate(inst.dueDate)})
            </option>
          ))}
        </Select>
      </Field>
      <Field label={`Valor recebido${info ? ` (falta ${formatCurrency(info.remaining)})` : ''}`}>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={info ? info.remaining.toFixed(2) : '0.00'}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Método">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="pix">Pix</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao">Cartão</option>
            <option value="transferencia">Transferência</option>
            <option value="boleto">Boleto</option>
            <option value="outro">Outro</option>
          </Select>
        </Field>
      </div>
      <Field label="Observações">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
      </Field>
      <Button full onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando…' : 'Confirmar pagamento'}
      </Button>
    </Sheet>
  )
}
