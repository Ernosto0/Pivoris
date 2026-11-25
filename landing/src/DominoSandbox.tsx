import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Brand } from './BrandIdentity'
import type { Lang } from './copy'
import type { BusinessScenario } from './scenarios'
import {
  Badge,
  BookIcon,
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  ExampleLabel,
  PauseIcon,
  RotateIcon,
  ShieldCheckIcon,
} from './ui'

const dominoUi = {
  tr: {
    eyebrow: 'Tek kaynak, sıfır çelişki',
    title: 'Bir fiyatı değiştirin. Her şey anında kendini güncellesin.',
    body: 'Diğer araçlarda fiyat değişince eski DM taslakları ve planlı paylaşımlar yanlış bilgiyle yayına gider. Pivoris’te tek bir onay her şeye zincirleme yansır.',
    example: 'Canlı etkileşimli simülasyon · Gerçek işlem yapılmaz',
    tryCta: 'Aşağıdaki Telegram onay butonuna dokunun ve zincirleme etkiyi izleyin',
    telegramTitle: '1 · Telegram’dan tek mesaj',
    telegramSub: 'İşletme sahibi komutu',
    waitingPrompt: 'Onay bekleniyor · Tek kullanımlık yetki',
    updatingPrompt: 'İlgili yanıt ve paylaşım güncelleniyor',
    reset: 'Simülasyonu sıfırla',
    card1Title: 'Bilgi Kartı',
    card1Before: 'Doğrulandı · v1',
    card1After: 'Güncellendi · v2 (Şimdi)',
    card2Title: 'Bekleyen Müşteri DM’i',
    card2Before: 'Eski fiyatla hazırlandı',
    card2After: 'Yeni fiyatla otomatik yenilendi',
    card3Title: 'Planlı Instagram Paylaşımı',
    card3BeforeBadge: 'Planlandı',
    card3AfterBadge: 'Beklemede',
    liveFlowLabel: 'Değişiklik tüm sisteme yayıldı',
  },
  en: {
    eyebrow: 'One source of truth, zero contradictions',
    title: 'Change one price. Watch everything downstream react.',
    body: 'In disconnected tools, stale DM drafts and scheduled posts still publish outdated prices. In Pivoris, one approval cascades across every reply and post.',
    example: 'Interactive simulation · No live changes',
    tryCta: 'Click the Telegram approval button below to watch the domino effect live',
    telegramTitle: '1 · One message on Telegram',
    telegramSub: 'Owner instruction',
    waitingPrompt: 'Waiting for explicit approval · Single-use',
    updatingPrompt: 'Updating the affected reply and post',
    reset: 'Reset simulation',
    card1Title: 'Verified Fact Card',
    card1Before: 'Verified · v1',
    card1After: 'Updated · v2 (Just now)',
    card2Title: 'Pending Customer DM',
    card2Before: 'Drafted with previous price',
    card2After: 'Auto-redrafted with new price',
    card3Title: 'Scheduled Instagram Post',
    card3BeforeBadge: 'Scheduled',
    card3AfterBadge: 'On hold',
    liveFlowLabel: 'Update propagated across the workspace',
  },
} as const

