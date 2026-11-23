import { useEffect, useState, type FormEvent } from 'react'
import type { Copy, Lang } from './copy'
import type { Route } from './LegalPage'
import { AlertIcon, CheckIcon, ChatIcon, buttonLarge, buttonPrimary } from './ui'
import { getWhatsAppContactUrl, isValidEmail, submitWaitlist, type SubmitResult } from './waitlist'

type Props = {
  t: Copy['form']
  pilot: Copy['pilot']
  lang: Lang
  initialCategoryIdx?: number
  legalLinks?: {
    privacy: string
    terms: string
    kvkk?: string
    onNavigate: (r: Route, hash?: string) => void
  }
}

type Field = 'business' | 'instagram' | 'contact' | 'city'
type Values = Record<Field, string>
type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; result: SubmitResult }
  | { kind: 'failed' }

const empty: Values = { business: '', instagram: '', contact: '', city: '' }

export function WaitlistForm({ t, pilot, lang, initialCategoryIdx = 0, legalLinks }: Props) {
  const [categoryIdx, setCategoryIdx] = useState<number>(initialCategoryIdx)
  const [userPickedCategory, setUserPickedCategory] = useState(false)
  const [values, setValues] = useState<Values>(empty)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<Field | 'consent', string>>>({})
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    if (!userPickedCategory) setCategoryIdx(initialCategoryIdx)
  }, [initialCategoryIdx, userPickedCategory])

  const selectedCategory = t.categories[categoryIdx] ?? t.categories[0] ?? ''
  const whatsappUrl = getWhatsAppContactUrl(pilot.whatsappPrefill)

  const fields: {
    id: Field
    label: string
    hint?: string
    help?: string
    autoComplete: string
    inputMode?: 'email' | 'text'
    wide?: boolean
  }[] = [
    { id: 'business', label: t.business, autoComplete: 'organization', wide: true },
    { id: 'instagram', label: t.instagram, hint: t.instagramHint, autoComplete: 'off' },
    { id: 'city', label: t.city, autoComplete: 'address-level2' },
    {
      id: 'contact',
      label: t.contact,
      help: t.contactHint,
      autoComplete: 'email',
      inputMode: 'email',
      wide: true,
    },
  ]

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: typeof errors = {}
    for (const { id } of fields) if (!values[id].trim()) next[id] = t.required
    if (!next.contact && !isValidEmail(values.contact)) next.contact = t.invalidEmail
    if (!consent) next.consent = t.consentRequired
    setErrors(next)
    const firstInvalid = Object.keys(next)[0]
    if (firstInvalid) {
      document.getElementById(`wl-${firstInvalid}`)?.focus()
      return
    }

    setStatus({ kind: 'sending' })
    try {
      const result = await submitWaitlist({
        business: values.business.trim(),
        category: selectedCategory,
        instagram: values.instagram.trim().replace(/^@/, ''),
        email: values.contact.trim(),
        city: values.city.trim(),
        lang,
      })
      setStatus({ kind: 'done', result })
      if (result === 'sent') {
        setValues(empty)
        setConsent(false)
      }
    } catch {
      setStatus({ kind: 'failed' })
    }
  }

  const input =
    'min-h-11 w-full rounded-control border border-border bg-surface px-3.5 py-2.5 text-base text-primary placeholder:text-control focus:border-action focus:outline-2 focus:outline-offset-0 focus:outline-action/25 aria-invalid:border-danger'

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-labelledby="wl-title"
      className="flex flex-col gap-5 rounded-frame border border-border bg-surface p-5 shadow-frame sm:p-7"
    >
      <div>
        <h3 id="wl-title" className="font-heading text-xl font-semibold">
          {t.title}
        </h3>
        <p className="mt-1 text-sm text-secondary">{t.subtitle}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t.categoryLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {t.categories.map((cat, idx) => (
            <button
              key={cat}
              type="button"
              aria-pressed={categoryIdx === idx}
              onClick={() => {
                setCategoryIdx(idx)
                setUserPickedCategory(true)
              }}
              className="min-h-9 rounded-control border border-border bg-surface px-3 text-sm text-secondary transition-colors hover:border-control hover:text-primary aria-pressed:border-transparent aria-pressed:bg-band aria-pressed:font-medium aria-pressed:text-band-text"
            >
              {cat}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ id, label, hint, help, autoComplete, inputMode, wide }) => (
          <div key={id} className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
            <label htmlFor={`wl-${id}`} className="text-sm font-semibold">
              {label}
            </label>
            <input
              id={`wl-${id}`}
              name={id}
              type="text"
              autoComplete={autoComplete}
              inputMode={inputMode}
              placeholder={hint}
              value={values[id]}
              aria-invalid={errors[id] ? true : undefined}
              aria-describedby={
                [help ? `wl-${id}-help` : '', errors[id] ? `wl-${id}-error` : ''].filter(Boolean).join(' ') ||
                undefined
              }
              onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
              className={input}
            />
            {help && !errors[id] && (
              <p id={`wl-${id}-help`} className="text-xs text-secondary">
                {help}
              </p>
            )}
            {errors[id] && (
              <p id={`wl-${id}-error`} className="flex items-center gap-1.5 text-xs font-medium text-danger">
                <AlertIcon aria-hidden />
                {errors[id]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="wl-consent" className="flex items-start gap-3 text-sm leading-relaxed text-secondary">
          <input
            id="wl-consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? 'wl-consent-error' : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--an-action)]"
          />
          <span>{t.consent}</span>
        </label>
        {errors.consent && (
          <p id="wl-consent-error" className="ml-8 flex items-center gap-1.5 text-xs font-medium text-danger">
            <AlertIcon aria-hidden />
            {errors.consent}
          </p>
        )}
        {legalLinks && (
          <p className="ml-8 flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary">
            <a
              href="/privacy"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                e.preventDefault()
                legalLinks.onNavigate('privacy')
              }}
              className="underline underline-offset-4 hover:text-primary"
            >
              {legalLinks.privacy}
            </a>
            <span aria-hidden>·</span>
            <a
              href="/terms"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                e.preventDefault()
                legalLinks.onNavigate('terms')
              }}
              className="underline underline-offset-4 hover:text-primary"
            >
              {legalLinks.terms}
            </a>
            {legalLinks.kvkk && (
              <>
                <span aria-hidden>·</span>
                <a
                  href="/kvkk"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                    e.preventDefault()
                    legalLinks.onNavigate('kvkk')
                  }}
                  className="underline underline-offset-4 hover:text-primary"
                >
                  {legalLinks.kvkk}
                </a>
              </>
            )}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={status.kind === 'sending'}
        className={`${buttonPrimary} ${buttonLarge} w-full`}
      >
        {status.kind === 'sending' ? t.sending : t.submit}
      </button>

      <div aria-live="polite" className="empty:hidden">
        {status.kind === 'done' && status.result === 'sent' && (
          <p className="flex items-start gap-2 rounded-control bg-success-subtle px-3.5 py-3 text-sm text-success">
            <CheckIcon aria-hidden className="mt-0.5" />
            {t.sent}
          </p>
        )}
        {status.kind === 'done' && status.result === 'preview' && (
          <p className="flex items-start gap-2 rounded-control bg-info-subtle px-3.5 py-3 text-sm text-info">
            <AlertIcon aria-hidden className="mt-0.5" />
            {t.preview}
          </p>
        )}
        {status.kind === 'failed' && (
          <p className="flex items-start gap-2 rounded-control bg-danger-subtle px-3.5 py-3 text-sm text-danger">
            <AlertIcon aria-hidden className="mt-0.5" />
            {t.failed}
          </p>
        )}
      </div>

      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border-t border-border pt-4 text-sm font-medium text-action underline-offset-4 hover:underline"
        >
          <ChatIcon aria-hidden />
          {pilot.whatsappDirectLabel}
        </a>
      )}
    </form>
  )
}
