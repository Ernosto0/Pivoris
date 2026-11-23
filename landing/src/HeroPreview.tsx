import { useEffect, useState } from 'react'
import { Brand } from './BrandIdentity'
import type { Copy, Lang } from './copy'
import type { BusinessScenario } from './scenarios'
import { AnimatedNumber } from './ScrollReveal'
import {
  Badge,
  BookIcon,
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  ExampleLabel,
  GlobeIcon,
  HandIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
} from './ui'

const uiText = {
  tr: {
    liveShift: '23:47 · Gece nöbeti simülasyonu',
    checking: 'Doğrulanmış bilgi kartları kontrol ediliyor…',
    pause: 'Duraklat',
    play: 'Oynat',
    stepLabels: ['Fiyat sorusu', 'Yorum → DM', '5 dil', 'Size iletilen'],
    verifiedGuard: 'İşletme bilgileriyle doğrulandı',
    shieldGuard: 'Güvenlik kapısı · Tahmin engellendi',
  },
  en: {
    liveShift: '23:47 · Night-shift simulation',
    checking: 'Checking verified fact cards…',
    pause: 'Pause',
    play: 'Play',
    stepLabels: ['Price enquiry', 'Comment → DM', '5 languages', 'Your decision'],
    verifiedGuard: 'Checked against business facts',
    shieldGuard: 'Safety gate · Guessing blocked',
  },
} as const

