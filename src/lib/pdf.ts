import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CompanyProfile, Client, Invoice, Payment } from '../db/types'
import { computeInvoiceTotals, itemTotal } from './calculations'
import { formatCurrency, formatDate, paymentMethodLabel } from './format'

const MARGIN = 40
const LOGO_SIZE = 100
const HEADER_TOP_Y = 50

function drawHeader(doc: jsPDF, company: CompanyProfile, title: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const y = HEADER_TOP_Y

  doc.setTextColor(20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text(title, MARGIN, y)

  const nameY = y + 20
  const linesStartY = nameY + 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(30)
  doc.text(company.name || 'Sua Empresa', MARGIN, nameY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  const companyLines = [company.website, company.address, company.document, company.phone, company.email].filter(Boolean) as string[]
  companyLines.forEach((line, i) => doc.text(line, MARGIN, linesStartY + i * 12))
  const textBottom = linesStartY + companyLines.length * 12

  if (company.logoDataUrl) {
    try {
      const headerTop = y - 22
      const logoY = headerTop + Math.max((textBottom - headerTop - LOGO_SIZE) / 2, 0)
      doc.addImage(company.logoDataUrl, 'PNG', pageWidth - MARGIN - LOGO_SIZE, logoY, LOGO_SIZE, LOGO_SIZE)
    } catch {
      // ignore malformed image
    }
  }

  const dividerY = textBottom + 14
  doc.setDrawColor(220)
  doc.line(MARGIN, dividerY, pageWidth - MARGIN, dividerY)
  return dividerY + 24
}

function drawMetaField(doc: jsPDF, x: number, y: number, align: 'left' | 'right', label: string, value: string) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130)
  doc.text(label.toUpperCase(), x, y, { align })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20)
  doc.text(value, x, y + 15, { align })
}

function drawFooter(doc: jsPDF, company: CompanyProfile, startY: number, clientName?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = startY
  const gap = 30
  const colWidth = clientName ? (pageWidth - MARGIN * 2 - gap) / 2 : pageWidth - MARGIN * 2
  const leftX = MARGIN
  const rightX = MARGIN + colWidth + gap

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20)
  doc.text(company.name || 'Empresa', leftX, y)
  if (clientName) doc.text(clientName, rightX, y)
  y += 16

  const sigBoxTop = y
  const sigBoxHeight = 54
  if (company.signatureDataUrl) {
    try {
      doc.addImage(company.signatureDataUrl, 'PNG', leftX, sigBoxTop, Math.min(140, colWidth), sigBoxHeight - 4)
    } catch {
      // ignore malformed image
    }
  }

  const lineY = sigBoxTop + sigBoxHeight
  doc.setDrawColor(200)
  doc.line(leftX, lineY, leftX + colWidth, lineY)
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text('Assinatura', leftX, lineY + 12)
  if (clientName) {
    doc.line(rightX, lineY, rightX + colWidth, lineY)
    doc.text('Assinatura do cliente', rightX, lineY + 12)
  }
  y = lineY + 12 + 14

  if (company.website) {
    y += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(37, 99, 235)
    doc.text(`Confira nosso trabalho em nosso site: ${company.website}`, pageWidth / 2, y, { align: 'center' })
  }

  return y
}

