import type { AdjustmentValue, Installment, Invoice, InvoiceItem, Payment } from '../db/types'

export function itemTotal(item: InvoiceItem): number {
  return round2(item.quantity * item.unitPrice)
}

export function itemsSubtotal(items: InvoiceItem[]): number {
  return round2(items.reduce((sum, item) => sum + itemTotal(item), 0))
}

export function applyAdjustment(base: number, adjustment: AdjustmentValue): number {
  if (adjustment.type === 'percent') return round2((base * adjustment.value) / 100)
  return round2(adjustment.value)
}

export interface InvoiceTotals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  surchargeAmount: number
  total: number
}

export function computeInvoiceTotals(invoice: Pick<Invoice, 'items' | 'discount' | 'tax' | 'surcharge'>): InvoiceTotals {
  const subtotal = itemsSubtotal(invoice.items)
  const discountAmount = applyAdjustment(subtotal, invoice.discount)
  const afterDiscount = subtotal - discountAmount
  const taxAmount = applyAdjustment(afterDiscount, invoice.tax)
  const surchargeAmount = applyAdjustment(afterDiscount, invoice.surcharge)
  const total = round2(afterDiscount + taxAmount + surchargeAmount)
  return { subtotal, discountAmount, taxAmount, surchargeAmount, total }
}

export function distributeInstallments(total: number, count: number, firstDueDate: string, intervalDays: number): Installment[] {
  if (count <= 0) count = 1
  const base = Math.floor((total / count) * 100) / 100
  const installments: Installment[] = []
  let allocated = 0
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1
    const amount = isLast ? round2(total - allocated) : base
    allocated = round2(allocated + amount)
    const dueDate = addDays(firstDueDate, intervalDays * i)
    installments.push({
      id: crypto.randomUUID(),
      number: i + 1,
      dueDate,
      amount,
    })
  }
  return installments
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface InstallmentPaymentInfo {
  installment: Installment
  paid: number
  remaining: number
  isPaid: boolean
  isOverdue: boolean
}

export function getInstallmentPaymentInfo(installment: Installment, payments: Payment[], today = new Date()): InstallmentPaymentInfo {
  const paid = round2(
    payments.filter((p) => p.installmentId === installment.id).reduce((sum, p) => sum + p.amount, 0),
  )
  const remaining = round2(installment.amount - paid)
  const isPaid = remaining <= 0.009
  const dueDate = new Date(installment.dueDate + 'T23:59:59')
  const isOverdue = !isPaid && dueDate.getTime() < today.getTime()
  return { installment, paid, remaining, isPaid, isOverdue }
}

export function computeInvoiceStatus(invoice: Invoice, payments: Payment[], today = new Date()): Invoice['status'] {
  if (invoice.status === 'cancelado') return 'cancelado'
  if (invoice.installments.length === 0) return 'rascunho'

  const infos = invoice.installments.map((inst) => getInstallmentPaymentInfo(inst, payments, today))
  const totalPaid = round2(infos.reduce((sum, i) => sum + i.paid, 0))
  const totalAmount = round2(invoice.installments.reduce((sum, i) => sum + i.amount, 0))

  if (totalPaid >= totalAmount - 0.009) return 'pago'
  if (infos.some((i) => i.isOverdue)) return 'atrasado'
  if (totalPaid > 0) return 'parcial'
  return 'pendente'
}

export function invoiceReceivedAmount(invoice: Invoice, payments: Payment[]): number {
  return round2(payments.filter((p) => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0))
}

export function invoiceTotal(invoice: Invoice): number {
  return round2(invoice.installments.reduce((sum, i) => sum + i.amount, 0))
}

export function invoiceRemaining(invoice: Invoice, payments: Payment[]): number {
  return round2(invoiceTotal(invoice) - invoiceReceivedAmount(invoice, payments))
}
