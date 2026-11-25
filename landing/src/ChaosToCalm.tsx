import { useState } from 'react'
import type { Lang } from './copy'
import { AlertIcon, Badge, CheckIcon, ClockIcon, ShieldCheckIcon } from './ui'

const copyData = {
  tr: {
    eyebrow: 'Farkı saniyeler içinde görün',
    title: 'Gece 23:47’de telefonunuz nasıl görünüyor?',
    beforeTab: 'Pivoris olmadan · 23:47',
    afterTab: 'Pivoris ile · 08:30 özeti',
    beforeBadge: '19 okunmamış bildirim',
    beforeSub: 'Tekrar eden fiyat soruları, kaçan müşteriler ve yorgun akşamlar.',
    beforeItems: [
      { time: '22:14', user: '@ayse.yilmaz', text: 'Merhaba aylık üyelik ne kadar acaba?', tag: 'Yanıtsız · 1 sa' },
      { time: '22:41', user: '@selin.kaya', text: 'Reels altına yazdım ama dönen olmadı', tag: 'Soğuyan lead' },
      { time: '23:08', user: '@elena.moscow', text: 'Сколько стоит абонемент?', tag: 'Yabancı dil' },
      { time: '23:32', user: 'Planlı paylaşım', text: 'Eski fiyatlı Story yarın otomatik yayına girecek!', tag: 'Yanlış fiyat riski' },
    ],
    afterBadge: 'Her şey kontrol altında',
    afterSub: 'Siz uyurken rutin sorular yanıtlandı; sabah kahvenizde tek net özet.',
    afterMetrics: [
      { value: '11', label: 'Otomatik yanıtlandı' },
      { value: '2', label: 'Kararınıza hazır' },
      { value: '0', label: 'Uydurulan fiyat' },
    ],
    afterItems: [
      'Fiyat, saat ve adres soruları doğrulanmış kartlarınızla saniyeler içinde yanıtlandı.',
      'Reels yorumları herkese açık fiyat yazmadan özel DM sohbetine taşındı.',
      'Rusça ve İngilizce sorular müşterinin kendi dilinde karşılandı.',
      'Eski fiyatı kullanan planlı paylaşım otomatik beklemeye alındı.',
    ],
  },
  en: {
    eyebrow: 'Feel the difference in seconds',
    title: 'What does your phone look like at 23:47?',
    beforeTab: 'Without Pivoris · 23:47',
    afterTab: 'With Pivoris · 08:30 briefing',
    beforeBadge: '19 unread notifications',
    beforeSub: 'Repetitive price questions, cooling leads and never truly clocking off.',
    beforeItems: [
      { time: '22:14', user: '@anna.berg', text: 'Hi, how much is a monthly membership?', tag: 'Unanswered · 1h' },
      { time: '22:41', user: '@claire.m', text: 'Commented on your Reel earlier, any reply?', tag: 'Cooling lead' },
      { time: '23:08', user: '@katrin.b', text: 'Wie viel kostet die Monatsmitgliedschaft?', tag: 'Other language' },
      { time: '23:32', user: 'Scheduled Story', text: 'Post with last month’s price is still queued to publish', tag: 'Stale price risk' },
    ],
    afterBadge: 'Everything under control',
    afterSub: 'Routine questions handled overnight; one calm morning summary with your coffee.',
    afterMetrics: [
      { value: '11', label: 'Answered automatically' },
      { value: '2', label: 'Ready for your call' },
      { value: '0', label: 'Made-up prices' },
    ],
    afterItems: [
      'Price, hours and location questions answered in seconds from verified fact cards.',
      'Reel comments moved cleanly into private DM conversations.',
      'German, Russian and English enquiries answered in the customer’s own language.',
      'Scheduled content using an outdated price automatically paused for your review.',
    ],
  },
} as const

export function ChaosToCalm({ lang }: { lang: Lang }) {
  const [mode, setMode] = useState<'before' | 'after'>('after')
  const t = copyData[lang]

  return (
    <section className="py-16 md:py-20">
      <div className="gutter mx-auto max-w-[86rem]">
        <div className="overflow-hidden rounded-frame border border-border bg-surface shadow-frame">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-canvas/70 px-5 py-5 sm:px-8">
            <div>
              <p className="type-eyebrow text-action">{t.eyebrow}</p>
              <h2 className="mt-1 font-heading text-2xl font-semibold sm:text-3xl">{t.title}</h2>
            </div>

            <div
              role="group"
              aria-label={t.title}
              className="grid w-full grid-cols-2 rounded-panel border border-border bg-surface p-1 sm:w-auto"
            >
              <button
                type="button"
                aria-pressed={mode === 'before'}
                onClick={() => setMode('before')}
                className="min-h-10 rounded-control px-4 text-sm font-semibold text-secondary transition-colors hover:text-primary aria-pressed:bg-danger-subtle aria-pressed:text-danger"
              >
                {t.beforeTab}
              </button>
              <button
                type="button"
                aria-pressed={mode === 'after'}
                onClick={() => setMode('after')}
                className="min-h-10 rounded-control px-4 text-sm font-semibold text-secondary transition-colors hover:text-primary aria-pressed:bg-band aria-pressed:text-band-text"
              >
                {t.afterTab}
              </button>
            </div>
          </div>

          <div key={mode} className="pop-in p-5 sm:p-8">
            {mode === 'before' ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
                <div>
                  <Badge tone="danger" icon={<AlertIcon />}>
                    {t.beforeBadge}
                  </Badge>
                  <p className="mt-4 font-heading text-xl font-semibold text-primary sm:text-2xl">{t.beforeSub}</p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {t.beforeItems.map((item) => (
                    <li
                      key={`${item.time}-${item.user}`}
                      className="rounded-panel border border-danger/25 bg-danger-subtle/40 p-4"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-primary">{item.user}</span>
                        <span className="tabular-nums text-secondary">{item.time}</span>
                      </div>
                      <p className="mt-2 text-sm leading-snug text-primary">{item.text}</p>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-danger">
                        <ClockIcon className="size-4" />
                        {item.tag}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
                <div>
                  <Badge tone="success" icon={<CheckIcon />}>
                    {t.afterBadge}
                  </Badge>
                  <p className="mt-4 font-heading text-xl font-semibold text-primary sm:text-2xl">{t.afterSub}</p>
                  <dl className="mt-5 grid grid-cols-3 gap-3">
                    {t.afterMetrics.map((m) => (
                      <div key={m.label} className="border-t border-border pt-3">
                        <dd className="font-heading text-2xl font-medium tabular-nums">{m.value}</dd>
                        <dt className="mt-0.5 text-xs text-secondary">{m.label}</dt>
                      </div>
                    ))}
                  </dl>
                </div>

                <ul className="grid gap-3">
                  {t.afterItems.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-3 border-b border-border pb-3 text-sm leading-relaxed text-primary last:border-0 last:pb-0"
                    >
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-subtle text-success">
                        <CheckIcon className="size-4" />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border bg-canvas/50 px-5 py-3 text-xs text-secondary sm:px-8">
            <ShieldCheckIcon className="size-4 shrink-0 text-action" />
            {lang === 'tr'
              ? 'Örnek karşılaştırma · Uygulamada her işlem etkinlik geçmişinde şeffaf biçimde kayıtlıdır.'
              : 'Illustrative comparison · Every real action is recorded transparently in your activity log.'}
          </div>
        </div>
      </div>
    </section>
  )
}
