import { useEffect, useState } from 'react'
import type { Copy, Lang } from './copy'
import { PhoneFrame } from './PhoneFrame'
import type { BusinessScenario } from './scenarios'
import { Badge, BookIcon, CheckIcon, HandIcon, QuestionIcon, RotateIcon, ShieldCheckIcon } from './ui'

const teachCopy = {
  tr: {
    teachButton: 'Bu yanıtı öğret ve kaydet',
    savedBadge: 'Yeni bilgi kartı doğrulandı',
    redrafted: 'Asistan öğrendiği bilgiyle yanıtı hazırladı:',
    replay: 'Baştan dene',
    validatorLabel: 'Fiyat, doğrulanmış bilgi kartından alındı',
  },
  en: {
    teachButton: 'Teach this answer & save fact',
    savedBadge: 'New fact card verified',
    redrafted: 'Assistant immediately drafted a grounded reply:',
    replay: 'Try again',
    validatorLabel: 'Price checked against the verified fact card',
  },
} as const

export function DraftDemo({
  t,
  lang,
  scenario,
}: {
  t: Copy['demo']
  lang: Lang
  scenario: BusinessScenario
}) {
  const [tab, setTab] = useState(0)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [taught, setTaught] = useState(false)

  const demo = scenario.draftDemo
  const ui = teachCopy[lang]

  useEffect(() => {
    setSourceOpen(false)
    setTaught(false)
  }, [scenario.id, lang])

  const customer = tab === 0 ? demo.knownCustomer : demo.unknownCustomer
  const time = tab === 0 ? demo.knownTime : demo.unknownTime
  const message = tab === 0 ? demo.knownQuestion : demo.unknownQuestion

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        role="group"
        aria-label={t.title}
        className="flex flex-wrap justify-center gap-1 rounded-panel border border-border bg-surface p-1"
      >
        {t.tabs.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={tab === i}
            onClick={() => {
              setTab(i)
              setSourceOpen(false)
            }}
            className="min-h-11 rounded-control px-4 text-sm font-semibold text-secondary transition-colors hover:text-primary aria-pressed:bg-band aria-pressed:text-band-text"
          >
            {label}
          </button>
        ))}
      </div>

      <PhoneFrame label={t.example} clock={time}>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-assistant text-sm font-semibold text-action"
          >
            {customer.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{customer}</p>
            <p className="text-xs text-secondary">
              {t.channel} · {scenario.handle}
            </p>
          </div>
        </div>

        <div key={`${scenario.id}-${tab}`} className="pop-in flex min-h-[27rem] flex-col gap-4 bg-canvas p-4">
          <p className="max-w-[90%] self-start rounded-2xl rounded-bl-sm border border-border bg-surface p-3 text-[0.9375rem] leading-relaxed">
            {message}
          </p>

          {tab === 0 ? (
            <>
              <p className="mt-3 self-end text-xs font-semibold text-action">{t.known.draftLabel}</p>
              <p className="max-w-[92%] self-end rounded-2xl rounded-br-sm bg-action p-3 text-[0.9375rem] leading-relaxed text-on-action">
                {demo.knownPrefix}
                <button
                  type="button"
                  aria-expanded={sourceOpen}
                  aria-controls="demo-reply-source"
                  onClick={() => setSourceOpen(!sourceOpen)}
                  className="source-fact"
                >
                  {demo.knownFactValue}
                </button>
                {demo.knownSuffix}
              </p>
              <p className="flex items-center justify-end gap-1 text-xs font-semibold text-success">
                <CheckIcon className="size-4" />
                {t.known.sent}
              </p>
              <p className="text-right text-xs text-secondary">{t.known.hint}</p>

              <div className="mt-auto rounded-panel border border-border bg-surface p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-action">
                  <ShieldCheckIcon className="size-4 shrink-0" />
                  {ui.validatorLabel}
                </p>
                {sourceOpen && (
                  <p id="demo-reply-source" className="source-record pop-in mt-2 bg-fact text-xs text-on-fact">
                    {demo.knownFactSource}
                  </p>
                )}
              </div>
            </>
          ) : !taught ? (
            <>
              <div className="rounded-panel border border-attention/35 bg-surface p-4">
                <Badge tone="attention" size="sm" icon={<HandIcon />}>
                  {t.unknown.badge}
                </Badge>
                <p className="mt-3 text-sm leading-relaxed text-primary">{t.unknown.body}</p>
              </div>

              <div className="rounded-panel border border-border bg-assistant p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-action">
                  <QuestionIcon className="size-4" />
                  {t.unknown.questionLabel}
                </p>
                <p className="mt-2 text-sm leading-relaxed font-medium">{demo.assistantAsk}</p>

                <button
                  type="button"
                  onClick={() => setTaught(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-control bg-action px-4 py-2.5 text-xs font-semibold text-on-action transition-colors hover:bg-action-hover"
                >
                  <BookIcon className="size-4" />
                  {ui.teachButton}
                </button>
                <p className="mt-2 text-xs leading-snug text-secondary">“{demo.quickOwnerAnswer}”</p>
              </div>
            </>
          ) : (
            <div className="pop-in flex flex-1 flex-col gap-3">
              <div className="domino-pulse rounded-panel border border-success/40 bg-success-subtle p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="success" size="sm" icon={<CheckIcon />}>
                    {ui.savedBadge}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-secondary">
                  {demo.savedFactCategory} · {demo.savedFactLabel}
                </p>
                <p className="font-heading text-sm font-semibold text-primary">{demo.savedFactValue}</p>
              </div>

              <p className="self-end text-xs font-semibold text-action">{ui.redrafted}</p>
              <p className="max-w-[92%] self-end rounded-2xl rounded-br-sm bg-action p-3 text-sm leading-relaxed text-on-action">
                {demo.learnedReply}
              </p>

              <button
                type="button"
                onClick={() => setTaught(false)}
                className="mt-auto inline-flex items-center justify-center gap-1.5 self-center rounded-control border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-secondary hover:text-primary"
              >
                <RotateIcon className="size-4" />
                {ui.replay}
              </button>
            </div>
          )}
        </div>
      </PhoneFrame>
    </div>
  )
}
