import { useEffect, useState } from 'react'
import type { Copy, Lang } from './copy'
import type { BusinessScenario } from './scenarios'
import {
  CheckIcon,
  HandIcon,
  ImageIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
} from './ui'

type Slide = {
  id: string
  time: string
  channel: string
  ask: string
  askPhoto?: boolean
  reply?: { before: string; fact?: string; after?: string; source?: string }
  escalation?: string
  approve?: { label: string; pending: string; done: string }
  status: string
  tone: 'success' | 'attention'
}

const uiText = {
  tr: {
    label: 'Bir gecelik örnek: Instagram ve Telegram',
    example: 'Örnek',
    checking: 'Doğrulanmış bilgiler kontrol ediliyor…',
    pause: 'Örneği duraklat',
    play: 'Örneği oynat',
    goTo: 'Adıma git',
    instagramDm: 'Instagram DM',
    instagramComment: 'Instagram yorumu → özel mesaj',
    morning: [
      {
        id: 'tg-summary',
        time: '08:30',
        channel: 'Telegram · Siz',
        ask: 'Dün gece neler oldu?',
        reply: {
          before:
            'Gece 17 mesaj geldi, 13’ünü yanıtladım. 3 soru sizi bekliyor; biri hamile pilatesi hakkında.',
        },
        status: 'Günün özeti hazır',
        tone: 'success',
      },
      {
        id: 'tg-content',
        time: '08:32',
        channel: 'Telegram · Siz',
        ask: 'Yeni akşam sınıfımız. Cuma paylaşalım mı?',
        askPhoto: true,
        reply: {
          before: 'Reels taslağı hazır: “Akşam reformer sınıfımız başladı.” Cuma 19:00’a planlayayım mı?',
        },
        approve: {
          label: 'Onayla',
          pending: 'Onayınız olmadan paylaşılmaz',
          done: 'Onaylandı · Cuma 19:00’a planlandı',
        },
        status: '',
        tone: 'success',
      },
    ],
  },
  en: {
    label: 'One night, as an example: Instagram and Telegram',
    example: 'Example',
    checking: 'Checking verified details…',
    pause: 'Pause example',
    play: 'Play example',
    goTo: 'Go to step',
    instagramDm: 'Instagram DM',
    instagramComment: 'Instagram comment → DM',
    morning: [
      {
        id: 'tg-summary',
        time: '08:30',
        channel: 'Telegram · You',
        ask: 'What happened last night?',
        reply: {
          before:
            '17 messages came in overnight and I answered 13. 3 questions are waiting for you, one about prenatal Pilates.',
        },
        status: 'Your daily summary is ready',
        tone: 'success',
      },
      {
        id: 'tg-content',
        time: '08:32',
        channel: 'Telegram · You',
        ask: 'Our new evening class. Post it on Friday?',
        askPhoto: true,
        reply: {
          before: 'Reels draft ready: “Evening reformer classes are here.” Shall I schedule it for Friday 19:00?',
        },
        approve: {
          label: 'Approve',
          pending: 'Nothing is posted without your approval',
          done: 'Approved · Scheduled for Friday 19:00',
        },
        status: '',
        tone: 'success',
      },
    ],
  },
} as const satisfies Record<Lang, unknown>

// One business's night: three customer moments on Instagram, then the owner's morning on Telegram.
function buildSlides(lang: Lang, scenario: BusinessScenario | undefined): Slide[] {
  const ui = uiText[lang]
  const night: Slide[] = (scenario?.heroEvents ?? [])
    .filter((e) => e.kind === 'dm' || e.kind === 'comment' || e.kind === 'escalate')
    .map((e) => ({
      id: e.id,
      time: e.time,
      channel: e.kind === 'comment' ? ui.instagramComment : ui.instagramDm,
      ask: e.incoming,
      reply:
        e.kind === 'escalate'
          ? undefined
          : { before: e.replyBefore ?? '', fact: e.factValue, after: e.replyAfter, source: e.sourceLabel },
      escalation: e.kind === 'escalate' ? e.escalationBody : undefined,
      status: e.statusBadge,
      tone: e.kind === 'escalate' ? 'attention' : 'success',
    }))
  return [...night, ...ui.morning]
}

