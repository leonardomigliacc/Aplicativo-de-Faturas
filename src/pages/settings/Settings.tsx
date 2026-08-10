import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import SignaturePad from 'signature_pad'
import { db } from '../../db/db'
import { Page, PageHeader, Card, Field, Input, Textarea, Button } from '../../components/ui'
import { resizeImageFile } from '../../lib/image'
import { exportBackup, importBackup } from '../../lib/backup'
import type { CompanyProfile, SyncSettings } from '../../db/types'

export default function Settings() {
  const company = useLiveQuery(() => db.company.get('company'), [])
  const sync = useLiveQuery(() => db.syncSettings.get('sync'), [])

  if (!company || !sync) return null

  return (
    <>
      <PageHeader title="Ajustes" />
      <Page>
        <CompanySection company={company} />
        <BackupSection />
        <SyncSection sync={sync} />
        <AboutSection />
      </Page>
    </>
  )
}

function CompanySection({ company }: { company: CompanyProfile }) {
  const [form, setForm] = useState({
    name: company.name,
    document: company.document ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    address: company.address ?? '',
    pixKey: company.pixKey ?? '',
    invoiceNotes: company.invoiceNotes ?? '',
  })
  const [logo, setLogo] = useState(company.logoDataUrl)
  const [signature, setSignature] = useState(company.signatureDataUrl)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    canvas.getContext('2d')?.scale(ratio, ratio)
    padRef.current = new SignaturePad(canvas, { backgroundColor: '#ffffff' })
    return () => padRef.current?.off()
  }, [])

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await resizeImageFile(file, 300, 300)
    setLogo(dataUrl)
  }

  function saveDrawnSignature() {
    if (!padRef.current || padRef.current.isEmpty()) return
    setSignature(padRef.current.toDataURL('image/png'))
  }

  function clearSignature() {
    padRef.current?.clear()
    setSignature(undefined)
  }

  async function handleSave() {
    setSaving(true)
    await db.company.update('company', { ...form, logoDataUrl: logo, signatureDataUrl: signature, updatedAt: new Date().toISOString() })
    setSaving(false)
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(null), 2000)
  }

  return (
    <Card className="mb-4">
      <h2 className="font-semibold text-slate-900 mb-3">Dados da empresa</h2>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
          {logo ? <img src={logo} alt="Logo" className="w-full h-full object-contain" /> : <span className="text-xs text-slate-400">Logo</span>}
        </div>
        <label className="flex-1">
          <span className="inline-block text-sm font-medium text-blue-600 cursor-pointer">Enviar logo</span>
          <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
        </label>
        {logo && (
          <button type="button" className="text-xs text-red-500" onClick={() => setLogo(undefined)}>
            Remover
          </button>
        )}
      </div>

      <Field label="Nome da empresa *">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sua empresa ou seu nome" />
      </Field>
      <Field label="CPF/CNPJ">
        <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
      </Field>
      <Field label="E-mail">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="Telefone">
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label="Endereço">
        <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Field>
      <Field label="Chave Pix">
        <Input value={form.pixKey} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} placeholder="CPF, e-mail, telefone ou chave aleatória" />
      </Field>
      <Field label="Observações padrão nas faturas">
        <Textarea value={form.invoiceNotes} onChange={(e) => setForm({ ...form, invoiceNotes: e.target.value })} placeholder="Ex: condições de pagamento" />
      </Field>

      <Field label="Assinatura">
        <canvas ref={canvasRef} className="w-full h-32 border border-slate-300 rounded-xl touch-none" onPointerUp={saveDrawnSignature} />
        <div className="flex gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={clearSignature}>
            Limpar
          </Button>
        </div>
      </Field>

      <Button onClick={handleSave} full disabled={saving}>
        {savedAt ? 'Salvo ✓' : saving ? 'Salvando…' : 'Salvar dados da empresa'}
      </Button>
    </Card>
  )
}

function BackupSection() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('Restaurar este backup? Os dados existentes com o mesmo ID serão substituídos.')) {
      e.target.value = ''
      return
    }
    setBusy(true)
    try {
      const result = await importBackup(file)
      setMessage(`Restaurado: ${result.clients} clientes, ${result.invoices} faturas, ${result.payments} pagamentos.`)
    } catch {
      setMessage('Não foi possível importar este arquivo.')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <Card className="mb-4">
      <h2 className="font-semibold text-slate-900 mb-1">Backup e restauração</h2>
      <p className="text-sm text-slate-400 mb-3">Salve todos os seus dados em um arquivo, ou restaure a partir de um backup anterior.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => exportBackup()} disabled={busy}>
          Exportar backup
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
          Importar backup
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" onChange={handleImport} className="hidden" />
      {message && <p className="text-sm text-slate-500 mt-2">{message}</p>}
    </Card>
  )
}

function SyncSection({ sync }: { sync: SyncSettings }) {
  const [enabled, setEnabled] = useState(sync.enabled)
  const [url, setUrl] = useState(sync.supabaseUrl ?? '')
  const [key, setKey] = useState(sync.supabaseAnonKey ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await db.syncSettings.update('sync', { enabled, supabaseUrl: url || undefined, supabaseAnonKey: key || undefined })
    setSaving(false)
  }

  return (
    <Card className="mb-4">
      <h2 className="font-semibold text-slate-900 mb-1">Sincronizar entre dispositivos</h2>
      <p className="text-sm text-slate-400 mb-3">
        Opcional. O app funciona totalmente offline no aparelho. Para sincronizar entre vários dispositivos, crie um projeto gratuito no{' '}
        <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">
          Supabase
        </a>{' '}
        e cole as chaves abaixo.
      </p>
      <label className="flex items-center gap-2 mb-3">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
        <span className="text-sm text-slate-700">Ativar sincronização</span>
      </label>
      {enabled && (
        <>
          <Field label="Project URL">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
          </Field>
          <Field label="Anon public key">
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi..." />
          </Field>
        </>
      )}
      <Button onClick={handleSave} full disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>
    </Card>
  )
}

function AboutSection() {
  return (
    <Card className="mb-8 text-center">
      <p className="text-sm text-slate-400">Faturas · funciona offline · seus dados ficam neste dispositivo</p>
    </Card>
  )
}
