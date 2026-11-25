import { useEffect, useState } from 'react'
import type { Lang } from './copy'
import type { BusinessScenario } from './scenarios'
import { AnimatedNumber } from './ScrollReveal'
import { ArrowRightIcon, ChartIcon, ShieldCheckIcon } from './ui'

const calcCopy = {
  tr: {
    eyebrow: 'Kaçan müşteri raporu (₺)',
    title: 'Gece yanıtlanmayan DM’ler işletmenize ne kadara mal oluyor?',
    body: 'Müşteriler akşam 22:00’de fiyat sorduğunda sabaha kadar beklemek yerine başka bir işletmeye yazar. Kendi sayılarınızla tahmini etkiyi görün.',
    sliderMissed: 'Haftalık mesai dışı / geç yanıtlanan DM',
    unitMissed: 'mesaj / hafta',
    sliderPrice: 'Ortalama hizmet veya paket tutarı',
    monthlyLabel: 'Aylık potansiyel kayıp (tahmini)',
    yearlyLabel: 'Yıllık etki',
    formulaNote:
      'Örnek hesap: Haftalık geç yanıtlanan DM × 4,3 hafta × ortalama tutar × %20 dönüşüm varsayımı. Uygulamada bu rapor kendi doğrulanmış fiyatlarınızdan gerçek verilerle üretilir.',
    cta: '30 gün ücretsiz deneyin',
  },
  en: {
    eyebrow: 'Missed-customer impact',
    title: 'What are unanswered after-hours DMs costing your business?',
    body: 'When a customer asks a price at 22:00 and gets silence until morning, they often message a competitor. Slide to see an honest estimate.',
    sliderMissed: 'After-hours / slow-reply DMs per week',
    unitMissed: 'DMs / week',
    sliderPrice: 'Average service or order value',
    monthlyLabel: 'Estimated monthly revenue at risk',
    yearlyLabel: 'Annualised impact',
    formulaNote:
      'Illustrative estimate: Weekly slow-reply DMs × 4.3 weeks × average value × an assumed 20% conversion rate. Inside the app, this report is calculated from your real logged inbox and verified prices.',
    cta: 'Start 30-day free pilot',
  },
} as const

export function MissedRevenueCalculator({ lang, scenario }: { lang: Lang; scenario: BusinessScenario }) {
  const [missedPerWeek, setMissedPerWeek] = useState(scenario.roiDefaultMissed)
  const [avgPrice, setAvgPrice] = useState(scenario.roiDefaultPrice)
  const t = calcCopy[lang]

  useEffect(() => {
    setMissedPerWeek(scenario.roiDefaultMissed)
    setAvgPrice(scenario.roiDefaultPrice)
  }, [scenario.id, lang, scenario.roiDefaultMissed, scenario.roiDefaultPrice])

  const isTr = lang === 'tr'
  const minPrice = isTr ? 250 : 15
  const maxPrice = isTr ? 15000 : 500
  const priceStep = isTr ? 250 : 5

  // Illustrative 20% conversion assumption on unanswered after-hours enquiries.
  const monthlyLoss = Math.round(missedPerWeek * 4.3 * avgPrice * 0.2)
  const yearlyLoss = monthlyLoss * 12

  const formatMoney = (n: number) =>
    isTr ? `${n.toLocaleString('tr-TR')} ₺` : `$${n.toLocaleString('en-US')}`

  return (
    <section className="band-glow bg-band py-20 text-band-text md:py-24">
      <div className="gutter mx-auto max-w-[86rem]">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div>
            <p className="type-eyebrow inline-flex items-center gap-1.5 text-band-accent">
              <ChartIcon className="size-4" />
              {t.eyebrow}
            </p>
            <h2 className="type-title mt-3 text-white dark:text-primary">{t.title}</h2>
            <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-band-text/85">{t.body}</p>

            <div className="mt-8 space-y-6">
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <label htmlFor="roi-missed" className="text-sm font-medium text-band-text">
                    {t.sliderMissed}
                  </label>
                  <span className="font-heading text-lg font-semibold text-band-accent tabular-nums">
                    {missedPerWeek} {t.unitMissed}
                  </span>
                </div>
                <input
                  id="roi-missed"
                  type="range"
                  min={4}
                  max={60}
                  step={1}
                  value={missedPerWeek}
                  onChange={(e) => setMissedPerWeek(Number(e.target.value))}
                  className="pivoris-slider mt-3"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <label htmlFor="roi-price" className="text-sm font-medium text-band-text">
                    {t.sliderPrice}
                  </label>
                  <span className="font-heading text-lg font-semibold text-band-accent tabular-nums">
                    {formatMoney(avgPrice)}
                  </span>
                </div>
                <input
                  id="roi-price"
                  type="range"
                  min={minPrice}
                  max={maxPrice}
                  step={priceStep}
                  value={avgPrice}
                  onChange={(e) => setAvgPrice(Number(e.target.value))}
                  className="pivoris-slider mt-3"
                />
              </div>
            </div>
          </div>

          {/* Result card */}
          <div className="rounded-frame border border-band-text/15 bg-band-text/4 p-6 sm:p-8">
            <p className="text-sm font-medium text-band-text/80">{t.monthlyLabel}</p>
            <p className="mt-4 font-heading text-[clamp(2.5rem,2rem+2.5vw,3.75rem)] leading-none font-medium tracking-tight text-band-accent tabular-nums">
              {isTr ? (
                <>
                  <AnimatedNumber value={monthlyLoss} formatLocale="tr-TR" /> ₺
                </>
              ) : (
                <>
                  $<AnimatedNumber value={monthlyLoss} formatLocale="en-US" />
                </>
              )}
            </p>

            <div className="mt-5 flex items-center justify-between border-y border-white/12 py-4 text-sm">
              <span className="text-band-text/80">{t.yearlyLabel}</span>
              <span className="font-heading text-lg font-semibold text-white tabular-nums">
                {formatMoney(yearlyLoss)}
              </span>
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-band-text/75">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-band-accent" />
              {t.formulaNote}
            </p>

            <a
              href="#pilot"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-band-accent px-5 text-base font-medium text-on-band-accent transition-colors hover:bg-white"
            >
              {t.cta}
              <ArrowRightIcon className="size-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
