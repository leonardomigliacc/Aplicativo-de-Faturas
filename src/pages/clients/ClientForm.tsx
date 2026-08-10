import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db/db'
import { Page, PageHeader, Field, Input, Textarea, Button } from '../../components/ui'
import type { Client } from '../../db/types'

const empty = { name: '', document: '', email: '', phone: '', address: '', notes: '' }

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    db.clients.get(id).then((c) => {
      if (c) setForm({ name: c.name, document: c.document ?? '', email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', notes: c.notes ?? '' })
    })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const now = new Date().toISOString()
    if (isEdit && id) {
      await db.clients.update(id, { ...form, updatedAt: now })
      navigate(`/clients/${id}`)
    } else {
      const client: Client = { id: crypto.randomUUID(), ...form, createdAt: now, updatedAt: now }
      await db.clients.put(client)
      navigate(`/clients/${client.id}`)
    }
    setSaving(false)
  }

  return (
    <>
      <PageHeader title={isEdit ? 'Editar cliente' : 'Novo cliente'} back={isEdit ? `/clients/${id}` : '/clients'} />
      <Page>
        <form onSubmit={handleSubmit}>
          <Field label="Nome *">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do cliente ou empresa" />
          </Field>
          <Field label="CPF/CNPJ">
            <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="000.000.000-00" />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@email.com" />
          </Field>
          <Field label="Telefone / WhatsApp">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
          </Field>
          <Field label="Endereço">
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade" />
          </Field>
          <Field label="Observações">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas internas sobre este cliente" />
          </Field>
          <Button type="submit" full disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar cliente'}
          </Button>
        </form>
      </Page>
    </>
  )
}
