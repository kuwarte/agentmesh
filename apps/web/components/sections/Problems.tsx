'use client'

import { useRef, useEffect } from 'react'
import styles from './Problems.module.css'

const PROBLEMS = [
  {
    num: '/01',
    title: 'Human-Gated Authentication',
    body: 'Platforms require credit cards, KYC verification, and manual account creation. Autonomous agents cannot satisfy these requirements without human delegation.',
    side: 'right',
  },
  {
    num: '/02',
    title: 'API Key Lifecycle Overhead',
    body: 'Managing, rotating, and securing centralized API keys introduces human oversight dependencies and systemic security exposure via key leakage.',
    side: 'left',
  },
  {
    num: '/03',
    title: 'Micropayment Floor Incompatibility',
    body: 'Credit card transaction floors make sub-cent pricing economically unviable, forcing agents into monthly subscriptions for data they may require once per session.',
    side: 'right',
  },
  {
    num: '/04',
    title: 'Centralized Platform Extraction',
    body: 'Aggregator platforms retain 20–30% of provider revenue, impose settlement delays of 7–30 days, and create single points of failure for data access infrastructure.',
    side: 'left',
  },
]

/* Number of trail history points */
const TRAIL_LEN = 28

export default function Problems() {
  const trackRef  = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* Current & target Y positions for smooth lerp */
  const currentY  = useRef(0)
  const targetY   = useRef(0)
  /* Ring pulse phase */
  const phase     = useRef(0)
  /* Trail: array of past Y positions */
  const trail     = useRef<number[]>([])
  const rafId     = useRef(0)

  useEffect(() => {
    const track  = trackRef.current
    const canvas = canvasRef.current
    if (!track || !canvas) return

    /* ── Resize canvas to match track ─────────────────── */
    const resize = () => {
      canvas.width  = track.offsetWidth
      canvas.height = track.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(track)

    /* ── Scroll → update targetY ───────────────────────
       Dot follows viewport center through the track.
    ──────────────────────────────────────────────────── */
    const onScroll = () => {
      const rect = track.getBoundingClientRect()
      const vh   = window.innerHeight
      const raw  = vh / 2 - rect.top
      targetY.current = Math.max(0, Math.min(track.offsetHeight, raw))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    /* ── rAF draw loop ─────────────────────────────────── */
    const cx    = canvas.width / 2   // fixed X = spine center
    const GREEN = '34, 240, 120'

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) { rafId.current = requestAnimationFrame(draw); return }

      /* Lerp current toward target — comet "drags" behind */
      const diff = targetY.current - currentY.current
      currentY.current += diff * 0.09

      const y = currentY.current

      /* Push current position into trail */
      trail.current.push(y)
      if (trail.current.length > TRAIL_LEN) trail.current.shift()

      /* Clear */
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      /* ── Draw trail segments ─────────────────────────
         Each segment connects two consecutive trail points.
         Opacity and width taper from head → tail.
      ─────────────────────────────────────────────────── */
      const len = trail.current.length
      for (let i = 1; i < len; i++) {
        const t0   = (i - 1) / (TRAIL_LEN - 1)   // 0 = oldest, 1 = newest
        const t1   = i       / (TRAIL_LEN - 1)
        const y0   = trail.current[i - 1]
        const y1   = trail.current[i]

        /* Taper: newest segment = full opacity/width */
        const alpha = t1 * t1 * 0.7                // squared for sharper head
        const width = 0.5 + t1 * 2.5               // 0.5px tail → 3px head

        ctx.beginPath()
        ctx.moveTo(cx, y0)
        ctx.lineTo(cx, y1)
        ctx.strokeStyle = `rgba(${GREEN}, ${alpha})`
        ctx.lineWidth   = width
        ctx.lineCap     = 'round'
        ctx.stroke()
      }

      /* ── Outer glow halo (large, very soft) ──────────── */
      const halo = ctx.createRadialGradient(cx, y, 0, cx, y, 28)
      halo.addColorStop(0,   `rgba(${GREEN}, 0.18)`)
      halo.addColorStop(0.5, `rgba(${GREEN}, 0.06)`)
      halo.addColorStop(1,   `rgba(${GREEN}, 0)`)
      ctx.beginPath()
      ctx.arc(cx, y, 28, 0, Math.PI * 2)
      ctx.fillStyle = halo
      ctx.fill()

      /* ── Mid glow (medium) ────────────────────────────── */
      const mid = ctx.createRadialGradient(cx, y, 0, cx, y, 10)
      mid.addColorStop(0,   `rgba(${GREEN}, 0.55)`)
      mid.addColorStop(0.6, `rgba(${GREEN}, 0.20)`)
      mid.addColorStop(1,   `rgba(${GREEN}, 0)`)
      ctx.beginPath()
      ctx.arc(cx, y, 10, 0, Math.PI * 2)
      ctx.fillStyle = mid
      ctx.fill()

      /* ── Solid core dot ───────────────────────────────── */
      ctx.beginPath()
      ctx.arc(cx, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${GREEN}, 1)`
      ctx.shadowColor  = `rgba(${GREEN}, 1)`
      ctx.shadowBlur   = 12
      ctx.fill()
      ctx.shadowBlur = 0

      /* ── Pulsing ring ─────────────────────────────────── */
      phase.current += 0.04
      const pulse  = (Math.sin(phase.current) + 1) / 2   // 0..1
      const rScale = 10 + pulse * 10                      // 10px..20px
      const rAlpha = 0.5 - pulse * 0.45                   // 0.5..0.05

      ctx.beginPath()
      ctx.arc(cx, y, rScale, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${GREEN}, ${rAlpha})`
      ctx.lineWidth   = 1
      ctx.stroke()

      rafId.current = requestAnimationFrame(draw)
    }

    rafId.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId.current)
      ro.disconnect()
    }
  }, [])

  return (
    <section className={styles.section} aria-label="Problems">

      {/* ── Header ──────────────────────────────────── */}
      <div className={styles.header}>
        <span className={styles.badge}>Something</span>
        <h2 className={styles.headline}>
          Four structural incompatibilities
          with autonomous agents.
        </h2>
        <p className={styles.sub}>
          Contemporary API infrastructure was designed for human-operated systems. As
          AI agents increasingly execute autonomous, complex goals requiring real-time
          external data, four structural blockers emerge.
        </p>
      </div>

      {/* ── Zigzag cards ────────────────────────────── */}
      <div className={styles.track} ref={trackRef}>

        {/* Vertical spine line */}
        <div className={styles.spine} aria-hidden="true" />

        {/* Canvas — draws comet dot + trail on top of spine */}
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          aria-hidden="true"
        />

        {PROBLEMS.map(({ num, title, body, side }) => (
          <div
            key={num}
            className={`${styles.row} ${side === 'left' ? styles.rowLeft : styles.rowRight}`}
          >
            <div className={styles.card}>
              <span className={styles.cardNum}>{num}</span>
              <div className={styles.cardImg} aria-hidden="true" />
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardBody}>{body}</p>
            </div>
          </div>
        ))}

      </div>

    </section>
  )
}