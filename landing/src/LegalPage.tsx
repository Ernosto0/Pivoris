import type { Lang } from './copy'
import { appLink } from './config'
import { kvkkDocument, kvkkEnNotice, legalCopy, type LegalDocKind, type LegalSection } from './legalCopy'
import {
  ArrowRightIcon,
  Badge,
  ClockIcon,
  Eyebrow,
  ShieldCheckIcon,
  buttonPrimary,
  buttonSecondary,
} from './ui'

export type Route = 'home' | LegalDocKind

type Props = {
  kind: LegalDocKind
  lang: Lang
  onNavigate: (route: Route, hash?: string) => void
}

const container = 'gutter mx-auto w-full max-w-[86rem]'

export function LegalPage({ kind, lang, onNavigate }: Props) {
  const ui = legalCopy[lang]
  const doc = kind === 'kvkk' ? kvkkDocument : ui[kind]
  const siblingKind: LegalDocKind = kind === 'privacy' ? 'terms' : 'privacy'
  const siblingHref = siblingKind === 'privacy' ? '/privacy' : '/terms'
  const dataDeletionHref = kind === 'privacy' || kind === 'kvkk' ? appLink('/data-deletion') : null
  const showKvkkCrossLink = lang === 'tr' && kind !== 'kvkk' && Boolean(ui.kvkkLinkLabel)

  return (
    <div className="py-12 md:py-20">
      <div className={container}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              e.preventDefault()
              onNavigate('home')
            }}
            className={`${buttonSecondary} text-sm`}
          >
            <span aria-hidden>←</span>
            {ui.backHome}
          </a>

          <div className="flex flex-wrap items-center gap-2">
            {showKvkkCrossLink && (
              <a
                href="/kvkk"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                  e.preventDefault()
                  onNavigate('kvkk')
                }}
                className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-secondary hover:bg-surface-subtle hover:text-primary"
              >
                {ui.kvkkLinkLabel}
              </a>
            )}
            <a
              href={siblingHref}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                e.preventDefault()
                onNavigate(siblingKind)
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-action hover:bg-surface-subtle"
            >
              {doc.siblingCta}
              <ArrowRightIcon aria-hidden />
            </a>
          </div>
        </div>

        {kind === 'kvkk' && lang === 'en' && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-assistant px-4 py-3 text-sm text-secondary">
            <span>{kvkkEnNotice.body}</span>
            <a
              href="/privacy"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                e.preventDefault()
                onNavigate('privacy')
              }}
              className="font-semibold text-action underline underline-offset-4 hover:text-action-hover"
            >
              {kvkkEnNotice.privacyLink}
            </a>
          </div>
        )}

        <div lang={kind === 'kvkk' ? 'tr' : undefined}>
          <header className="mt-10 max-w-[46rem]">
            <Eyebrow>{doc.eyebrow}</Eyebrow>
            <h1 className="type-title mt-3">{doc.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-secondary">{doc.subtitle}</p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Badge tone="neutral" size="sm" icon={<ShieldCheckIcon />}>
                {doc.versionBadge}
              </Badge>
              <Badge tone="attention" size="sm" icon={<ClockIcon />}>
                {doc.statusBadge}
              </Badge>
              <span className="text-xs font-medium text-secondary">{doc.effectiveDate}</span>
            </div>
          </header>

          <div className="mt-12 grid items-start gap-10 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-12">
            <aside className="rounded-panel border border-border bg-surface p-5 lg:sticky lg:top-24">
              <p className="type-eyebrow text-secondary">{doc.tocTitle}</p>
              <nav aria-label={doc.tocTitle} className="mt-3">
                <ol className="flex flex-col gap-1.5">
                  {doc.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="block rounded-control px-2.5 py-1.5 text-sm leading-snug text-secondary transition-colors hover:bg-surface-subtle hover:text-primary"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <article className="min-w-0 rounded-frame border border-border bg-surface p-6 shadow-frame sm:p-10">
              <div className="flex flex-col divide-y divide-border">
                {doc.sections.map((section, idx) => (
                  <SectionBlock key={section.id} section={section} first={idx === 0} />
                ))}
              </div>

              <div className="mt-10 flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="/#pilot"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                      e.preventDefault()
                      onNavigate('home', 'pilot')
                    }}
                    className={buttonPrimary}
                  >
                    {kind === 'kvkk' ? legalCopy.tr.applyPilot : ui.applyPilot}
                  </a>
                  <a
                    href={siblingHref}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                      e.preventDefault()
                      onNavigate(siblingKind)
                    }}
                    className={buttonSecondary}
                  >
                    {doc.siblingCta}
                  </a>
                </div>

                {dataDeletionHref && (
                  <a
                    href={dataDeletionHref}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-action underline-offset-4 hover:underline"
                  >
                    {kind === 'kvkk' || lang === 'tr' ? 'Veri silme talimatları' : 'Data deletion instructions'}
                  </a>
                )}
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionBlock({ section, first }: { section: LegalSection; first: boolean }) {
  return (
    <section id={section.id} className={first ? 'pb-8' : 'py-8 last:pb-0'}>
      <h2 className="font-heading text-xl font-semibold text-primary">{section.title}</h2>

      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="mt-3 max-w-[46rem] text-base leading-relaxed text-secondary">
          {renderWithEmailLinks(paragraph)}
        </p>
      ))}

      {section.bullets && (
        <ul className="mt-4 flex max-w-[46rem] flex-col gap-3">
          {section.bullets.map((bullet) => (
            <li key={bullet.text} className="flex gap-3 text-base leading-relaxed text-secondary">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-action" />
              <span>
                {bullet.label && <strong className="font-semibold text-primary">{bullet.label}: </strong>}
                {renderWithEmailLinks(bullet.text)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {section.table && (
        <div className="mt-5 overflow-x-auto rounded-panel border border-border">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle">
                {section.table.headers.map((header) => (
                  <th key={header} scope="col" className="px-4 py-3 font-heading font-semibold text-primary">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {section.table.rows.map((row) => (
                <tr key={row[0]} className="align-top">
                  {row.map((cell, cellIdx) => (
                    <td
                      key={`${row[0]}-${cellIdx}`}
                      className={`px-4 py-3 leading-relaxed ${
                        cellIdx === 0 ? 'font-medium text-primary' : 'text-secondary'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.note && (
        <p className="mt-5 max-w-[46rem] rounded-panel border border-border bg-assistant px-4 py-3 text-sm leading-relaxed text-secondary">
          {section.note}
        </p>
      )}
    </section>
  )
}

function renderWithEmailLinks(text: string) {
  const emailRegex = /([a-zA-Z0-9._%+-]+@pivoris\.com)/g
  const parts = text.split(emailRegex)
  if (parts.length === 1) return text
  return parts.map((part, idx) =>
    part.endsWith('@pivoris.com') ? (
      <a
        key={`${part}-${idx}`}
        href={`mailto:${part}`}
        className="font-medium text-action underline underline-offset-4 hover:text-action-hover"
      >
        {part}
      </a>
    ) : (
      part
    ),
  )
}
