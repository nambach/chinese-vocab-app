import { useState, type ReactNode } from 'react'

export type MenuItem = {
  label: string
  onClick: () => void
  danger?: boolean
}

type ScreenShellProps = {
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  menuItems?: MenuItem[]
  children: ReactNode
  footer?: ReactNode
}

function HeaderMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 ring-1 ring-teal-200 active:scale-95"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl bg-white py-1 shadow-lg ring-1 ring-teal-100">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className={`block w-full px-4 py-3 text-left text-base ${
                  item.danger ? 'text-red-600' : 'text-teal-900'
                } active:bg-teal-50`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function ScreenShell({
  title,
  subtitle,
  onBack,
  backLabel = '← Quay lại',
  menuItems,
  children,
  footer,
}: ScreenShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-teal-50">
      <header className="border-b border-teal-100 bg-white px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 text-sm font-medium text-teal-700"
          >
            {backLabel}
          </button>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-teal-900">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-teal-700">{subtitle}</p> : null}
          </div>
          {menuItems && menuItems.length > 0 ? <HeaderMenu items={menuItems} /> : null}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-6">{children}</main>

      {footer ? (
        <footer className="border-t border-teal-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </footer>
      ) : null}
    </div>
  )
}

type BigButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}

const buttonStyles = {
  primary: 'bg-teal-700 text-white shadow-sm',
  secondary: 'bg-white text-teal-900 ring-1 ring-teal-200',
  danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  ghost: 'bg-transparent text-teal-700',
}

export function BigButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  className = '',
}: BigButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl px-6 py-4 text-lg font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ring-teal-100 animate-fade-in ${className}`}
    >
      {children}
    </div>
  )
}

export type SelectOption = {
  value: string
  label: string
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-teal-800">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-2xl border border-teal-200 bg-white px-4 py-4 pr-10 text-lg text-teal-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-teal-600"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  )
}

export function BottomDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-teal-200" />
        {title ? <h2 className="mb-4 text-lg font-semibold text-teal-900">{title}</h2> : null}
        {children}
      </div>
    </div>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        {title ? <h2 className="text-lg font-semibold text-teal-900">{title}</h2> : null}
        <div className="mt-3 text-teal-800">{children}</div>
        {footer ? <div className="mt-5">{footer}</div> : null}
      </div>
    </div>
  )
}

export function OptionButton({
  selected,
  label,
  description,
  onClick,
}: {
  selected: boolean
  label: string
  description?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-4 text-left ring-1 transition active:scale-[0.98] ${
        selected
          ? 'bg-teal-700 text-white ring-teal-700'
          : 'bg-white text-teal-950 ring-teal-200'
      }`}
    >
      <div className="font-semibold">{label}</div>
      {description ? (
        <div className={`mt-1 text-sm ${selected ? 'text-teal-100' : 'text-teal-700'}`}>
          {description}
        </div>
      ) : null}
    </button>
  )
}
