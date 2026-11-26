import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { PRODUCT_NAME } from './brand'
import { Brand } from './BrandIdentity'
import { ChaosToCalm } from './ChaosToCalm'
import { copy, type Copy, type Lang, type PostStatus } from './copy'
import { PACKAGE_PRICE, appLink } from './config'
import { DominoSandbox } from './DominoSandbox'
import { DraftDemo } from './DraftDemo'
import { HeroPreview } from './HeroPreview'
import { KnowledgePreview } from './KnowledgePreview'
import { kvkkDocument, legalCopy } from './legalCopy'
import { LegalPage, type Route } from './LegalPage'
import { MissedRevenueCalculator } from './MissedRevenueCalculator'
import { OwnerChat } from './OwnerChat'
import { CapabilitiesSection, ChannelPreview, JourneySection } from './ProductStories'
import { getScenario, getScenarios, type BusinessId, type BusinessScenario } from './scenarios'
import { Reveal, ScrollProgress } from './ScrollReveal'
import {
  ArrowUpIcon,
  Badge,
  BookIcon,
  CalendarIcon,
  ChartIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  Eyebrow,
  ExampleLabel,
  HandIcon,
  KeyIcon,
  LayersIcon,
  ListIcon,
  MoonIcon,
  PauseIcon,
  PlusIcon,
  SectionHeader,
  SettingsIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SunIcon,
  TagIcon,
  TrashIcon,
  UsersIcon,
  buttonLarge,
  buttonPrimary,
  type Tone,
} from './ui'
import { WaitlistForm } from './WaitlistForm'

const LANG_KEY = 'landing.lang.choice'
const THEME_KEY = 'landing.theme'
type Theme = 'light' | 'dark'

const TURKEY_TIMEZONES = new Set(['Europe/Istanbul', 'Asia/Istanbul'])

function routeFromLocation(): Route {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/'
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '/')
  for (const candidate of [path, hash]) {
    if (candidate === '/privacy' || candidate === '/gizlilik' || candidate === '/en/privacy' || candidate === '/tr/privacy' || candidate === '/tr/gizlilik') {
      return 'privacy'
    }
    if (
      candidate === '/terms' ||
      candidate === '/kullanim-kosullari' ||
      candidate === '/en/terms' ||
      candidate === '/tr/terms' ||
      candidate === '/tr/kullanim-kosullari'
    ) {
      return 'terms'
    }
    if (candidate === '/kvkk' || candidate === '/kvkk-aydinlatma-metni' || candidate === '/tr/kvkk') {
      return 'kvkk'
    }
  }
  return 'home'
}

function initialLang(): Lang {
  try {
    const paramLang = new URLSearchParams(window.location.search).get('lang')?.toLowerCase()
    if (paramLang === 'tr' || paramLang === 'en') return paramLang
  } catch {
    // Ignore malformed query strings.
  }
  const path = window.location.pathname.toLowerCase()
  if (path.startsWith('/en/')) return 'en'
  if (path.startsWith('/tr/')) return 'tr'
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'tr' || saved === 'en') return saved
  } catch {
    // Storage can be blocked; fall back to browser locale and timezone.
  }
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language]
  if (locales.some((locale) => locale?.toLowerCase().startsWith('tr'))) return 'tr'
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (TURKEY_TIMEZONES.has(tz)) return 'tr'
  } catch {
    // Intl timezone lookup can fail in restricted environments.
  }
  return 'en'
}

// index.html already applied the saved choice (or the OS preference) before first paint.
function initialTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

const container = 'gutter mx-auto w-full max-w-[86rem]'