// Illustrative simulated outcomes, never a live connection or a real customer send.
export function HeroPreview({
  t,
  lang,
  scenarios,
}: {
  t: Copy['preview']
  lang: Lang
  scenarios: BusinessScenario[]
}) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(
    () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  const [thinking, setThinking] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [approved, setApproved] = useState(false)

  const ui = uiText[lang]
  const slides = buildSlides(lang, scenarios.find((s) => s.id === 'pilates') ?? scenarios[0])
  const current = slides[step % slides.length]

  useEffect(() => {
    setStep(0)
    setSourceOpen(false)
    setApproved(false)
  }, [lang])

  // Auto-advance while playing, unless the visitor is reading the source.
  useEffect(() => {
    if (!playing || sourceOpen) return
    const timer = window.setInterval(() => {
      setStep((prev) => (prev + 1) % slides.length)
      setApproved(false)
      setThinking(true)
    }, 5600)
    return () => window.clearInterval(timer)
  }, [playing, sourceOpen, slides.length])

  // Brief check pulse before each reply appears.
  useEffect(() => {
    if (!thinking) return
    const timer = window.setTimeout(() => setThinking(false), 900)
    return () => window.clearTimeout(timer)
  }, [thinking, step])

  const selectStep = (next: number) => {
    setStep(next)
    setSourceOpen(false)
    setApproved(false)
    setThinking(true)
  }

  const status = current.approve ? (approved ? current.approve.done : current.approve.pending) : current.status
  const statusTone = current.approve && !approved ? 'pending' : current.tone

  return (
    <figure aria-label={ui.label} className="relative mx-auto w-full min-w-0 max-w-[34rem] lg:mr-0">
      <div className="relative overflow-hidden rounded-frame border border-border bg-surface shadow-frame">
        {/* Header: the time and channel tell the story; the simulated label rides on the channel line. */}
        <div className="px-5 pt-5 sm:px-7 sm:pt-7">
          <div key={`${current.id}-head`} className="pop-in min-w-0">
            <p className="font-heading text-4xl font-semibold tabular-nums sm:text-[2.75rem] sm:leading-none">{current.time}</p>
            <p className="mt-2 text-sm text-secondary">
              {current.channel} · {ui.example}
            </p>
          </div>
        </div>

        {/* Conversation: grey asks, green is Pivoris. */}
        <div key={current.id} className="pop-in flex min-h-[17rem] flex-col px-5 pt-6 pb-1 sm:min-h-[19rem] sm:px-7">
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-subtle px-4 py-3 text-base leading-relaxed sm:px-5 sm:text-[1.0625rem]">
            {current.askPhoto && (
              <span
                aria-hidden
                className="mb-2.5 grid h-24 w-40 place-items-center rounded-lg bg-assistant text-3xl text-action"
              >
                <ImageIcon />
              </span>
            )}
            {current.ask}
          </div>

          {thinking ? (
            <div className="mt-5 ml-auto flex items-center gap-2 rounded-2xl rounded-br-sm bg-assistant px-4 py-3.5 text-sm font-medium text-action">
              <span className="inline-flex gap-1" aria-hidden>
                <span className="typing-dot size-1.5 rounded-full bg-action" />
                <span className="typing-dot typing-dot-2 size-1.5 rounded-full bg-action" />
                <span className="typing-dot typing-dot-3 size-1.5 rounded-full bg-action" />
              </span>
              {ui.checking}
            </div>
          ) : current.escalation ? (
            <p className="pop-in mt-5 flex gap-3 rounded-panel border border-attention/35 bg-attention-subtle/75 p-4 text-base leading-relaxed text-secondary sm:p-5">
              <HandIcon className="mt-1 size-5 shrink-0 text-attention" />
              {current.escalation}
            </p>
          ) : current.reply ? (
            <div className="pop-in mt-5">
              <div className="ml-8 rounded-2xl rounded-br-sm bg-action px-4 py-3 text-base leading-relaxed text-on-action sm:ml-12 sm:px-5 sm:text-[1.0625rem]">
                {current.reply.before}
                {current.reply.fact && (
                  <button
                    type="button"
                    aria-label={`${t.showSource}: ${current.reply.fact}`}
                    aria-expanded={sourceOpen}
                    aria-controls="hero-reply-source"
                    onClick={() => setSourceOpen((o) => !o)}
                    className="source-fact"
                  >
                    {current.reply.fact}
                  </button>
                )}
                {current.reply.after}
              </div>
              {current.approve && !approved && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setApproved(true)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-control border border-control bg-surface px-5 text-base font-semibold text-action transition-colors hover:bg-surface-subtle"
                  >
                    <CheckIcon className="size-4" />
                    {current.approve.label}
                  </button>
                </div>
              )}
              {sourceOpen && current.reply.source && (
                <p
                  id="hero-reply-source"
                  className="source-record pop-in mt-3 flex items-center gap-2 bg-fact text-sm font-medium text-on-fact"
                >
                  <ShieldCheckIcon className="size-4 shrink-0" />
                  <span>
                    {current.reply.source} · {current.reply.fact}
                  </span>
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer: one outcome, then the tour controls. */}
        <div className="flex items-center justify-between gap-3 px-5 pt-2 pb-5 sm:px-7 sm:pb-6">
          <p aria-live="polite" className="flex min-h-6 min-w-0 items-center text-xs font-medium sm:text-sm">
            {thinking ? null : (
              <span
                className={`inline-flex items-center gap-1.5 ${
                  statusTone === 'attention'
                    ? 'text-attention'
                    : statusTone === 'pending'
                      ? 'text-secondary'
                      : 'text-success'
                }`}
              >
                {statusTone === 'attention' ? (
                  <HandIcon className="size-4 shrink-0" />
                ) : statusTone === 'pending' ? null : (
                  <CheckIcon className="size-4 shrink-0" />
                )}
                {status}
              </span>
            )}
          </p>
          <div role="group" aria-label={ui.label} className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? ui.pause : ui.play}
              title={playing ? ui.pause : ui.play}
              className="mr-1 grid size-7 place-items-center rounded-control text-secondary transition-colors hover:bg-surface-subtle hover:text-primary"
            >
              {playing ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
            </button>
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`${ui.goTo} ${i + 1}: ${slide.time}`}
                aria-pressed={i === step}
                onClick={() => selectStep(i)}
                className="group grid size-6 place-items-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    i === step ? 'w-4 bg-action' : 'w-1.5 bg-border group-hover:bg-secondary'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