export function generateInvoicePdf(invoice: Invoice, client: Client | undefined, company: CompanyProfile, payments: Payment[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = drawHeader(doc, company, 'ORÇAMENTO')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(130)
  doc.text('PARA', MARGIN, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20)
  doc.text(client?.name ?? 'Cliente', MARGIN, y + 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  const clientLines = [client?.document, client?.email, client?.phone, client?.address].filter(Boolean) as string[]
  clientLines.forEach((line, i) => doc.text(line, MARGIN, y + 30 + i * 12))

  drawMetaField(doc, pageWidth - MARGIN, y, 'right', 'Orçamento número', String(invoice.number))
  drawMetaField(doc, pageWidth - MARGIN, y + 34, 'right', 'Emitido', formatDate(invoice.issueDate))

  y += Math.max(30 + clientLines.length * 12, 60) + 20

  const rows = invoice.items.map((item) => [item.description, formatCurrency(item.unitPrice), String(item.quantity), formatCurrency(itemTotal(item))])

  autoTable(doc, {
    startY: y,
    head: [['Serviço', 'Preço', 'Qtd', 'Valor']],
    body: rows,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
  })

  // @ts-expect-error jspdf-autotable augments doc at runtime
  y = doc.lastAutoTable.finalY + 20

  const totals = computeInvoiceTotals(invoice)
  const totalsX = pageWidth - MARGIN
  doc.setFontSize(9.5)
  const totalRows: [string, number][] = [['Subtotal', totals.subtotal]]
  if (totals.discountAmount > 0) totalRows.push(['Desconto', -totals.discountAmount])
  if (totals.taxAmount > 0) totalRows.push(['Imposto', totals.taxAmount])
  if (totals.surchargeAmount > 0) totalRows.push(['Acréscimo', totals.surchargeAmount])

  totalRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90)
    doc.text(label, totalsX - 140, y, { align: 'left' })
    doc.text(formatCurrency(value), totalsX, y, { align: 'right' })
    y += 15
  })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20)
  doc.text('Total', totalsX - 140, y + 4, { align: 'left' })
  doc.text(formatCurrency(totals.total), totalsX, y + 4, { align: 'right' })
  y += 30

  if (invoice.installments.length > 1) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(20)
    doc.text('PARCELAS', MARGIN, y)
    y += 8
    const instRows = invoice.installments.map((inst) => [`${inst.number}/${invoice.installments.length}`, formatDate(inst.dueDate), formatCurrency(inst.amount)])
    autoTable(doc, {
      startY: y + 6,
      head: [['Parcela', 'Vencimento', 'Valor']],
      body: instRows,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [241, 245, 249], textColor: 20 },
      columnStyles: { 2: { halign: 'center' } },
    })
    // @ts-expect-error jspdf-autotable augments doc at runtime
    y = doc.lastAutoTable.finalY + 20
  }

  if (payments.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('PAGAMENTOS RECEBIDOS', MARGIN, y)
    y += 6
    const payRows = payments.map((p) => [formatDate(p.date), paymentMethodLabel(p.method), formatCurrency(p.amount)])
    autoTable(doc, {
      startY: y + 6,
      head: [['Data', 'Método', 'Valor']],
      body: payRows,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [241, 245, 249], textColor: 20 },
      columnStyles: { 2: { halign: 'center' } },
    })
    // @ts-expect-error jspdf-autotable augments doc at runtime
    y = doc.lastAutoTable.finalY + 20
  }

  if (company.pixKey) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(20)
    doc.text('Chave Pix para pagamento', MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60)
    doc.text(company.pixKey, MARGIN, y + 14)
    y += 34
  }

  if (invoice.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(20)
    doc.text('Observações', MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60)
    doc.setFontSize(9)
    const split = doc.splitTextToSize(invoice.notes, pageWidth - MARGIN * 2)
    doc.text(split, MARGIN, y + 14)
    y += 14 + split.length * 12
  }

  y += 16
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(120)
  const disclaimer = doc.splitTextToSize(
    'Ao assinar esse documento, o cliente aceita os serviços e condições descritos nesse documento.',
    pageWidth - MARGIN * 2,
  )
  doc.text(disclaimer, MARGIN, y)
  y += disclaimer.length * 12 + 10

  drawFooter(doc, company, y, client?.name)

  return doc
}

export function generateReceiptPdf(invoice: Invoice, client: Client | undefined, company: CompanyProfile, payment: Payment): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = drawHeader(doc, company, 'RECIBO')
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(40)
  const paragraph = `Recebemos de ${client?.name ?? 'Cliente'} a quantia de ${formatCurrency(payment.amount)}, referente ao pagamento do orçamento nº ${invoice.number}, através de ${paymentMethodLabel(payment.method)}.`
  const split = doc.splitTextToSize(paragraph, pageWidth - MARGIN * 2)
  doc.text(split, MARGIN, y)
  y += split.length * 16 + 20

  autoTable(doc, {
    startY: y,
    body: [
      ['Cliente', client?.name ?? '-'],
      ['Valor recebido', formatCurrency(payment.amount)],
      ['Data do pagamento', formatDate(payment.date)],
      ['Forma de pagamento', paymentMethodLabel(payment.method)],
      ['Orçamento', `Nº ${invoice.number}`],
      ...(payment.notes ? [['Observações', payment.notes]] : []),
    ],
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 10, cellPadding: 8 },
    theme: 'plain',
    columnStyles: { 0: { fontStyle: 'bold', textColor: [90, 90, 90] }, 1: { textColor: [20, 20, 20] } },
  })

  // @ts-expect-error jspdf-autotable augments doc at runtime
  y = doc.lastAutoTable.finalY + 40

  drawFooter(doc, company, y)

  return doc
}
