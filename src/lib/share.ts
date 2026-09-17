import type { jsPDF } from 'jspdf'
import type { Client, Invoice, Payment } from '../db/types'
import { formatCurrency } from './format'

function buildMessage(client: Client | undefined): string {
  return `Olá${client?.name ? ' ' + client.name : ''}! Encaminho o orçamento para sua apreciação. Fico à disposição para quaisquer esclarecimentos.`
}

function buildReceiptMessage(invoice: Invoice, client: Client | undefined, payment: Payment): string {
  return `Olá${client?.name ? ' ' + client.name : ''}! Segue o recibo do pagamento de ${formatCurrency(payment.amount)} referente ao orçamento #${invoice.number}.`
}

export type ShareResult = { status: 'shared' } | { status: 'downloaded' } | { status: 'manual'; url: string }

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export async function sharePdf(doc: jsPDF, fileName: string, title: string, text: string): Promise<ShareResult> {
  const blob = doc.output('blob')
  const file = new File([blob], fileName, { type: 'application/pdf' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text })
      return { status: 'shared' }
    } catch (err) {
      // Some iOS versions (notably installed home-screen PWAs) report file sharing as supported
      // but the native share sheet never appears — fall through to a manual open instead of
      // surfacing an error for what looks like a successful share.
      if ((err as Error)?.name === 'AbortError') throw err
    }
  }

  if (isIOS()) {
    // On iOS, jsPDF's doc.save() (an <a download> click) just navigates the current page to the
    // blob instead of downloading — inside a standalone PWA that leaves the user stuck with no
    // way to share. Hand back an object URL so the caller can offer a real, user-tapped link
    // that opens in Safari's own PDF viewer (which has its own native Share button).
    return { status: 'manual', url: URL.createObjectURL(blob) }
  }

  downloadPdf(doc, fileName)
  return { status: 'downloaded' }
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
