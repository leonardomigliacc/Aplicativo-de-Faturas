export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function invoicePdfFileName(invoice: { number: number }): string {
  return `orcamento-${invoice.number}.pdf`
}

export function receiptPdfFileName(invoice: { number: number }, paymentDate: string): string {
  return `recibo-orcamento-${invoice.number}-${paymentDate}.pdf`
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    rascunho: 'Rascunho',
    pendente: 'Pendente',
    parcial: 'Parcial',
    pago: 'Pago',
    atrasado: 'Atrasado',
    cancelado: 'Cancelado',
  }
  return map[status] ?? status
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    rascunho: 'bg-gray-100 text-gray-700',
    pendente: 'bg-amber-100 text-amber-700',
    parcial: 'bg-blue-100 text-blue-700',
    pago: 'bg-green-100 text-green-700',
    atrasado: 'bg-red-100 text-red-700',
    cancelado: 'bg-gray-100 text-gray-500 line-through',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

export function approvalStatusLabel(status: string | undefined): string {
  if (status === 'aprovado') return 'Aprovado'
  if (status === 'recusado') return 'Recusado'
  return 'Pendente'
}

export function approvalStatusColor(status: string | undefined): string {
  if (status === 'aprovado') return 'bg-emerald-100 text-emerald-700'
  if (status === 'recusado') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

export function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    pix: 'Pix',
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    transferencia: 'Transferência',
    boleto: 'Boleto',
    outro: 'Outro',
  }
  return map[method] ?? method
}
