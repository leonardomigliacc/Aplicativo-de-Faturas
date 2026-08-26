import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

export function PageHeader({ title, right, back }: { title: string; right?: ReactNode; back?: string }) {
  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 safe-top">
      <div className="flex items-center gap-2 px-4 py-3">
        {back && (
          <Link to={back} className="p-1 -ml-1 text-slate-500">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <h1 className="text-lg font-semibold text-slate-900 flex-1 truncate">{title}</h1>
        {right}
      </div>
    </header>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="max-w-lg mx-auto px-4 py-4">{children}</div>
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm shadow-slate-200/60 transition-shadow', className)}>{children}</div>
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; full?: boolean }>(
  ({ className, variant = 'primary', full, ...props }, ref) => {
    const variants = {
      primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white active:from-blue-700 active:to-indigo-700 disabled:from-blue-300 disabled:to-indigo-300',
      secondary: 'bg-slate-100 text-slate-700 active:bg-slate-200',
      ghost: 'text-blue-600 active:bg-blue-50',
      danger: 'bg-red-50 text-red-600 active:bg-red-100',
    }
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[.99] disabled:opacity-60',
          variants[variant],
          full && 'w-full',
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-slate-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={clsx(inputClass, className)} {...props} />
))
Input.displayName = 'Input'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={clsx(inputClass, 'bg-white', className)} {...props}>
    {children}
  </select>
))
Select.displayName = 'Select'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={clsx(inputClass, className)} rows={3} {...props} />
))
Textarea.displayName = 'Textarea'

export function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 px-6">
      <p className="text-slate-700 font-medium">{title}</p>
      {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', className)}>{children}</span>
}

export function FAB({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="fixed bottom-24 right-4 z-20 flex items-center gap-2 rounded-full bg-blue-600 text-white px-5 py-3.5 shadow-lg shadow-blue-600/30 active:bg-blue-700"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl px-4 pt-4 pb-6 safe-bottom max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400" aria-label="Fechar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
