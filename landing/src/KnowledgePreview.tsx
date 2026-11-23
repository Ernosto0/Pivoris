import { useEffect, useState } from 'react'
import type { Copy, Lang } from './copy'
import type { BusinessScenario } from './scenarios'
import {
  AlertIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  Badge,
  CheckIcon,
  ExampleLabel,
  RotateIcon,
  ShieldCheckIcon,
  buttonSecondary,
} from './ui'

const INITIAL = [true, true, false, false]

const extraCopy = {
  tr: {
    verifyAll: 'Tümünü doğrula',
    allReady: 'Tüm kartlar doğrulandı ve kullanıma hazır',
    hoverHint: 'Bir bilgi seçin veya kartın üzerine gelerek kaynağını görün',
  },
  en: {
    verifyAll: 'Verify all',
    allReady: 'All cards verified and ready to use',
    hoverHint: 'Select a fact or hover a card to trace its source',
  },
} as const

export function KnowledgePreview({
  t,
  lang,
  example,
  scenario,
}: {
  t: Copy['knowledge']
  lang: Lang
  example: string
  scenario: BusinessScenario
}) {
  const [verified, setVerified] = useState<boolean[]>(INITIAL)
  const [activeFact, setActiveFact] = useState<number | null>(null)
  const ui = extraCopy[lang]

  useEffect(() => {
    setVerified(INITIAL)
    setActiveFact(null)
  }, [scenario.id])

  const facts = scenario.knowledge.facts
  const done = verified.filter(Boolean).length
  const progress = t.progress.replace('{n}', String(done)).replace('{total}', String(verified.length))

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.88fr)_auto_minmax(0,1.12fr)] lg:gap-6">
      <figure className="rounded-panel border border-dashed border-control/50 bg-surface p-5">
        <figcaption className="flex items-center justify-between gap-2">
          <span className="type-eyebrow text-secondary">{t.pasteLabel}</span>
          <ExampleLabel>{example}</ExampleLabel>
        </figcaption>

        <p className="mt-3 text-base leading-relaxed">
          “
          {scenario.knowledge.pasteSegments.map((seg, idx) => {
            if (seg.factIndex === undefined) {
              return <span key={idx}>{seg.text}</span>
            }
            const isVerified = verified[seg.factIndex]
            const isHighlighted = activeFact === seg.factIndex
            return (
              <button
                key={idx}
                type="button"
                aria-pressed={isHighlighted}
                onClick={() => setActiveFact(seg.factIndex ?? null)}
                onFocus={() => setActiveFact(seg.factIndex ?? null)}
                onBlur={() => setActiveFact(null)}
                onMouseEnter={() => setActiveFact(seg.factIndex ?? null)}
                onMouseLeave={() => setActiveFact(null)}
                className={`cursor-pointer rounded px-1 py-0.5 font-semibold transition-colors ${
                  isHighlighted
                    ? 'bg-action text-on-action'
                    : isVerified
                      ? 'bg-fact text-on-fact'
                      : 'bg-attention-subtle text-attention'
                }`}
              >
                {seg.text}
              </button>
            )
          })}
          ”
        </p>

        <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-secondary">
          <AlertIcon aria-hidden className="shrink-0 text-attention" />
          {t.pasteNote}
        </p>
        <p className="mt-2 text-xs text-secondary">{ui.hoverHint}</p>
      </figure>

      <span aria-hidden className="grid place-items-center text-xl text-control lg:pt-24">
        <ArrowDownIcon className="lg:hidden" />
        <ArrowRightIcon className="hidden lg:block" />
      </span>

      <div className="overflow-hidden rounded-panel border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <span className="font-heading text-sm font-semibold">{t.ledgerTitle}</span>
          <span className="flex items-center gap-3">
            <span aria-live="polite" className="text-xs font-medium text-secondary tabular-nums">
              {progress}
            </span>
            <span aria-hidden className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-subtle">
              <span
                className="block h-full origin-left rounded-full bg-action transition-transform duration-300"
                style={{ transform: `scaleX(${done / verified.length})` }}
              />
            </span>
          </span>
        </div>

        <ul className="divide-y divide-border">
          {facts.map((fact, i) => (
            <li
              key={`${scenario.id}-${fact.label}`}
              onMouseEnter={() => setActiveFact(i)}
              onMouseLeave={() => setActiveFact(null)}
              onFocusCapture={() => setActiveFact(i)}
              onBlurCapture={() => setActiveFact(null)}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors ${
                activeFact === i ? 'bg-assistant/65' : ''
              }`}
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-xs text-secondary">
                  {fact.category} · {fact.label}
                </span>
                <span className="mt-0.5 font-heading text-base font-semibold tabular-nums">{fact.value}</span>
              </div>
              {verified[i] ? (
                <Badge tone="success" size="sm" icon={<CheckIcon />} className="pop-in">
                  {t.verified}
                </Badge>
              ) : (
                <span className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                  <Badge tone="attention" size="sm">
                    {t.unverified}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setVerified((v) => v.map((x, j) => (j === i ? true : x)))}
                    aria-label={`${t.verify}: ${fact.label}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-control bg-action px-3 text-xs font-semibold text-on-action transition-colors hover:bg-action-hover"
                  >
                    <CheckIcon aria-hidden />
                    {t.verify}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-subtle px-5 py-3">
          <p className="text-xs text-secondary">
            {done === verified.length ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                <ShieldCheckIcon className="size-4" />
                {ui.allReady}
              </span>
            ) : (
              t.usageNote
            )}
          </p>
          {done < verified.length ? (
            <button
              type="button"
              onClick={() => setVerified(verified.map(() => true))}
              className={`${buttonSecondary} min-h-8 px-3 text-xs`}
            >
              <CheckIcon aria-hidden className="size-4" />
              {ui.verifyAll}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setVerified(INITIAL)}
              className={`${buttonSecondary} min-h-8 px-3 text-xs`}
            >
              <RotateIcon aria-hidden className="size-4" />
              {t.reset}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
