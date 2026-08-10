import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import { Page, PageHeader, Card, Input, EmptyState, FAB } from '../../components/ui'

export default function ClientList() {
  const [search, setSearch] = useState('')
  const clients = useLiveQuery(async () => {
    const all = await db.clients.filter((c) => !c.deletedAt).toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  const filtered = useMemo(() => {
    if (!clients) return []
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.document?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q),
    )
  }, [clients, search])

  return (
    <>
      <PageHeader title="Clientes" />
      <Page>
        <Input placeholder="Buscar por nome, documento ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />

        {clients && filtered.length === 0 && (
          <EmptyState
            title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            subtitle={search ? 'Tente outra busca' : 'Toque em "Novo" para adicionar seu primeiro cliente'}
          />
        )}

        <div className="space-y-2">
          {filtered.map((client) => (
            <Link key={client.id} to={`/clients/${client.id}`}>
              <Card className="flex items-center gap-3 active:bg-slate-50">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 truncate">{client.name}</p>
                  <p className="text-sm text-slate-400 truncate">{client.document || client.email || client.phone || 'Sem detalhes'}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Page>
      <FAB to="/clients/new" label="Novo" />
    </>
  )
}
