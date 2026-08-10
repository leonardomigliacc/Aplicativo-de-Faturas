import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CompanyProfile, Client, Invoice, Payment } from '../db/types'
import { computeInvoiceTotals, getInstallmentPaymentInfo, itemTotal } from './calculations'
import { formatCurrency, formatDate, paymentMethodLabel } from './format'

export function generateInvoicePdf(invoice: Invoice, client: Client | undefined, company: CompanyProfile, payments: Payment[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = 46

  if (company.logoDataUrl) {
    try {
      doc.addImage(company.logoDataUrl, 'PNG', margin, y - 10, 56, 56)
    } catch {
      // ignore malformed image
    }
  }

  const textX = company.logoDataUrl ? margin + 68 : margin
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
  doc.text('FATURA', pageWidth - margin, 50, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(`Nº ${invoice.number}`, pageWidth - margin, 66, { align: 'right' })
  doc.text(`Emissão: ${formatDate(invoice.issueDate)}`, pageWidth - margin, 80, { align: 'right' })

  y = 130
  doc.setDrawColor(220)
  doc.line(margin, y, pageWidth - margin, y)
  y += 22

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20)
  doc.text('COBRAR DE', margin, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60)
  doc.text(client?.name ?? 'Cliente', margin, y)
  const clientLines = [client?.document, client?.email, client?.phone, client?.address].filter(Boolean) as string[]
  clientLines.forEach((line, i) => doc.text(line, margin, y + 14 + i * 12))

  y += 14 + clientLines.length * 12 + 20

  const rows = invoice.items.map((item) => [item.description, String(item.quantity), formatCurrency(item.unitPrice), formatCurrency(itemTotal(item))])

  autoTable(doc, {
    startY: y,
    head: [['Descrição', 'Qtd', 'Valor unit.', 'Total']],
    body: rows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  })

  // @ts-expect-error jspdf-autotable augments doc at runtime
  y = doc.lastAutoTable.finalY + 20

  const totals = computeInvoiceTotals(invoice)
  const totalsX = pageWidth - margin
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
    doc.text('PARCELAS', margin, y)
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
      margin: { left: margin, right: margin },
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
    doc.text('PAGAMENTOS RECEBIDOS', margin, y)
    y += 6
    const payRows = payments.map((p) => [formatDate(p.date), paymentMethodLabel(p.method), formatCurrency(p.amount)])
    autoTable(doc, {
      startY: y + 6,
      head: [['Data', 'Método', 'Valor']],
      body: payRows,
      margin: { left: margin, right: margin },
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
    doc.text('Chave Pix para pagamento', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60)
    doc.text(company.pixKey, margin, y + 14)
    y += 34
  }

  if (invoice.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(20)
    doc.text('Observações', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60)
    doc.setFontSize(9)
    const split = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2)
    doc.text(split, margin, y + 14)
    y += 14 + split.length * 12
  }

  if (company.signatureDataUrl) {
    y += 10
    try {
      doc.addImage(company.signatureDataUrl, 'PNG', margin, y, 120, 50)
      doc.setDrawColor(200)
      doc.line(margin, y + 54, margin + 160, y + 54)
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text('Assinatura', margin, y + 66)
    } catch {
      // ignore malformed image
    }
  }

  return doc
}
