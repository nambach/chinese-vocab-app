import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { KeyboardAvoidingView } from './KeyboardAvoidingView'

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
  /** Pin the shell to the visual viewport on touch devices (keyboard-safe layout). */
  keyboardAvoiding?: boolean
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
  backLabel = 'Quay lại',
  menuItems,
  children,
  footer,
  keyboardAvoiding = false,
}: ScreenShellProps) {
  const hasMenu = Boolean(menuItems && menuItems.length > 0)
  const headerRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return undefined

    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty(
        '--screen-header-height',
        `${header.getBoundingClientRect().height}px`,
      )
    }

    updateHeaderHeight()
    const observer = new ResizeObserver(updateHeaderHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [subtitle, title, hasMenu])

  const shell = (
    <div
      className={`flex flex-col bg-teal-50 ${keyboardAvoiding ? 'h-full min-h-0' : 'min-h-dvh md:min-h-full'}`}
    >
      <header
        ref={headerRef}
        className="shrink-0 border-b border-teal-100 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-8 md:pb-4 md:pt-4"
      >
        <div className="flex min-h-11 items-center gap-2">
          {onBack ? (
            <div className="flex w-11 shrink-0 justify-start">
              <button
                type="button"
                onClick={onBack}
                aria-label={backLabel}
                className="-ml-2 flex h-11 w-11 items-center justify-center rounded-2xl text-teal-800 active:bg-teal-50"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 6l-6 6 6 6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : null}

          <div className={`min-w-0 flex-1 ${onBack ? 'text-center' : 'text-left'}`}>
            <h1 className="truncate text-lg font-bold leading-tight text-teal-900 md:text-xl">
              {title}
            </h1>
          </div>

          <div className={`flex shrink-0 justify-end ${hasMenu ? 'w-11' : ''}`}>
            {hasMenu ? <HeaderMenu items={menuItems!} /> : null}
          </div>
        </div>

        {subtitle ? (
          <p className={`mt-0.5 truncate text-sm text-teal-700 ${onBack ? 'text-center' : 'text-left'}`}>
            {subtitle}
          </p>
        ) : null}
      </header>

      <main
        className={`flex flex-col gap-4 px-4 py-6 md:gap-5 md:px-8 md:py-8 ${
          keyboardAvoiding ? 'min-h-0 flex-1 overflow-hidden' : 'flex-1'
        }`}
      >
        {children}
      </main>

      {footer ? (
        <footer className="shrink-0 border-t border-teal-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-5">
          {footer}
        </footer>
      ) : null}
    </div>
  )

  if (keyboardAvoiding) {
    return <KeyboardAvoidingView className="bg-teal-50">{shell}</KeyboardAvoidingView>
  }

  return shell
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
    <div className="fixed inset-0 z-40 flex flex-col justify-end md:items-center md:justify-center md:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl md:max-w-lg md:rounded-3xl md:p-6">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl md:max-w-md md:p-8">
        {title ? <h2 className="text-lg font-semibold text-teal-900">{title}</h2> : null}
        <div className="mt-3 text-teal-800">{children}</div>
        {footer ? <div className="mt-5">{footer}</div> : null}
      </div>
    </div>
  )
}

type LineNumberedTextareaProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  autoFocus?: boolean
  errorLines?: Set<number>
}

export function LineNumberedTextarea({
  value,
  onChange,
  placeholder,
  rows = 10,
  autoFocus,
  errorLines,
}: LineNumberedTextareaProps) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const lineCount = Math.max(1, value.split('\n').length)
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1)

  return (
    <div className="flex overflow-hidden rounded-2xl border border-teal-200 bg-white font-mono text-sm focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-200">
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="select-none overflow-hidden bg-teal-50 py-3 pl-3 pr-2 text-right leading-6 text-teal-400"
      >
        {lineNumbers.map((n) => (
          <div
            key={n}
            className={errorLines?.has(n) ? 'font-semibold text-red-500' : undefined}
          >
            {n}
          </div>
        ))}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutterRef.current) {
            gutterRef.current.scrollTop = event.currentTarget.scrollTop
          }
        }}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        wrap="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="flex-1 resize-none overflow-auto whitespace-pre bg-white px-3 py-3 leading-6 text-teal-950 outline-none"
      />
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
