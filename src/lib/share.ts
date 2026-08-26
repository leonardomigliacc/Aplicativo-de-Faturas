import type { jsPDF } from 'jspdf'
import type { Client, Invoice, Payment } from '../db/types'
import { formatCurrency } from './format'

function buildMessage(client: Client | undefined): string {
  return `Olá${client?.name ? ' ' + client.name : ''}! Encaminho o orçamento para sua apreciação. Fico à disposição para quaisquer esclarecimentos.`
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
  return sharePdf(doc, fileName, `Orçamento #${invoice.number}`, buildMessage(client))
}

export async function shareReceiptPdf(doc: jsPDF, invoice: Invoice, client: Client | undefined, payment: Payment, fileName: string) {
  return sharePdf(doc, fileName, `Recibo - Orçamento #${invoice.number}`, buildReceiptMessage(invoice, client, payment))
}

export function downloadPdf(doc: jsPDF, fileName: string) {
  doc.save(fileName)
}

export function whatsappLink(_invoice: Invoice, client: Client | undefined): string {
  const text = encodeURIComponent(buildMessage(client) + ' Vou te enviar o PDF em seguida.')
  const phone = client?.phone?.replace(/\D/g, '')
  return phone ? `https://wa.me/55${phone}?text=${text}` : `https://wa.me/?text=${text}`
}

export function mailtoLink(invoice: Invoice, client: Client | undefined): string {
  const subject = encodeURIComponent(`Orçamento #${invoice.number}`)
  const body = encodeURIComponent(buildMessage(client) + '\n\n(PDF anexado)')
  return `mailto:${client?.email ?? ''}?subject=${subject}&body=${body}`
}