export function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation)
  const [lang, setLangState] = useState<Lang>(initialLang)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  // Null until the visitor picks a business; until then each demo shows a different sector,
  // so the page does not repeat one studio's prices. A pick makes every demo follow it.
  const [businessId, setBusinessId] = useState<BusinessId | null>(null)
  const t = copy[lang]
  const scenarios = getScenarios(lang)
  const demoScenario = (fallback: BusinessId) => getScenario(lang, businessId ?? fallback)
  const scenario = demoScenario('pilates')
  const pendingHashRef = useRef<string | null>(null)

  const navigate = useCallback((nextRoute: Route, hash?: string) => {
    const basePath =
      nextRoute === 'privacy'
        ? '/privacy'
        : nextRoute === 'terms'
          ? '/terms'
          : nextRoute === 'kvkk'
            ? '/kvkk'
            : '/'
    const targetUrl = hash ? `${basePath}#${hash}` : basePath
    if (window.location.pathname + window.location.hash !== targetUrl) {
      window.history.pushState(null, '', targetUrl)
    }
    pendingHashRef.current = hash ?? null
    setRoute(nextRoute)
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation())
    window.addEventListener('popstate', onPopState)
    window.addEventListener('hashchange', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('hashchange', onPopState)
    }
  }, [])

  useEffect(() => {
    if (route !== 'home') return
    const targetId = pendingHashRef.current ?? (window.location.hash.startsWith('#') ? window.location.hash.slice(1) : null)
    pendingHashRef.current = null
    if (!targetId) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView()
    })
    return () => cancelAnimationFrame(frame)
  }, [route])

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      // Not remembering the choice is fine.
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // index.html has one tag per OS scheme; the visitor's own choice wins, so every tag follows it.
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((tag) => tag.setAttribute('content', theme === 'dark' ? '#0d1410' : '#f7f8f3'))
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Not remembering the choice is fine.
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = route === 'kvkk' ? 'tr' : lang
    const meta =
      route === 'home'
        ? t.meta
        : route === 'kvkk'
          ? { title: kvkkDocument.metaTitle, description: kvkkDocument.metaDescription }
          : {
              title: legalCopy[lang][route].metaTitle,
              description: legalCopy[lang][route].metaDescription,
            }
    document.title = meta.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description)
  }, [lang, route, t.meta])

  const heroRef = useRef<HTMLElement>(null)
  const pilotRef = useRef<HTMLElement>(null)
  const heroVisible = useInView(heroRef, route === 'home')
  const pilotVisible = useInView(pilotRef, route === 'home')
  const active = useActiveSection(t.nav.links.map((l) => l.id).concat('pilot'), route === 'home')

  return (
    <div>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:shadow-frame"
      >
        {t.nav.skip}
      </a>

      <SiteHeader
        t={t}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        active={route === 'home' ? active : null}
        route={route}
        onNavigate={navigate}
      />

      <main id="main" tabIndex={-1} className="outline-none">
        {route === 'home' ? (
          <>
            <Hero
              t={t}
              lang={lang}
              heroRef={heroRef}
              scenarios={scenarios}
            />

            <Reveal>
              <Promises t={t} />
            </Reveal>

            <Reveal>
              <ChaosToCalm lang={lang} />
            </Reveal>

            <Reveal>
              <DominoSandbox
                lang={lang}
                scenario={scenario}
                switcher={
                  <BusinessSwitcher
                    lang={lang}
                    scenarios={scenarios}
                    selected={businessId}
                    onSelect={setBusinessId}
                  />
                }
              />
            </Reveal>

            <JourneySection lang={lang} />

            <Section id="demo" tone="surface">
              <Reveal>
                <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-20">
                  <div>
                    <SectionHeader eyebrow={t.demo.eyebrow} title={t.demo.title} body={t.demo.body} />
                    <ul className="mt-10 flex flex-col gap-5">
                      {t.demo.points.map((point, i) => (
                        <li key={point.title} className="flex gap-4">
                          <span
                            aria-hidden
                            className="grid size-10 shrink-0 place-items-center rounded-panel bg-assistant text-lg text-action"
                          >
                            {[<TagIcon key="t" />, <CheckIcon key="c" />, <HandIcon key="h" />][i]}
                          </span>
                          <div>
                            <h3 className="font-heading text-base font-semibold">{point.title}</h3>
                            <p className="mt-0.5 text-base leading-relaxed text-secondary">{point.body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <DraftDemo t={t.demo} lang={lang} scenario={demoScenario('beauty')} />
                  </div>
                </div>
              </Reveal>
            </Section>

            <OwnerSection t={t.owner} lang={lang} />

            <Reveal>
              <CapabilitiesSection lang={lang} />
            </Reveal>

            <HowItWorks t={t} lang={lang} scenario={demoScenario('clinic')} />

            <ContentAndReport t={t} />

            <Reveal>
              <MissedRevenueCalculator lang={lang} scenario={demoScenario('cafe')} />
            </Reveal>

            <Trust t={t.trust} />

            <LocalPackage t={t.localPackage} onNavigate={navigate} />

            <Faq t={t.faq} />

            <Pilot t={t} lang={lang} pilotRef={pilotRef} scenario={scenario} onNavigate={navigate} />
          </>
        ) : (
          <LegalPage kind={route} lang={lang} onNavigate={navigate} />
        )}
      </main>

      <SiteFooter t={t} route={route} onNavigate={navigate} />
      <MobileCta t={t} hidden={route !== 'home' || heroVisible || pilotVisible} />
    </div>
  )
}

/* ------------------------------------------------------------------ header */

function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>) {
  return !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0
}

function SiteHeader({
  t,
  lang,
  setLang,
  theme,
  setTheme,
  active,
  route,
  onNavigate,
}: {
  t: Copy
  lang: Lang
  setLang: (l: Lang) => void
  theme: Theme
  setTheme: (t: Theme) => void
  active: string | null
  route: Route
  onNavigate: (r: Route, hash?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const sectionHref = (id: string) => (route === 'home' ? `#${id}` : `/#${id}`)
  const handleHomeNav = (e: MouseEvent<HTMLAnchorElement>, id?: string) => {
    if (route === 'home') return
    if (!isPlainLeftClick(e)) return
    e.preventDefault()
    onNavigate('home', id)
  }

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors ${
        scrolled || open ? 'border-border bg-canvas/85 backdrop-blur-md' : 'border-transparent bg-canvas/70 backdrop-blur-sm'
      }`}
    >
      <div className={`${container} flex h-16 items-center gap-4`}>
        <a
          href={route === 'home' ? '#' : '/'}
          onClick={(e) => {
            if (route === 'home' || !isPlainLeftClick(e)) return
            e.preventDefault()
            onNavigate('home')
          }}
          className="flex items-center gap-3 rounded-control"
          aria-label={PRODUCT_NAME}
        >
          <Brand className="pivoris-brand--navigation" />
        </a>

        <nav aria-label={t.nav.menu} className="ml-6 hidden items-center gap-1 lg:flex">
          {t.nav.links.map((link) => (
            <a
              key={link.id}
              href={sectionHref(link.id)}
              onClick={(e) => handleHomeNav(e, link.id)}
              aria-current={active === link.id ? 'true' : undefined}
              className="rounded-control px-3 py-2 text-sm font-medium text-secondary transition-colors hover:text-primary aria-[current]:bg-surface-subtle aria-[current]:text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <LangSwitch t={t} lang={lang} setLang={setLang} />
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? t.nav.toLight : t.nav.toDark}
            title={theme === 'dark' ? t.nav.toLight : t.nav.toDark}
            className="grid size-10 place-items-center rounded-control text-lg text-secondary transition-colors hover:bg-surface-subtle hover:text-primary"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <span className="ml-1.5 hidden sm:block">
            <a
              href={sectionHref('pilot')}
              onClick={(e) => handleHomeNav(e, 'pilot')}
              className={`${buttonPrimary} whitespace-nowrap`}
            >
              {t.nav.cta}
            </a>
          </span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={t.nav.menu}
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-control text-lg text-primary hover:bg-surface-subtle lg:hidden"
          >
            <span aria-hidden className="relative block h-3 w-4">
              <span
                className={`absolute left-0 h-0.5 w-4 rounded bg-current transition-transform ${open ? 'top-[5px] rotate-45' : 'top-0'}`}
              />
              <span
                className={`absolute top-[5px] left-0 h-0.5 w-4 rounded bg-current transition-opacity ${open ? 'opacity-0' : ''}`}
              />
              <span
                className={`absolute left-0 h-0.5 w-4 rounded bg-current transition-transform ${open ? 'top-[5px] -rotate-45' : 'top-[10px]'}`}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label={t.nav.menu} className="border-t border-border bg-canvas lg:hidden">
          <div className={`${container} flex flex-col py-3`}>
            {t.nav.links.map((link) => (
              <a
                key={link.id}
                href={sectionHref(link.id)}
                onClick={(e) => {
                  setOpen(false)
                  handleHomeNav(e, link.id)
                }}
                className="flex min-h-12 items-center justify-between border-b border-border text-base font-medium last:border-b-0"
              >
                {link.label}
              </a>
            ))}
            <a
              href={sectionHref('pilot')}
              onClick={(e) => {
                setOpen(false)
                handleHomeNav(e, 'pilot')
              }}
              className={`${buttonPrimary} mt-3 w-full`}
            >
              {t.nav.cta}
            </a>
          </div>
        </nav>
      )}

      <ScrollProgress />
    </header>
  )
}

function LangSwitch({ t, lang, setLang }: { t: Copy; lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div
      role="group"
      aria-label={t.nav.language}
      className="flex rounded-control border border-border bg-surface p-0.5"
    >
      {(['tr', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className="min-h-8 min-w-9 rounded-[0.375rem] px-2 text-xs font-semibold text-secondary uppercase transition-colors aria-pressed:bg-band aria-pressed:text-band-text"
        >
          {code}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------- hero */

function Hero({
  t,
  lang,
  heroRef,
  scenarios,
}: {
  t: Copy
  lang: Lang
  heroRef: RefObject<HTMLElement | null>
  scenarios: BusinessScenario[]
}) {
  return (
    <section ref={heroRef} className="relative overflow-hidden">
      {/* Faint texture behind the product; the headline stays on calm space. */}
      <div aria-hidden className="hero-atmosphere pointer-events-none absolute inset-0" />
      <div aria-hidden className="hero-grid-pattern pointer-events-none absolute inset-0" />

      <div
        className={`${container} hero-enter relative grid items-center gap-12 pt-12 pb-16 md:pt-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-14 lg:py-12`}
      >
        <div className="min-w-0">
          <h1 className="type-hero">
            {t.hero.title}
            <br />
            <span className="hero-accent italic">{t.hero.accent}</span>
          </h1>

          <p className="mt-7 max-w-[30rem] text-lg leading-relaxed text-secondary">
            {t.hero.lead}
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <a href="#pilot" className={`${buttonPrimary} ${buttonLarge}`}>
              {t.hero.cta}
            </a>
            <a
              href="#zincir"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control text-base font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t.hero.secondary}
              <span aria-hidden>→</span>
            </a>
          </div>

          <p className="mt-5 text-sm text-secondary">{t.hero.points.join(' · ')}</p>
        </div>

        <div className="min-w-0">
          <HeroPreview t={t.preview} lang={lang} scenarios={scenarios} />
        </div>
      </div>
    </section>
  )
}

/** One selection adapts Domino, Draft, Knowledge, calculator and waitlist. */
function BusinessSwitcher({
  lang,
  scenarios,
  selected,
  onSelect,
}: {
  lang: Lang
  scenarios: BusinessScenario[]
  selected: BusinessId | null
  onSelect: (id: BusinessId) => void
}) {
  const label = lang === 'tr' ? 'Örnekleri işletmenize göre görün' : 'See the demos for your business'
  return (
    <div>
      <p className="text-xs font-medium text-secondary">{label}</p>
      <div role="group" aria-label={label} className="mt-3 flex flex-wrap gap-2">
        {scenarios.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected === item.id}
            onClick={() => onSelect(item.id)}
            className="min-h-9 rounded-control border border-border bg-canvas px-3 text-xs font-medium text-secondary transition-colors hover:border-control hover:text-primary aria-pressed:border-control aria-pressed:bg-surface-subtle aria-pressed:text-primary"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Promises({ t }: { t: Copy }) {
  const icons = [<ClockIcon key="t" />, <ChatIcon key="s" />, <CalendarIcon key="c" />]
  return (
    <section aria-label={t.promises.map((p) => p.title).join(' ')} className="relative">
      <div className={container}>
        <ul className="grid overflow-hidden rounded-frame border border-border bg-surface shadow-frame md:grid-cols-3">
          {t.promises.map((promise, i) => (
            <li
              key={promise.title}
              className="flex gap-4 border-border p-6 transition-colors hover:bg-surface-subtle/40 not-last:border-b md:not-last:border-r md:not-last:border-b-0 lg:p-7"
            >
              <span
                aria-hidden
                className="grid size-11 shrink-0 place-items-center rounded-panel bg-assistant text-xl text-action"
              >
                {icons[i]}
              </span>
              <div>
                <h2 className="font-heading text-lg font-semibold">{promise.title}</h2>
                <p className="mt-1 text-base leading-relaxed text-secondary">{promise.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- sections */

function Section({
  id,
  tone = 'canvas',
  children,
  className = '',
}: {
  id?: string
  tone?: 'canvas' | 'surface'
  children: ReactNode
  className?: string
}) {
  const bg = tone === 'surface' ? 'border-y border-border bg-surface' : ''
  return (
    <section id={id} className={`py-20 md:py-28 ${bg} ${className}`}>
      <div className={container}>{children}</div>
    </section>
  )
}

function HowItWorks({ t, lang, scenario }: { t: Copy; lang: Lang; scenario: BusinessScenario }) {
  const icons = [<BookIcon key="b" />, <ChatIcon key="c" />, <CheckIcon key="k" />, <ChartIcon key="r" />]
  return (
    <Section id="nasil" tone="surface">
      <Reveal>
        <SectionHeader eyebrow={t.how.eyebrow} title={t.how.title} body={t.how.body} />

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.how.steps.map((step, i) => (
            <li
              key={step.title}
              className="card-lift relative rounded-frame border border-border bg-canvas p-5"
            >
              <div className="flex items-center justify-between">
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-panel bg-band text-lg text-band-accent"
                >
                  {icons[i]}
                </span>
                <span className="font-heading text-xs font-semibold text-secondary tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-heading text-lg leading-snug font-semibold">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal className="mt-20 grid gap-8 md:mt-24">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div>
            <Eyebrow>{t.knowledge.eyebrow}</Eyebrow>
            <h3 className="mt-3 font-heading text-[clamp(1.5rem,1.2rem+1.2vw,2.125rem)] leading-tight font-semibold">
              {t.knowledge.title}
            </h3>
          </div>
          <p className="text-[1.0625rem] leading-relaxed text-secondary">{t.knowledge.body}</p>
        </div>
        <KnowledgePreview t={t.knowledge} lang={lang} example={t.demo.example} scenario={scenario} />
      </Reveal>
    </Section>
  )
}

function OwnerSection({ t, lang }: { t: Copy['owner']; lang: Lang }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [channel, setChannel] = useState(0)
  const channelIcons = [<ChatIcon key="t" />, <ChatIcon key="w" />, <SmartphoneIcon key="s" />]
  return (
    <Section id="yonetim">
      <Reveal>
        <SectionHeader eyebrow={t.eyebrow} title={t.title} body={t.body} />
        <div role="group" aria-label={t.title} className="mt-8 mb-10 flex flex-wrap gap-2">
          {t.channels.map((item, i) => (
            <button
              key={item.title}
              type="button"
              aria-pressed={channel === i}
              onClick={() => setChannel(i)}
              className="flex min-h-12 items-center gap-2 rounded-control border border-border bg-surface px-5 text-base font-medium text-secondary transition-colors hover:border-control aria-pressed:border-action aria-pressed:bg-action aria-pressed:text-on-action"
            >
              {channelIcons[i]}
              {item.title}
            </button>
          ))}
        </div>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-20">
          <div className="order-last lg:sticky lg:top-20 lg:order-first lg:self-start">
            {channel === 0 ? (
              <OwnerChat t={t} lang={lang} selected={selected === null ? null : t.commands[selected]} />
            ) : (
              <ChannelPreview lang={lang} channel={channel} owner={t} />
            )}
          </div>
          <div className="min-w-0">
            <div className="rounded-frame border border-border bg-assistant p-6">
              <h3 className="font-heading text-2xl font-semibold">{t.channels[channel].title}</h3>
              <p className="mt-3 text-lg leading-relaxed text-secondary">{t.channels[channel].body}</p>
            </div>

            {channel === 0 && (
              <div className="mt-8">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-heading text-lg font-semibold">{t.commandsTitle}</h3>
                  <p className="text-sm text-secondary">{t.commandsHint}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {t.commands.map((command, idx) => (
                    <button
                      key={command.ask}
                      type="button"
                      aria-pressed={selected === idx}
                      onClick={() => setSelected(selected === idx ? null : idx)}
                      className="group flex min-h-13 items-center gap-3 rounded-panel border border-border bg-surface px-4 py-3 text-left text-base transition-colors hover:border-control aria-pressed:border-action aria-pressed:bg-assistant"
                    >
                      <span
                        aria-hidden
                        className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-sm text-secondary transition-colors group-aria-pressed:border-action group-aria-pressed:bg-action group-aria-pressed:text-on-action"
                      >
                        {selected === idx ? <CheckIcon /> : <PlusIcon />}
                      </span>
                      <span className="font-medium">“{command.ask}”</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-8 flex gap-3 rounded-panel border border-border bg-surface p-4 text-sm leading-relaxed text-secondary">
              <ShieldCheckIcon aria-hidden className="mt-0.5 shrink-0 text-lg text-action" />
              {t.note}
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

const postTone: Record<PostStatus, { tone: Tone; icon: ReactNode }> = {
  published: { tone: 'success', icon: <CheckIcon /> },
  scheduled: { tone: 'info', icon: <CalendarIcon /> },
  held: { tone: 'attention', icon: <PauseIcon /> },
  pending: { tone: 'attention', icon: <ClockIcon /> },
}

function ContentAndReport({ t }: { t: Copy }) {
  return (
    <Section id="paylasim">
      <Reveal>
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <SectionHeader eyebrow={t.content.eyebrow} title={t.content.title} body={t.content.body} />
            <figure className="mt-10">
              <div className="overflow-hidden rounded-frame border border-border bg-surface shadow-frame">
                <figcaption className="flex items-center justify-between gap-2 border-b border-border bg-canvas px-5 py-3">
                  <span className="font-heading text-sm font-semibold">{t.content.heading}</span>
                  <ExampleLabel>{t.content.example}</ExampleLabel>
                </figcaption>
                <ul className="divide-y divide-border">
                  {t.content.posts.map((post, idx) => (
                    <li key={`${post.day}-${post.time}`} className="flex flex-col gap-3 px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex w-10 shrink-0 flex-col text-xs tabular-nums">
                          <span className="font-semibold">{post.day}</span>
                          <span className="text-secondary">{post.time}</span>
                        </div>
                        <PostThumb index={idx} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-xs text-secondary">{post.kind}</span>
                          <span className="truncate text-sm font-semibold">{post.title}</span>
                        </div>
                        <Badge
                          tone={postTone[post.state].tone}
                          size="sm"
                          icon={postTone[post.state].icon}
                          className="hidden sm:inline-flex"
                        >
                          {post.status}
                        </Badge>
                      </div>
                      <Badge
                        tone={postTone[post.state].tone}
                        size="sm"
                        icon={postTone[post.state].icon}
                        className="self-start sm:hidden"
                      >
                        {post.status}
                      </Badge>
                      {post.state === 'held' && (
                        <p className="flex items-start gap-2 rounded-control bg-attention-subtle px-3 py-2 text-xs leading-snug text-attention">
                          <PauseIcon aria-hidden className="mt-px shrink-0" />
                          {t.content.heldReason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-secondary">{t.content.note}</p>
            </figure>
          </div>

          <div className="min-w-0 lg:pt-[7.5rem]">
            <div>
              <h3 className="font-heading text-[clamp(1.5rem,1.2rem+1.2vw,2.125rem)] leading-tight font-semibold">
                {t.report.title}
              </h3>
              <p className="mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-secondary">
                {t.report.body}
              </p>
            </div>
            <figure className="mt-8 rounded-frame border border-border bg-surface p-5 shadow-frame">
              <figcaption className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-heading text-sm font-semibold">{t.report.heading}</p>
                  <p className="text-xs text-secondary">{t.report.asOf}</p>
                </div>
                <ExampleLabel>{t.report.example}</ExampleLabel>
              </figcaption>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {t.report.metrics.map(({ label, value }) => (
                  <div key={label} className="rounded-panel border border-border bg-canvas px-4 py-3">
                    <dt className="text-xs text-secondary">{label}</dt>
                    <dd
                      className={`mt-1 font-heading font-semibold tabular-nums ${
                        /^\d+$/.test(value) ? 'text-[1.75rem] leading-9 text-action' : 'text-base leading-9'
                      }`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-secondary">
                <CheckIcon aria-hidden className="mt-0.5 shrink-0 text-success" />
                {t.report.footerNote}
              </p>
            </figure>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {t.report.highlights.map((item) => (
                <li key={item.title} className="rounded-panel border border-border bg-surface p-4">
                  <h4 className="font-heading text-sm font-semibold">{item.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

function PostThumb({ index }: { index: number }) {
  if (index === 0 || index === 2) {
    return (
      <span
        aria-hidden
        className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md ring-1 ring-black/10"
      >
        <img
          src={`${import.meta.env.BASE_URL}preview/${index === 0 ? 'movement' : 'studio'}.jpg`}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      </span>
    )
  }
  const palettes = ['bg-[#d7dccd]', 'bg-[#e9dfcf]', 'bg-[#dfe7e2]', 'bg-[#e5e9d6]']
  return (
    <span
      aria-hidden
      className={`relative h-12 w-9 shrink-0 overflow-hidden rounded-md ring-1 ring-black/5 ${palettes[index % palettes.length]}`}
    >
      <span className="absolute -top-2 -right-2 size-5 rounded-full bg-[#253b31]/80" />
      <span className="absolute right-1.5 bottom-1.5 left-1.5 h-1 rounded-full bg-[#253b31]/40" />
    </span>
  )
}

function Trust({ t }: { t: Copy['trust'] }) {
  const controlIcons = [
    <SettingsIcon key="a" />,
    <HandIcon key="b" />,
    <UsersIcon key="c" />,
    <ListIcon key="d" />,
  ]
  const securityIcons = [
    <KeyIcon key="a" />,
    <ShieldCheckIcon key="b" />,
    <LayersIcon key="c" />,
    <TrashIcon key="d" />,
  ]
  const group = (title: string, items: Copy['trust']['control'], icons: ReactNode[]) => (
    <div>
      <h3 className="type-eyebrow text-band-accent">{title}</h3>
      <ul className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {items.map((item, i) => (
          <li key={item.title} className="flex gap-4">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-panel bg-white/8 text-lg text-band-accent ring-1 ring-white/10"
            >
              {icons[i]}
            </span>
            <div>
              <p className="font-heading font-semibold text-white dark:text-primary">{item.title}</p>
              <p className="mt-1 text-base leading-relaxed text-band-text/80">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
  return (
    <section id="guven" className="band-glow border-t border-white/10 bg-band py-20 text-band-text md:py-28">
      <Reveal className={container}>
        <header className="max-w-[44rem]">
          <p className="type-eyebrow text-band-accent">{t.eyebrow}</p>
          <h2 className="type-title mt-3 text-white dark:text-primary">{t.title}</h2>
          <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-band-text/85">{t.body}</p>
        </header>
        <div className="mt-14 grid gap-14 lg:grid-cols-2 lg:gap-16">
          {group(t.controlTitle, t.control, controlIcons)}
          {group(t.securityTitle, t.security, securityIcons)}
        </div>
      </Reveal>
    </section>
  )
}

function LocalPackage({
  t,
  onNavigate,
}: {
  t: Copy['localPackage']
  onNavigate: (r: Route, hash?: string) => void
}) {
  const icons = [
    <ChatIcon key="l" />,
    <ShieldCheckIcon key="k" />,
    <ListIcon key="i" />,
    <UsersIcon key="s" />,
    <TagIcon key="p" />,
  ]
  return (
    <Section id="paket" tone="surface">
      <Reveal>
        <SectionHeader eyebrow={t.eyebrow} title={t.title} body={t.body} />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.items.map((item, i) => (
            <li
              key={item.title}
              className="card-lift flex min-w-0 flex-col rounded-frame border border-border bg-canvas p-6 last:sm:col-span-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-panel bg-assistant text-lg text-action"
                >
                  {icons[i]}
                </span>
                {item.badge && (
                  <Badge tone="attention" size="sm" icon={<ClockIcon />}>
                    {item.badge}
                  </Badge>
                )}
              </div>
              <h3 className="mt-4 font-heading text-lg leading-snug font-semibold">{item.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-secondary">{item.body}</p>
              {i === 1 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-secondary">{t.legalLabel}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {t.legal.map((doc) => {
                      const localRoute: Route | null =
                        doc.path === '/privacy'
                          ? 'privacy'
                          : doc.path === '/terms'
                            ? 'terms'
                            : doc.path === '/kvkk'
                              ? 'kvkk'
                              : null
                      const href = localRoute ? doc.path : appLink(doc.path)
                      const chip =
                        'inline-flex min-h-9 items-center rounded-control border border-border bg-surface px-3 text-sm font-medium'
                      return (
                        <li key={doc.path}>
                          {href ? (
                            <a
                              href={href}
                              onClick={(e) => {
                                if (!localRoute || !isPlainLeftClick(e)) return
                                e.preventDefault()
                                onNavigate(localRoute)
                              }}
                              className={`${chip} text-action hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
                            >
                              {doc.label}
                            </a>
                          ) : (
                            <span className={`${chip} text-secondary`}>{doc.label}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          {PACKAGE_PRICE && (
            <div>
              <p className="type-eyebrow text-secondary">{t.priceLabel}</p>
              <p className="mt-1 font-heading text-3xl font-semibold">{PACKAGE_PRICE}</p>
            </div>
          )}
          <a href="#pilot" className={`${buttonPrimary} ${buttonLarge}`}>
            {t.cta}
          </a>
        </div>
      </Reveal>
    </Section>
  )
}

function Faq({ t }: { t: Copy['faq'] }) {
  return (
    <Section id="sss">
      <Reveal>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeader eyebrow={t.eyebrow} title={t.title} body={t.body} />
          </div>
          <div className="overflow-hidden rounded-frame border border-border bg-surface">
            {t.items.map((item) => (
              <details key={item.q} className="group border-b border-border last:border-b-0">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 px-5 py-4 font-heading text-base font-semibold transition-colors hover:bg-surface-subtle sm:px-6 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-secondary transition-transform group-open:rotate-45 group-open:border-action group-open:bg-action group-open:text-on-action"
                  >
                    <PlusIcon />
                  </span>
                </summary>
                <p className="max-w-[40rem] px-5 pb-5 text-base leading-relaxed text-secondary sm:px-6">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

function Pilot({
  t,
  lang,
  pilotRef,
  scenario,
  onNavigate,
}: {
  t: Copy
  lang: Lang
  pilotRef: RefObject<HTMLElement | null>
  scenario: BusinessScenario
  onNavigate: (r: Route, hash?: string) => void
}) {
  return (
    <section
      id="pilot"
      ref={pilotRef}
      className="relative overflow-hidden border-t border-border bg-assistant py-20 md:py-28"
    >
      <div
        className={`${container} relative grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] lg:gap-16`}
      >
        <div className="min-w-0">
          <SectionHeader eyebrow={t.pilot.eyebrow} title={t.pilot.title} body={t.pilot.body} />

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {t.pilot.expectations.map((item) => (
              <li key={item.title} className="card-lift rounded-panel border border-border bg-surface p-5">
                <Badge tone="brand" size="sm">
                  {item.badge}
                </Badge>
                <h3 className="mt-3 font-heading text-base font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-secondary">{item.detail}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <h3 className="type-eyebrow text-secondary">{t.pilot.nextStepsTitle}</h3>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3">
              {t.pilot.nextSteps.map((step, i) => (
                <li key={step.title} className="flex gap-3 sm:flex-col sm:gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-band font-heading text-sm font-semibold text-band-accent">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="text-sm text-secondary">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <WaitlistForm
            t={t.form}
            pilot={t.pilot}
            lang={lang}
            initialCategoryIdx={scenario.waitlistCategoryIdx}
            legalLinks={{
              privacy: t.footer.privacy,
              terms: t.footer.terms,
              kvkk: t.footer.kvkk,
              onNavigate,
            }}
          />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ footer */

function SiteFooter({
  t,
  route,
  onNavigate,
}: {
  t: Copy
  route: Route
  onNavigate: (r: Route, hash?: string) => void
}) {
  const sectionHref = (id: string) => (route === 'home' ? `#${id}` : `/#${id}`)
  const handleHomeNav = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (route === 'home' || !isPlainLeftClick(e)) return
    e.preventDefault()
    onNavigate('home', id)
  }

  return (
    <footer className={`border-t border-border bg-canvas ${route === 'home' ? 'pb-24 md:pb-0' : ''}`}>
      <div className={`${container} grid gap-8 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-start`}>
        <div className="max-w-md">
          <Brand label={PRODUCT_NAME} />
          <p className="mt-3 text-sm text-secondary">{t.footer.tagline}</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <nav aria-label={t.footer.siteNav} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {t.nav.links.map((link) => (
              <a
                key={link.id}
                href={sectionHref(link.id)}
                onClick={(e) => handleHomeNav(e, link.id)}
                className="text-secondary hover:text-primary"
              >
                {link.label}
              </a>
            ))}
            <a
              href={sectionHref('pilot')}
              onClick={(e) => handleHomeNav(e, 'pilot')}
              className="font-semibold text-action hover:underline"
            >
              {t.nav.cta}
            </a>
          </nav>
          <nav aria-label={t.footer.legalNav} className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <a
              href="/privacy"
              aria-current={route === 'privacy' ? 'page' : undefined}
              onClick={(e) => {
                if (!isPlainLeftClick(e)) return
                e.preventDefault()
                onNavigate('privacy')
              }}
              className="text-secondary hover:text-primary aria-[current=page]:font-semibold aria-[current=page]:text-action"
            >
              {t.footer.privacy}
            </a>
            <a
              href="/terms"
              aria-current={route === 'terms' ? 'page' : undefined}
              onClick={(e) => {
                if (!isPlainLeftClick(e)) return
                e.preventDefault()
                onNavigate('terms')
              }}
              className="text-secondary hover:text-primary aria-[current=page]:font-semibold aria-[current=page]:text-action"
            >
              {t.footer.terms}
            </a>
            {t.footer.kvkk && (
              <a
                href="/kvkk"
                aria-current={route === 'kvkk' ? 'page' : undefined}
                onClick={(e) => {
                  if (!isPlainLeftClick(e)) return
                  e.preventDefault()
                  onNavigate('kvkk')
                }}
                className="text-secondary hover:text-primary aria-[current=page]:font-semibold aria-[current=page]:text-action"
              >
                {t.footer.kvkk}
              </a>
            )}
          </nav>
        </div>
      </div>
      <div
        className={`${container} flex flex-col gap-3 border-t border-border py-6 text-xs text-secondary md:flex-row md:items-center md:justify-between`}
      >
        <p className="max-w-3xl leading-relaxed">{t.footer.trademark}</p>
        <div className="flex shrink-0 items-center gap-4">
          <span>© 2026 {PRODUCT_NAME}</span>
          <a
            href="#"
            onClick={(e) => {
              if (!isPlainLeftClick(e)) return
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            <ArrowUpIcon aria-hidden /> {t.footer.top}
          </a>
        </div>
      </div>
    </footer>
  )
}

/** Phones only: a quiet call to action once the hero is gone, hidden again at the form. */
function MobileCta({ t, hidden }: { t: Copy; hidden: boolean }) {
  return (
    <div
      aria-hidden={hidden}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-300 md:hidden ${
        hidden ? 'pointer-events-none translate-y-full' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 leading-tight">
          <Brand variant="wordmark" size="xs" label={PRODUCT_NAME} />
          <p className="truncate text-xs text-secondary">{t.mobileCta.sub}</p>
        </div>
        <a href="#pilot" tabIndex={hidden ? -1 : undefined} className={`${buttonPrimary} shrink-0`}>
          {t.mobileCta.label}
        </a>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- hooks */

function useInView(ref: RefObject<HTMLElement | null>, enabled = true) {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, enabled])
  return inView
}

/** The section in the upper part of the viewport, for the header's current-section marker. */
function useActiveSection(ids: string[], enabled = true) {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(',')
  useEffect(() => {
    if (!enabled) {
      setActive(null)
      return
    }
    if (!('IntersectionObserver' in window)) return
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting)
        setActive(key.split(',').find((id) => visible.get(id)) ?? null)
      },
      { rootMargin: '-35% 0px -60% 0px' },
    )
    for (const id of key.split(',')) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [key, enabled])
  return active
}