export function DominoSandbox({
  lang,
  scenario,
  switcher,
}: {
  lang: Lang
  scenario: BusinessScenario
  switcher?: ReactNode
}) {
  // stage: 0 = initial, 1 = fact updated, 2 = DM redrafted, 3 = scheduled post held
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0)
  const timersRef = useRef<number[]>([])
  const ui = dominoUi[lang]
  const d = scenario.domino

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
  }

  useEffect(() => {
    clearTimers()
    setStage(0)
    return clearTimers
  }, [scenario.id, lang])

  const triggerCascade = () => {
    if (stage > 0) return
    clearTimers()
    setStage(1)
    timersRef.current.push(
      window.setTimeout(() => setStage(2), 420),
      window.setTimeout(() => setStage(3), 860),
    )
  }

  const reset = () => {
    clearTimers()
    setStage(0)
  }

  return (
    <section id="zincir" className="relative overflow-hidden border-y border-border bg-surface py-20 md:py-28">
      <div className="gutter mx-auto max-w-[86rem]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <header className="max-w-[44rem]">
            <p className="type-eyebrow text-action">{ui.eyebrow}</p>
            <h2 className="type-title mt-3">{ui.title}</h2>
            <p className="mt-4 max-w-[39rem] text-lg leading-relaxed text-secondary">{ui.body}</p>
          </header>
          <ExampleLabel>{ui.example}</ExampleLabel>
        </div>

        {switcher && <div className="mt-8">{switcher}</div>}

        {/* Instruction hint bar */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-canvas px-4 py-3 text-sm">
          <p aria-live="polite" className="flex items-center gap-2 font-medium text-primary">
            <span
              aria-hidden
              className={`inline-flex size-1.5 rounded-full ${stage === 3 ? 'bg-success' : 'bg-control'}`}
            />
            {stage === 3 ? ui.liveFlowLabel : ui.tryCta}
          </p>
          {stage > 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-xs font-semibold text-primary transition-colors hover:bg-surface-subtle"
            >
              <RotateIcon className="size-4" />
              {ui.reset}
            </button>
          )}
        </div>

        {/* Interactive Cascade Grid */}
        <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.45fr)] lg:gap-4">
          {/* LEFT: Triggering Telegram Command */}
          <div className="flex flex-col justify-between rounded-frame border border-border bg-canvas p-5 shadow-frame">
            <div>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3.5">
                <div className="flex items-center gap-3">
                  <Brand variant="monogram" size="sm" />
                  <div>
                    <p className="font-heading text-sm font-semibold">{ui.telegramTitle}</p>
                    <p className="text-xs text-secondary">{scenario.brandName}</p>
                  </div>
                </div>
                <Badge tone={stage > 0 ? 'success' : 'neutral'} size="sm">
                  {stage > 0 ? 'v2' : 'v1'}
                </Badge>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {/* Owner bubble */}
                <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-fact px-4 py-2.5 text-sm font-medium text-on-fact">
                  “{d.telegramCommand}”
                </div>

                {/* Assistant proposal bubble */}
                <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-border bg-surface p-4 text-sm leading-relaxed text-primary">
                  <p>{stage > 0 ? d.telegramDone : d.telegramProposal}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              {stage === 0 ? (
                <button
                  type="button"
                  onClick={triggerCascade}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-action px-5 text-sm font-medium text-on-action transition-colors hover:bg-action-hover"
                >
                  <CheckIcon className="size-4" />
                  {d.telegramButton} ({d.oldPrice} → {d.newPrice})
                </button>
              ) : (
                <div className="pop-in flex items-center justify-between gap-2 rounded-control bg-success-subtle px-4 py-2.5 text-xs font-semibold text-success ring-1 ring-success/30">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheckIcon className="size-4" />
                    {ui.liveFlowLabel}
                  </span>
                  <button
                    type="button"
                    onClick={reset}
                    className="underline underline-offset-2 hover:opacity-80"
                  >
                    {ui.reset}
                  </button>
                </div>
              )}
              <p className="mt-2 text-center text-xs text-secondary">
                {stage === 3 ? ui.liveFlowLabel : stage > 0 ? ui.updatingPrompt : ui.waitingPrompt}
              </p>
            </div>
          </div>

          {/* CENTER: Animated SVG Signal Connector (Desktop) */}
          <div aria-hidden className="hidden w-12 items-center justify-center lg:flex">
            <svg viewBox="0 0 48 320" className="h-full w-12 overflow-visible" fill="none">
              <path
                d="M 0 160 C 24 160, 20 55, 48 55"
                stroke={stage >= 1 ? 'var(--an-action)' : 'var(--an-border)'}
                strokeWidth={1.5}
                className={stage >= 1 ? 'dash-flow' : ''}
              />
              <path
                d="M 0 160 L 48 160"
                stroke={stage >= 2 ? 'var(--an-action)' : 'var(--an-border)'}
                strokeWidth={1.5}
                className={stage >= 2 ? 'dash-flow' : ''}
              />
              <path
                d="M 0 160 C 24 160, 20 265, 48 265"
                stroke={stage >= 3 ? 'var(--an-attention)' : 'var(--an-border)'}
                strokeWidth={1.5}
                className={stage >= 3 ? 'dash-flow' : ''}
              />
            </svg>
          </div>

          {/* RIGHT: 3 Cascading Live Panels */}
          <div className="grid gap-4">
            {/* Panel 1: Verified Fact Card */}
            <div
              className={`rounded-frame border p-4 transition-colors duration-300 sm:p-5 ${
                stage >= 1
                  ? 'domino-pulse border-border bg-assistant/40'
                  : 'border-border bg-canvas'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-heading text-sm font-semibold">
                  <BookIcon className="size-4 text-action" />
                  {ui.card1Title}
                </span>
                <Badge tone={stage >= 1 ? 'success' : 'neutral'} size="sm" icon={<CheckIcon />}>
                  {stage >= 1 ? ui.card1After : ui.card1Before}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-xs text-secondary">{d.factCategory}</p>
                  <p className="font-heading text-base font-semibold">{d.factTitle}</p>
                </div>
                <div className="flex items-baseline gap-3 tabular-nums">
                  {stage >= 1 && (
                    <span className="text-sm text-secondary line-through opacity-75">{d.oldPrice}</span>
                  )}
                  <span
                    className={`font-heading text-2xl font-semibold transition-colors ${
                      stage >= 1 ? 'text-action' : 'text-primary'
                    }`}
                  >
                    {stage >= 1 ? d.newPrice : d.oldPrice}
                  </span>
                </div>
              </div>
            </div>

            {/* Panel 2: Pending Customer DM Redraft */}
            <div
              className={`rounded-frame border p-4 transition-colors duration-300 sm:p-5 ${
                stage >= 2
                  ? 'domino-pulse border-border bg-assistant/40'
                  : 'border-border bg-canvas'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-heading text-sm font-semibold">
                  <ChatIcon className="size-4 text-action" />
                  {ui.card2Title} · @{d.dmCustomer}
                </span>
                <Badge tone={stage >= 2 ? 'success' : 'neutral'} size="sm">
                  {stage >= 2 ? ui.card2After : ui.card2Before}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-secondary">“{d.dmQuestion}”</p>
              <p className="mt-2 rounded-panel border border-border bg-surface px-4 py-2.5 text-sm leading-relaxed">
                {d.dmPrefix}
                {stage >= 2 && (
                  <span className="mr-1.5 rounded bg-danger-subtle px-1.5 py-0.5 text-xs font-semibold text-danger line-through">
                    {d.oldPrice}
                  </span>
                )}
                <span
                  className={`rounded px-1.5 py-0.5 font-semibold ${
                    stage >= 2 ? 'bg-fact text-on-fact' : 'bg-surface-subtle text-primary'
                  }`}
                >
                  {stage >= 2 ? d.newPrice : d.oldPrice}
                </span>
                {d.dmSuffix}
              </p>
            </div>

            {/* Panel 3: Scheduled Instagram Post Automatically Held */}
            <div
              className={`rounded-frame border p-4 transition-colors duration-300 sm:p-5 ${
                stage >= 3
                  ? 'domino-pulse-amber border-border bg-attention-subtle/40'
                  : 'border-border bg-canvas'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-heading text-sm font-semibold">
                  <CalendarIcon className={`size-4 ${stage >= 3 ? 'text-attention' : 'text-action'}`} />
                  {ui.card3Title}
                </span>
                <Badge
                  tone={stage >= 3 ? 'attention' : 'info'}
                  size="sm"
                  icon={stage >= 3 ? <PauseIcon /> : <CalendarIcon />}
                >
                  {stage >= 3 ? ui.card3AfterBadge : ui.card3BeforeBadge}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-4">
                <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10">
                  <img src="./preview/studio.jpg" alt="" loading="lazy" className="size-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-secondary">
                    {d.postDay} {d.postTime} · {d.postKind}
                  </p>
                  <p className="truncate font-heading text-sm font-semibold">{d.postTitle}</p>
                  <p
                    className={`mt-0.5 text-xs font-medium ${
                      stage >= 3 ? 'text-attention' : 'text-secondary'
                    }`}
                  >
                    {stage >= 3 ? d.postHeldNote : d.postOldNote}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
