import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'

const tabs = [
  { to: '/', label: 'Início', icon: HomeIcon, end: true },
  { to: '/invoices', label: 'Faturas', icon: InvoiceIcon, end: false },
  { to: '/clients', label: 'Clientes', icon: UsersIcon, end: false },
  { to: '/settings', label: 'Ajustes', icon: GearIcon, end: false },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <main className="flex-1 pb-20 safe-top">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 safe-bottom z-20">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium',
                  isActive ? 'text-blue-600' : 'text-slate-400',
                )
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function InvoiceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2h9l5 5v15H6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h6M9 8h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" strokeLinecap="round" />
      <path d="M16 4.5c1.7.4 3 2 3 3.9 0 1.9-1.3 3.5-3 3.9" strokeLinecap="round" />
      <path d="M17.5 13.7c2.3.7 4 2.9 4 5.3v1" strokeLinecap="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M19.4 13.5a7.6 7.6 0 000-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 00-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 00-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 000 3l-2 1.5 2 3.4 2.3-.9c.8.7 1.7 1.2 2.6 1.5l.5 2.6h4l.5-2.6a7.6 7.6 0 002.6-1.5l2.3.9 2-3.4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
