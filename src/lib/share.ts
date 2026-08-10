import type { jsPDF } from 'jspdf'
import type { Client, Invoice, Payment } from '../db/types'
import { formatCurrency, formatDate } from './format'
import { invoiceTotal } from './calculations'

function buildMessage(invoice: Invoice, client: Client | undefined): string {
  return `Olá${client?.name ? ' ' + client.name : ''}! Segue o orçamento #${invoice.number} no valor de ${formatCurrency(
    invoiceTotal(invoice),
  )}, com vencimento em ${formatDate(invoice.installments[0]?.dueDate ?? invoice.dueDate)}.`
}

function buildReceiptMessage(invoice: Invoice, client: Client | undefined, payment: Payment): string {
  return `Olá${client?.name ? ' ' + client.name : ''}! Segue o recibo do pagamento de ${formatCurrency(payment.amount)} referente ao orçamento #${invoice.number}.`
}

export async function sharePdf(doc: jsPDF, fileName: string, title: string, text: string) {
  const blob = doc.output('blob')
  const file = new File([blob], fileName, { type: 'application/pdf' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title, text })
    return 'shared' as const
  }

  downloadPdf(doc, fileName)
  return 'downloaded' as const
}

export async function shareInvoicePdf(doc: jsPDF, invoice: Invoice, client: Client | undefined, fileName: string) {
  return sharePdf(doc, fileName, `Orçamento #${invoice.number}`, buildMessage(invoice, client))
}

export async function shareReceiptPdf(doc: jsPDF, invoice: Invoice, client: Client | undefined, payment: Payment, fileName: string) {
  return sharePdf(doc, fileName, `Recibo - Orçamento #${invoice.number}`, buildReceiptMessage(invoice, client, payment))
}

export function downloadPdf(doc: jsPDF, fileName: string) {
  doc.save(fileName)
}

export function whatsappLink(invoice: Invoice, client: Client | undefined): string {
  const text = encodeURIComponent(buildMessage(invoice, client) + ' Vou te enviar o PDF em seguida.')
  const phone = client?.phone?.replace(/\D/g, '')
  return phone ? `https://wa.me/55${phone}?text=${text}` : `https://wa.me/?text=${text}`
}

export function mailtoLink(invoice: Invoice, client: Client | undefined): string {
  const subject = encodeURIComponent(`Orçamento #${invoice.number}`)
  const body = encodeURIComponent(buildMessage(invoice, client) + '\n\n(PDF anexado)')
  return `mailto:${client?.email ?? ''}?subject=${subject}&body=${body}`
}
