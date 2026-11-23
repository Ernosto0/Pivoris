import { useEffect, useState } from 'react'
import { Brand } from './BrandIdentity'
import type { ChatMessage, Copy, Lang } from './copy'
import { PhoneFrame } from './PhoneFrame'
import { CheckIcon, ImageIcon, SendIcon, ShieldCheckIcon } from './ui'

type Command = Copy['owner']['commands'][number]

const receiptText = {
  tr: {
    approved: 'Onaylandı · Tek kullanımlık kayıt #408',
    doneReply: 'İşlem uygulandı ve etkinlik geçmişine kaydedildi.',
    tapHint: 'Uygulamak için butona dokunun',
  },
  en: {
    approved: 'Approved · Single-use receipt #408',
    doneReply: 'Applied and logged in your activity history.',
    tapHint: 'Tap the button to test approval',
  },
} as const

// The owner's side: a chat with the assistant's bot, drawn in the product's own palette.
// Illustrated example with local-only state; no real Telegram message is sent.
export function OwnerChat({
  t,
  lang,
  selected,
}: {
  t: Copy['owner']
  lang: Lang
  selected: Command | null
}) {
  const [typing, setTyping] = useState(false)
  const [approvedAsk, setApprovedAsk] = useState<string | null>(null)
  const ui = receiptText[lang]

  useEffect(() => {
    setApprovedAsk(null)
    if (!selected) {
      setTyping(false)
      return
    }
    setTyping(true)
    const timer = window.setTimeout(() => setTyping(false), 420)
    return () => window.clearTimeout(timer)
  }, [selected?.ask])

  const isApproved = Boolean(selected && approvedAsk === selected.ask)

  const messages: ChatMessage[] = selected
    ? [
        { from: 'owner', text: selected.ask, time: '09:15' },
        ...(!typing
          ? [
              {
                from: 'assistant' as const,
                text: selected.answer,
                time: '09:15',
                actions: selected.action ? [selected.action] : undefined,
              },
            ]
          : []),
        ...(isApproved
          ? [
              {
                from: 'assistant' as const,
                text: ui.doneReply,
                time: '09:15',
              },
            ]
          : []),
      ]
    : t.chat

  return (
    <PhoneFrame label={t.example} clock="09:15">
      <div className="flex h-[36rem] flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <Brand variant="monogram" size="sm" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">{t.bot}</span>
            <span className="text-xs text-secondary">{t.botSub}</span>
          </div>
        </div>

        <div
          role="region"
          aria-label={t.example}
          tabIndex={0}
          className="dot-field relative flex min-h-0 flex-1 flex-col justify-end overflow-y-auto bg-canvas px-3 py-3 focus-visible:-outline-offset-2"
        >
          <span className="mx-auto mb-2 rounded-full bg-surface px-2.5 py-0.5 text-xs text-secondary shadow-sm">
            {t.today}
          </span>
          <ol aria-live="polite" className="flex flex-col gap-2">
            {messages.map((message, i) => (
              <Message
                key={`${i}-${message.text}`}
                message={message}
                fresh={Boolean(selected)}
                approved={isApproved}
                approvedLabel={ui.approved}
                tapHint={ui.tapHint}
                onApprove={selected ? () => setApprovedAsk(selected.ask) : undefined}
              />
            ))}
            {typing && (
              <li className="pop-in self-start rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-2.5">
                <span className="inline-flex gap-1" aria-hidden>
                  <span className="typing-dot size-1.5 rounded-full bg-action" />
                  <span className="typing-dot typing-dot-2 size-1.5 rounded-full bg-action" />
                  <span className="typing-dot typing-dot-3 size-1.5 rounded-full bg-action" />
                </span>
              </li>
            )}
          </ol>
        </div>

        <div aria-hidden className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2.5">
          <ImageIcon className="text-lg text-control" />
          <span className="flex h-9 flex-1 items-center rounded-full bg-surface-subtle px-4 text-sm text-secondary">
            {t.placeholder}
          </span>
          <span className="grid size-9 place-items-center rounded-full bg-action text-on-action">
            <SendIcon />
          </span>
        </div>
      </div>
    </PhoneFrame>
  )
}

function Message({
  message,
  fresh,
  approved,
  approvedLabel,
  tapHint,
  onApprove,
}: {
  message: ChatMessage
  fresh: boolean
  approved: boolean
  approvedLabel: string
  tapHint: string
  onApprove?: () => void
}) {
  const own = message.from === 'owner'
  return (
    <li
      className={`flex max-w-[88%] flex-col gap-1.5 ${own ? 'items-end self-end' : 'items-start self-start'} ${fresh ? 'pop-in' : ''}`}
    >
      <div
        className={`rounded-2xl px-3 py-2 text-[0.9375rem] leading-snug ${
          own
            ? 'rounded-br-md bg-fact text-on-fact'
            : 'rounded-bl-md border border-border bg-surface text-primary'
        } ${message.attachment ? 'w-[12.5rem]' : ''}`}
      >
        {message.attachment && <Story {...message.attachment} />}
        <p>
          {message.text}
          <span className="ml-2 inline-block text-xs opacity-80 tabular-nums">{message.time}</span>
        </p>
      </div>

      {message.actions && (
        <div className="flex w-full min-w-[13.5rem] flex-col gap-1">
          {approved ? (
            <span className="pop-in inline-flex items-center justify-center gap-1.5 rounded-lg bg-success-subtle px-3 py-2 text-xs font-semibold text-success ring-1 ring-success/30">
              <ShieldCheckIcon className="size-4" />
              {approvedLabel}
            </span>
          ) : (
            <>
              <div className="grid grid-flow-col gap-1">
                {message.actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={onApprove}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-band px-3 py-1.5 text-center text-[0.8125rem] font-semibold text-band-text transition-transform hover:brightness-110 active:scale-[0.98]"
                  >
                    <CheckIcon className="size-4 text-band-accent" />
                    {action}
                  </button>
                ))}
              </div>
              <span className="px-1 text-xs text-secondary">{tapHint}</span>
            </>
          )}
        </div>
      )}
    </li>
  )
}

// The photo the owner sends: an editorial studio story preview using bundled local studio photography.
function Story({ kicker, title, note }: { kicker: string; title: string; note: string }) {
  return (
    <div className="relative mb-2 flex h-32 flex-col justify-end overflow-hidden rounded-xl bg-[#253b31] p-3 font-heading text-white">
      <img
        src="./preview/movement.jpg"
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover opacity-80"
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[#0e1612]/90 via-[#0e1612]/35 to-transparent"
      />
      <span className="relative text-xs font-medium text-[#d1e4b7]">{kicker}</span>
      <span className="relative mt-0.5 text-base leading-tight font-semibold">{title}</span>
      <span className="relative mt-2 self-start rounded-full bg-[#d1e4b7] px-2.5 py-0.5 text-xs font-semibold text-[#18291f]">
        {note}
      </span>
    </div>
  )
}
