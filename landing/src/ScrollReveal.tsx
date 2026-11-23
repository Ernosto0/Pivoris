import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Keep the section wrapper without hiding content behind scroll-triggered entrances. */
export function Reveal({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

/** Smoothly counts toward a target integer whenever `value` changes. */
export function AnimatedNumber({
  value,
  formatLocale,
  className = '',
}: {
  value: number
  formatLocale?: string
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const start = prevRef.current
    const diff = value - start
    if (diff === 0) return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setDisplay(value)
      prevRef.current = value
      return
    }

    const duration = 360
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = Math.round(start + diff * eased)
      prevRef.current = next
      setDisplay(next)
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        prevRef.current = value
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span className={className}>{formatLocale ? display.toLocaleString(formatLocale) : display}</span>
}

/** 2px reading progress hairline pinned directly under the sticky header. */
export function ScrollProgress() {
  const [ratio, setRatio] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      setRatio(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-transparent">
      <div
        className="h-full origin-left bg-action/50 transition-transform duration-150"
        style={{ transform: `scaleX(${ratio})` }}
      />
    </div>
  )
}
