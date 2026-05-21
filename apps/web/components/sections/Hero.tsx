'use client'

import {
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react'
import styles from './Hero.module.css'

const BEAM_COUNT = 75
const TARGET_TEXT = 'Join Waitlist'
const CHARS = '!@#$%^&*():{};|,.<>/?'
const SHUFFLE_TIME = 28
const CYCLES_PER_LETTER = 2

export default function Hero() {
  const beamsRef    = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const [text,          setText]          = useState(TARGET_TEXT)
  const [email,         setEmail]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [status,        setStatus]        = useState<'idle'|'success'|'error'|'duplicate'>('idle')
  const [errorMsg,      setErrorMsg]      = useState('')
  const [waitlistCount, setWaitlistCount] = useState(0)

  /* ── Fetch live count on mount ──────────────────────── */
  useEffect(() => {
    fetch('/api/waitlist')
      .then(r => r.json())
      .then(d => setWaitlistCount(d.count || 0))
      .catch(() => {})
  }, [])

  /* ── Scramble effect ────────────────────────────────── */
  const scramble = () => {
    let pos = 0
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setText(
        TARGET_TEXT.split('').map((char, i) => {
          if (char === ' ') return ' '
          if (pos / CYCLES_PER_LETTER > i) return char
          return CHARS[Math.floor(Math.random() * CHARS.length)]
        }).join('')
      )
      pos++
      if (pos >= TARGET_TEXT.length * CYCLES_PER_LETTER) stopScramble()
    }, SHUFFLE_TIME)
  }

  const stopScramble = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setText(TARGET_TEXT)
  }

  /* ── Submit ─────────────────────────────────────────── */
  const joinWaitlist = async () => {
    if (!email || loading) return
    setLoading(true)
    setStatus('idle')
    setErrorMsg('')

    try {
      const res  = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setStatus('duplicate')
        return
      }
      if (!res.ok) {
        setStatus('error')
        setErrorMsg(data.error || 'Something went wrong.')
        return
      }

      setWaitlistCount(data.count)
      setEmail('')
      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMsg('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') joinWaitlist()
  }

  /* ── Beam hover ─────────────────────────────────────── */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = beamsRef.current
    if (!container) return
    const rect  = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const beams  = container.querySelectorAll<HTMLElement>(`.${styles.beam}`)
    const total  = beams.length
    beams.forEach((beam, i) => {
      const cx   = (i / (total - 1)) * rect.width
      const dist = Math.abs(mouseX - cx)
      const prox = Math.max(0, 1 - dist / (rect.width * 0.28))
      const boost = Math.pow(prox, 2.8)
      beam.style.setProperty('--hover-boost',  String(boost))
      beam.style.setProperty('--hover-scaleX', String(1 + boost * 0.18))
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    beamsRef.current
      ?.querySelectorAll<HTMLElement>(`.${styles.beam}`)
      .forEach(b => {
        b.style.setProperty('--hover-boost',  '0')
        b.style.setProperty('--hover-scaleX', '1')
      })
  }, [])

  useEffect(() => {
    const hero = beamsRef.current?.closest(`.${styles.hero}`) as HTMLElement | null
    if (!hero) return
    hero.addEventListener('mousemove',  handleMouseMove  as EventListener)
    hero.addEventListener('mouseleave', handleMouseLeave as EventListener)
    return () => {
      hero.removeEventListener('mousemove',  handleMouseMove  as EventListener)
      hero.removeEventListener('mouseleave', handleMouseLeave as EventListener)
    }
  }, [handleMouseMove, handleMouseLeave])

  return (
    <section className={styles.hero} aria-label="Hero">

      <div className={styles.beams} ref={beamsRef} aria-hidden="true">
        {Array.from({ length: BEAM_COUNT }).map((_, i) => {
          const centerDist = 1 - Math.abs(i / (BEAM_COUNT - 1) - 0.5) * 2
          return (
            <span key={i} className={styles.beam} style={{
              '--i': i, '--center-dist': centerDist,
              '--hover-boost': 0, '--hover-scaleX': 1,
            } as React.CSSProperties} />
          )
        })}
      </div>

      <div className={styles.glowPool}  aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.content}>

        <h1 className={`${styles.headline} animate-fade-up delay-200`}>
          APIs for<br />
          <span className={styles.headlineAccent}>Autonomous Agents</span>
        </h1>

        <p className={`${styles.sub} animate-fade-up delay-300`}>
          Discover, pay, and access APIs instantly,<br />
          no accounts or API keys required.
        </p>

        {/* Waitlist count */}
        <div className={`${styles.waitlist} animate-fade-up delay-400`}>
          <div className={styles.avatars} aria-hidden="true">
            <span className={styles.avatar} />
            <span className={styles.avatar} />
            <span className={styles.avatar} />
          </div>
          <span className={styles.waitlistText}>
            {waitlistCount.toLocaleString()} worldwide on waitlist
          </span>
        </div>

        {/* Form */}
        <div className={`animate-fade-up delay-500`}>
          {status === 'success' ? (
            <div className={styles.successMsg}>
              <span className={styles.successIcon}>✓</span>
              You&apos;re on the list. We&apos;ll be in touch.
            </div>
          ) : (
            <div className={styles.formWrap}>
              <div className={`${styles.inputWrap} ${status === 'error' ? styles.inputError : ''}`}>
                <span className={styles.inputPrefix} aria-hidden="true">@</span>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className={styles.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                  aria-label="Email address"
                />
              </div>
              <button
                className={styles.cta}
                onClick={joinWaitlist}
                disabled={loading || !email}
                onMouseEnter={scramble}
                onMouseLeave={stopScramble}
              >
                <span>{loading ? 'Joining...' : text}</span>
              </button>
            </div>
          )}

          {/* Inline status messages */}
          {status === 'duplicate' && (
            <p className={styles.statusNote}>Already on the list — we&apos;ll reach out soon.</p>
          )}
          {status === 'error' && (
            <p className={`${styles.statusNote} ${styles.statusError}`}>{errorMsg}</p>
          )}
        </div>

      </div>
    </section>
  )
}