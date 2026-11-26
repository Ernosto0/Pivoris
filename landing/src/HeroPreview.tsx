import { useEffect, useState } from 'react'
import type { Copy, Lang } from './copy'
import type { BusinessScenario } from './scenarios'
import {
  CheckIcon,
  HandIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
} from './ui'

type Slide = {
  id: string
  time: string
  channel: string
  channelKind: 'instagram' | 'telegram'
  ask: string
  askPhoto?: boolean
  reply?: { before: string; fact?: string; after?: string; source?: string }
  // The post Pivoris drafted from the owner's photo, shown as a small cover in its reply.
  draft?: { tag: string; title: string }
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
        channelKind: 'telegram',
        ask: 'Dün gece neler oldu?',
        reply: {
          before:
            'Gece 17 mesaj geldi, 13’ünü yanıtladım. 3 soru kararınızı bekliyor.',
        },
        status: 'Günün özeti hazır',
        tone: 'success',
      },
      {
        id: 'tg-content',
        time: '08:32',
        channel: 'Telegram · Siz',
        channelKind: 'telegram',
        ask: 'Yeni akşam sınıfımız. Cuma paylaşalım mı?',
        askPhoto: true,
        reply: {
          before: 'Reels taslağı hazır: “Akşam reformer sınıfımız başladı.” Cuma 19:00’a planlayayım mı?',
        },
        draft: { tag: 'Taslak', title: 'Akşam reformer' },
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
        channelKind: 'telegram',
        ask: 'What happened last night?',
        reply: {
          before:
            '17 messages came in overnight and I answered 13. 3 questions are waiting for your decision.',
        },
        status: 'Your daily summary is ready',
        tone: 'success',
      },
      {
        id: 'tg-content',
        time: '08:32',
        channel: 'Telegram · You',
        channelKind: 'telegram',
        ask: 'Our new evening class. Post it on Friday?',
        askPhoto: true,
        reply: {
          before: 'Reels draft ready: “Evening reformer classes are here.” Shall I schedule it for Friday 19:00?',
        },
        draft: { tag: 'Draft', title: 'Evening reformer' },
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

const OWNER_PHOTO = `${import.meta.env.BASE_URL}preview/studio.jpg`

// One business's night: three customer moments on Instagram, then the owner's morning on Telegram.
function buildSlides(lang: Lang, scenario: BusinessScenario | undefined): Slide[] {
  const ui = uiText[lang]
  const night: Slide[] = (scenario?.heroEvents ?? [])
    .filter((e) => e.kind === 'dm' || e.kind === 'comment' || e.kind === 'escalate')
    .map((e) => ({
      id: e.id,
      time: e.time,
      channel: e.kind === 'comment' ? ui.instagramComment : ui.instagramDm,
      channelKind: 'instagram',
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

// Time on each step scales with what there is to read, so long answers are not cut off mid-sentence.
function slideDuration(slide: Slide): number {
  const reply = slide.reply
    ? `${slide.reply.before}${slide.reply.fact ?? ''}${slide.reply.after ?? ''}`
    : (slide.escalation ?? '')
  const chars = slide.ask.length + reply.length
  return Math.min(9500, Math.max(5600, 2000 + chars * 35))
}

// Generic channel glyphs in each network's colour, so the Instagram → Telegram hand-off reads at a glance.
function ChannelGlyph({ kind }: { kind: Slide['channelKind'] }) {
  return kind === 'instagram' ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="size-3.5 shrink-0 text-[#d62976]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.75" />
      <circle cx="17.25" cy="6.75" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="size-3.5 shrink-0 text-[#229ed9]"
      fill="currentColor"
    >
      <path d="M21.4 4.2 2.9 11.3c-.9.4-.9 1.6.1 1.9l4.6 1.4 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.5 4.7 3.5c.6.4 1.4.1 1.6-.6l3.1-14.6c.2-.9-.7-1.6-1.6-1.2Zm-4 3.6-7.6 6.9-.3 3.2-1.3-4.1 9.2-6Z" />
    </svg>
  )
}

// The Reels cover Pivoris drafted from the owner's photo.
function DraftCover({ tag, title }: { tag: string; title: string }) {
  return (
    <span aria-hidden className="relative h-[5.625rem] w-18 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/20">
      <img
        src={OWNER_PHOTO}
        alt=""
        decoding="async"
        className="absolute inset-0 size-full object-cover object-[68%_35%]"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
      <span className="absolute top-1 left-1 rounded-full bg-[#d1e4b7] px-1.5 text-[0.625rem] leading-4 font-semibold text-[#18291f]">
        {tag}
      </span>
      <PlayIcon className="absolute top-1.5 right-1.5 size-3 text-white" />
      <span className="absolute inset-x-1.5 bottom-1.5 font-heading text-[0.6875rem] leading-tight font-semibold text-white">
        {title}
      </span>
    </span>
  )
}

type LiveState = {
  thinking: boolean
  checking: string
  showSource: string
  sourceOpen: boolean
  onToggleSource: () => void
  approved: boolean
  onApprove: () => void
}

// One step of the conversation. Without `live` it renders the settled, unapproved state used for sizing.
function Conversation({ slide, live }: { slide: Slide; live?: LiveState }) {
  return (
    <div className="flex flex-col">
      <div className="flex max-w-[85%] items-start gap-3 self-start rounded-2xl rounded-bl-sm bg-surface-subtle px-4 py-3 text-base leading-relaxed sm:px-5 sm:text-[1.0625rem]">
        {slide.askPhoto && (
          // The photo the owner sends: bundled local studio photography, portrait like a Reels cover.
          <img
            src={OWNER_PHOTO}
            alt=""
            width={72}
            height={90}
            decoding="async"
            className="h-[5.625rem] w-18 shrink-0 rounded-lg object-cover object-[62%_center] ring-1 ring-black/5"
          />
        )}
        <span className="min-w-0">{slide.ask}</span>
      </div>

      {live?.thinking ? (
        <div className="mt-5 ml-auto flex items-center gap-2 rounded-2xl rounded-br-sm bg-assistant px-4 py-3.5 text-sm font-medium text-action">
          <span className="inline-flex gap-1" aria-hidden>
            <span className="typing-dot size-1.5 rounded-full bg-action" />
            <span className="typing-dot typing-dot-2 size-1.5 rounded-full bg-action" />
            <span className="typing-dot typing-dot-3 size-1.5 rounded-full bg-action" />
          </span>
          {live.checking}
        </div>
      ) : slide.escalation ? (
        <p className="pop-in mt-5 flex gap-3 rounded-panel border border-attention/35 bg-attention-subtle/75 p-4 text-base leading-relaxed text-secondary sm:p-5">
          <HandIcon className="mt-1 size-5 shrink-0 text-attention" />
          {slide.escalation}
        </p>
      ) : slide.reply ? (
        <div className="pop-in mt-5">
          <div className="ml-8 flex items-start gap-3 rounded-2xl rounded-br-sm bg-action px-4 py-3 text-base leading-relaxed text-on-action sm:ml-12 sm:px-5 sm:text-[1.0625rem]">
            {slide.draft && <DraftCover tag={slide.draft.tag} title={slide.draft.title} />}
            <span className="min-w-0">
              {slide.reply.before}
              {slide.reply.fact &&
                (live ? (
                  <button
                    type="button"
                    aria-label={`${live.showSource}: ${slide.reply.fact}`}
                    aria-expanded={live.sourceOpen}
                    aria-controls="hero-reply-source"
                    onClick={live.onToggleSource}
                    className="source-fact"
                  >
                    {slide.reply.fact}
                  </button>
                ) : (
                  <span className="source-fact">{slide.reply.fact}</span>
                ))}
              {slide.reply.after}
            </span>
          </div>
          {slide.approve && !live?.approved && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={live?.onApprove}
                className="inline-flex min-h-11 items-center gap-2 rounded-control border border-control bg-surface px-5 text-base font-semibold text-action transition-colors hover:bg-surface-subtle"
              >
                <CheckIcon className="size-4" />
                {slide.approve.label}
              </button>
            </div>
          )}
          {live?.sourceOpen && slide.reply.source && (
            <p
              id="hero-reply-source"
              className="source-record pop-in mt-3 flex items-center gap-2 bg-fact text-sm font-medium text-on-fact"
            >
              <ShieldCheckIcon className="size-4 shrink-0" />
              <span>
                {slide.reply.source} · {slide.reply.fact}
              </span>
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
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

  // Warm the owner's photo so it does not pop in when its step comes round.
  useEffect(() => {
    new Image().src = OWNER_PHOTO
  }, [])

  useEffect(() => {
    setStep(0)
    setSourceOpen(false)
    setApproved(false)
  }, [lang])

  const duration = slideDuration(current)
  const advancing = playing && !sourceOpen

  // Auto-advance while playing, unless the visitor is reading the source.
  useEffect(() => {
    if (!advancing) return
    const timer = window.setTimeout(() => {
      setStep((prev) => (prev + 1) % slides.length)
      setApproved(false)
      setThinking(true)
    }, duration)
    return () => window.clearTimeout(timer)
  }, [advancing, duration, step, slides.length])

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
            <div className="flex items-start justify-between gap-3">
              <p className="font-heading text-4xl font-semibold tabular-nums sm:text-[2.75rem] sm:leading-none">{current.time}</p>
              {/* Simulated badge: everything in this card is an illustration. */}
              <span className="mt-1 shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-secondary">
                {ui.example}
              </span>
            </div>
            <p className="mt-2.5 text-sm">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-subtle py-0.5 pr-2.5 pl-2 font-medium text-primary">
                <ChannelGlyph kind={current.channelKind} />
                <span className="truncate">{current.channel}</span>
              </span>
            </p>
          </div>
        </div>

        {/* Conversation: grey asks, green is Pivoris. Every step is laid out invisibly in the same
            cell, so the card keeps the height of its tallest step and the page never jumps. */}
        <div className="grid px-5 pt-6 pb-1 sm:px-7">
          {slides.map((slide) => (
            <div key={`size-${slide.id}`} aria-hidden inert className="invisible col-start-1 row-start-1">
              <Conversation slide={slide} />
            </div>
          ))}
          <div key={current.id} className="pop-in col-start-1 row-start-1 min-w-0">
            <Conversation
              slide={current}
              live={{
                thinking,
                checking: ui.checking,
                showSource: t.showSource,
                sourceOpen,
                onToggleSource: () => setSourceOpen((o) => !o),
                approved,
                onApprove: () => setApproved(true),
              }}
            />
          </div>
        </div>

        {/* Footer: one outcome, then the tour controls. */}
        <div className="flex items-center justify-between gap-3 px-5 pt-2 pb-5 sm:px-7 sm:pb-6">
          <p aria-live="polite" className="flex min-h-8 min-w-0 items-center text-xs font-medium sm:min-h-6 sm:text-sm">
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
                {i === step ? (
                  // The active step fills while it plays, so visitors can see when the next one comes.
                  <span className="block h-1.5 w-6 overflow-hidden rounded-full bg-border">
                    <span
                      key={`${step}-${advancing}`}
                      className={`block size-full rounded-full bg-action ${advancing ? 'hero-progress' : ''}`}
                      style={advancing ? { animationDuration: `${duration}ms` } : undefined}
                    />
                  </span>
                ) : (
                  <span className="block h-1.5 w-1.5 rounded-full bg-border transition-colors group-hover:bg-secondary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
