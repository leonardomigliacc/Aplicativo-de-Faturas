import type { jsPDF } from 'jspdf'
import type { Client, Invoice } from '../db/types'
import { formatCurrency, formatDate } from './format'
import { invoiceTotal } from './calculations'

function buildMessage(invoice: Invoice, client: Client | undefined): string {
  return `Olá${client?.name ? ' ' + client.name : ''}! Segue a fatura #${invoice.number} no valor de ${formatCurrency(
    invoiceTotal(invoice),
  )}, com vencimento em ${formatDate(invoice.installments[0]?.dueDate ?? invoice.dueDate)}.`
}

export async function shareInvoicePdf(doc: jsPDF, invoice: Invoice, client: Client | undefined, fileName: string) {
  const blob = doc.output('blob')
  const file = new File([blob], fileName, { type: 'application/pdf' })
  const text = buildMessage(invoice, client)

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: `Fatura #${invoice.number}`, text })
    return 'shared' as const
  }

  downloadPdf(doc, fileName)
  return 'downloaded' as const
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
  const subject = encodeURIComponent(`Fatura #${invoice.number}`)
  const body = encodeURIComponent(buildMessage(invoice, client) + '\n\n(PDF anexado)')
  return `mailto:${client?.email ?? ''}?subject=${subject}&body=${body}`
}