// Illustrative simulated outcomes, never a live connection or a real customer send.
export function HeroPreview({
  t,
  lang,
  scenario,
}: {
  t: Copy['preview']
  lang: Lang
  scenario: BusinessScenario
}) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(
    () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  const [thinking, setThinking] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)

  const ui = uiText[lang]
  const events = scenario.heroEvents
  const current = events[step] ?? events[0]

  // Reset cleanly when the visitor switches business vertical.
  useEffect(() => {
    setStep(0)
    setSourceOpen(false)
    setThinking(true)
    const timer = window.setTimeout(() => setThinking(false), 550)
    return () => window.clearTimeout(timer)
  }, [scenario.id, lang])

  // Auto-advance the simulation while playing (unless the visitor opened the source drawer).
  useEffect(() => {
    if (!playing || sourceOpen) return
    const timer = window.setInterval(() => {
      setStep((prev) => (prev + 1) % events.length)
      setSourceOpen(false)
      setThinking(true)
    }, 5200)
    return () => window.clearInterval(timer)
  }, [playing, sourceOpen, events.length])

  // Brief realistic claim-check pulse whenever step changes.
  useEffect(() => {
    if (!thinking) return
    const timer = window.setTimeout(() => setThinking(false), 620)
    return () => window.clearTimeout(timer)
  }, [thinking, step])

  const selectStep = (next: number) => {
    setStep(next)
    setSourceOpen(false)
    setThinking(true)
  }

  return (
    <figure className="relative mx-auto w-full min-w-0 max-w-[37rem] lg:mr-0">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-secondary">
          <span
            key={`${scenario.id}-${step}-${playing}`}
            aria-hidden
            className={`size-1.5 rounded-full bg-success ${playing ? 'live-ping' : 'opacity-40'}`}
          />
          {ui.liveShift}
        </span>
        <div className="flex items-center gap-2">
          <ExampleLabel>{t.example}</ExampleLabel>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? ui.pause : ui.play}
            className="inline-flex min-h-8 items-center gap-2 rounded-control border border-border bg-surface px-3 text-xs font-medium text-secondary transition-colors hover:border-control hover:text-primary"
          >
            {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
            {playing ? ui.pause : ui.play}
          </button>
        </div>
      </figcaption>

      <div className="relative overflow-hidden rounded-frame border border-border bg-surface shadow-frame">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
          <Brand variant="monogram" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-base font-semibold">{scenario.brandName}</p>
            <p className="truncate text-xs text-secondary">
              {scenario.handle} · {t.date}
            </p>
          </div>
          <div className="text-right">
            <Badge tone="brand" size="sm">
              Full Auto
            </Badge>
            <p className="mt-1 text-xs text-secondary">{t.screen}</p>
          </div>
        </div>

        {/* Step selector pills */}
        <div
          role="group"
          aria-label={ui.liveShift}
          className="grid grid-cols-2 gap-1 border-b border-border bg-canvas p-2 sm:grid-cols-4"
        >
          {ui.stepLabels.map((label, i) => {
            const active = i === step
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => selectStep(i)}
                className={`relative min-h-9 rounded-control px-2 py-2 text-center text-xs font-medium transition-colors ${
                  active
                    ? 'bg-surface-subtle text-primary ring-1 ring-inset ring-border'
                    : 'text-secondary hover:bg-surface hover:text-primary'
                }`}
              >
                <span className="block truncate">{label}</span>
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="bg-canvas p-4 sm:p-5">
          {/* Animated live metrics */}
          <dl className="grid grid-cols-3 gap-2">
            {t.metrics.map((label, i) => (
              <div
                key={label}
                className="rounded-control border border-border bg-surface p-3"
              >
                <dd
                  className={`font-heading text-2xl font-semibold tabular-nums sm:text-3xl ${
                    i === 1 ? 'text-action' : i === 2 && current.kind === 'escalate' ? 'text-attention' : 'text-primary'
                  }`}
                >
                  <AnimatedNumber value={current.metrics[i]} />
                </dd>
                <dt className="mt-0.5 text-xs leading-snug text-secondary">{label}</dt>
              </div>
            ))}
          </dl>

          {/* Active live conversation card */}
          <div
            key={`${scenario.id}-${current.id}`}
            className="pop-in relative mt-4 min-h-[16rem] overflow-hidden rounded-panel border border-border bg-surface p-4 sm:p-5"
          >
            {/* Channel & timestamp row */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-secondary">
              <span className="inline-flex items-center gap-2 text-secondary">
                {current.kind === 'multilingual' ? (
                  <GlobeIcon className="size-4 text-action" />
                ) : current.kind === 'escalate' ? (
                  <HandIcon className="size-4 text-attention" />
                ) : (
                  <ChatIcon className="size-4 text-action" />
                )}
                {current.channelBadge}
              </span>
              <span className="truncate font-semibold text-primary">@{current.customer}</span>
              {current.langTag && (
                <Badge tone="info" size="sm">
                  {current.langTag}
                </Badge>
              )}
              <span className="ml-auto tabular-nums">{current.time}</span>
            </div>

            {current.incomingMeta && (
              <p className="mt-2 text-xs text-secondary">{current.incomingMeta}</p>
            )}

            {/* Incoming customer bubble */}
            <p
              dir={current.dir}
              className="mt-3 max-w-[92%] rounded-2xl rounded-bl-sm bg-surface-subtle px-4 py-2.5 text-[0.9375rem] leading-relaxed"
            >
              {current.incoming}
            </p>

            {/* Processing / Claim-Validator state vs Result */}
            {thinking ? (
              <div className="mt-4 ml-auto flex max-w-[85%] flex-col items-end gap-2">
                <div className="relative overflow-hidden rounded-2xl rounded-br-sm border border-border bg-assistant px-4 py-3">
                  <span
                    aria-hidden
                    className="scan-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-action/15 to-transparent"
                  />
                  <div className="relative flex items-center gap-2 text-xs font-medium text-action">
                    <span className="inline-flex gap-1" aria-hidden>
                      <span className="typing-dot size-1.5 rounded-full bg-action" />
                      <span className="typing-dot typing-dot-2 size-1.5 rounded-full bg-action" />
                      <span className="typing-dot typing-dot-3 size-1.5 rounded-full bg-action" />
                    </span>
                    {ui.checking}
                  </div>
                </div>
              </div>
            ) : current.kind === 'escalate' ? (
              <div className="pop-in mt-4 rounded-panel border border-attention/35 bg-attention-subtle/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="attention" size="sm" icon={<HandIcon />}>
                    {current.statusBadge}
                  </Badge>
                  <span className="text-xs font-medium text-attention">{ui.shieldGuard}</span>
                </div>
                <p className="mt-2 font-heading text-sm font-semibold text-primary">{current.escalationTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-secondary">{current.escalationBody}</p>
              </div>
            ) : (
              <div className="pop-in mt-3.5">
                <div
                  dir={current.dir}
                  className="ml-4 rounded-2xl rounded-br-sm bg-action px-4 py-2.5 text-[0.9375rem] leading-relaxed text-on-action sm:ml-6"
                >
                  {current.replyBefore}
                  {current.factValue && (
                    <button
                      type="button"
                      aria-label={`${t.showSource}: ${current.factValue}`}
                      aria-expanded={sourceOpen}
                      aria-controls="hero-reply-source"
                      onClick={() => setSourceOpen((o) => !o)}
                      className="source-fact"
                    >
                      {current.factValue}
                    </button>
                  )}
                  {current.replyAfter}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-expanded={sourceOpen}
                    aria-controls="hero-reply-source"
                    onClick={() => setSourceOpen((o) => !o)}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-control text-xs font-semibold text-action hover:underline"
                  >
                    <BookIcon className="size-4" />
                    {sourceOpen ? t.hideSource : t.showSource}
                  </button>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                    <CheckIcon className="size-4" />
                    {current.statusBadge}
                  </span>
                </div>

                {sourceOpen && current.sourceLabel && (
                  <p
                    id="hero-reply-source"
                    className="source-record pop-in mt-3 flex items-center gap-2 bg-fact text-xs font-medium text-on-fact"
                  >
                    <ShieldCheckIcon className="size-4 shrink-0" />
                    <span>
                      {current.sourceLabel} · {current.factValue}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bottom status rail */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheckIcon className="size-4 text-action" />
              {current.kind === 'escalate' ? ui.shieldGuard : ui.verifiedGuard}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-4" />
              {t.queueCounts[2]} · {t.queue[2]}
            </span>
          </div>
        </div>
      </div>
    </figure>
  )
}
