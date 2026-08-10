export type DiscountType = 'percent' | 'fixed'

export interface AdjustmentValue {
  type: DiscountType
  value: number
}

export interface Client {
  id: string
  name: string
  document?: string // CPF/CNPJ
  email?: string
  phone?: string
  address?: string
  notes?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export interface Installment {
  id: string
  number: number
  dueDate: string
  amount: number
}

export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | 'boleto' | 'outro'

export interface Payment {
  id: string
  invoiceId: string
  installmentId?: string
  amount: number
  date: string
  method: PaymentMethod
  notes?: string
  createdAt: string
}

export type InvoiceStatus = 'rascunho' | 'pendente' | 'parcial' | 'pago' | 'atrasado' | 'cancelado'

export interface Invoice {
  id: string
  number: number
  clientId: string
  issueDate: string
  dueDate: string
  items: InvoiceItem[]
  discount: AdjustmentValue
  tax: AdjustmentValue
  surcharge: AdjustmentValue
  installments: Installment[]
  notes?: string
  status: InvoiceStatus
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface CompanyProfile {
  id: 'company'
  name: string
  document?: string
  email?: string
  phone?: string
  address?: string
  logoDataUrl?: string
  signatureDataUrl?: string
  pixKey?: string
  website?: string
  invoiceNotes?: string
  nextInvoiceNumber: number
  updatedAt: string
}

export interface SyncSettings {
  id: 'sync'
  enabled: boolean
  supabaseUrl?: string
  supabaseAnonKey?: string
  lastSyncedAt?: string
}
