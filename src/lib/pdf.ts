import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CompanyProfile, Client, Invoice, Payment } from '../db/types'
import { computeInvoiceTotals, getInstallmentPaymentInfo, itemTotal } from './calculations'
import { formatCurrency, formatDate, paymentMethodLabel } from './format'

const MARGIN = 40

function drawHeader(doc: jsPDF, company: CompanyProfile, title: string, docNumber: string, date: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 46

  if (company.logoDataUrl) {
    try {
      doc.addImage(company.logoDataUrl, 'PNG', MARGIN, y - 10, 56, 56)
    } catch {
      // ignore malformed image
    }
  }

  const textX = company.logoDataUrl ? MARGIN + 68 : MARGIN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(company.name || 'Sua Empresa', textX, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  const companyLines = [company.document, company.email, company.phone, company.address].filter(Boolean) as string[]
  companyLines.forEach((line, i) => doc.text(line, textX, y + 20 + i * 12))

  doc.setTextColor(20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(title, pageWidth - MARGIN, 50, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(docNumber, pageWidth - MARGIN, 66, { align: 'right' })
  doc.text(`Emissão: ${date}`, pageWidth - MARGIN, 80, { align: 'right' })

  y = 130
  doc.setDrawColor(220)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  return y + 22
}

function drawFooter(doc: jsPDF, company: CompanyProfile, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = startY

  if (company.signatureDataUrl) {
    y += 10
    try {
      doc.addImage(company.signatureDataUrl, 'PNG', MARGIN, y, 120, 50)
      doc.setDrawColor(200)
      doc.line(MARGIN, y + 54, MARGIN + 160, y + 54)
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text('Assinatura', MARGIN, y + 66)
      y += 76
    } catch {
      // ignore malformed image
    }
  }

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

  let y = drawHeader(doc, company, 'ORÇAMENTO', `Nº ${invoice.number}`, formatDate(invoice.issueDate))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20)
  doc.text('PARA', MARGIN, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60)
  doc.text(client?.name ?? 'Cliente', MARGIN, y)
  const clientLines = [client?.document, client?.email, client?.phone, client?.address].filter(Boolean) as string[]
  clientLines.forEach((line, i) => doc.text(line, MARGIN, y + 14 + i * 12))

  y += 14 + clientLines.length * 12 + 20

  const rows = invoice.items.map((item) => [item.description, String(item.quantity), formatCurrency(item.unitPrice), formatCurrency(itemTotal(item))])

  autoTable(doc, {
    startY: y,
    head: [['Descrição', 'Qtd', 'Valor unit.', 'Total']],
    body: rows,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
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

  if (invoice.installments.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(20)
    doc.text('PARCELAS', MARGIN, y)
    y += 8
    const instRows = invoice.installments.map((inst) => {
      const info = getInstallmentPaymentInfo(inst, payments)
      const label = info.isPaid ? 'Pago' : info.paid > 0 ? `Parcial (falta ${formatCurrency(info.remaining)})` : info.isOverdue ? 'Atrasado' : 'Pendente'
      return [`${inst.number}/${invoice.installments.length}`, formatDate(inst.dueDate), formatCurrency(inst.amount), label]
    })
    autoTable(doc, {
      startY: y + 6,
      head: [['Parcela', 'Vencimento', 'Valor', 'Situação']],
      body: instRows,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [241, 245, 249], textColor: 20 },
      columnStyles: { 2: { halign: 'right' } },
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
      columnStyles: { 2: { halign: 'right' } },
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

  drawFooter(doc, company, y)

  return doc
}

export function generateReceiptPdf(invoice: Invoice, client: Client | undefined, company: CompanyProfile, payment: Payment): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = drawHeader(doc, company, 'RECIBO', `Ref. orçamento Nº ${invoice.number}`, formatDate(payment.date))

  y += 20
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
