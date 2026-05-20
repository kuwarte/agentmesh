'use client'

import { useRef, useState } from 'react'
import { useReveal } from '@/hooks/useReveal'
import styles from './CTA.module.css'

const TARGET_TEXT = 'Join Waitlist'
const CHARS = '!@#$%^&*():{};|,.<>/?'
const SHUFFLE_TIME = 16
const CYCLES_PER_LETTER = 1.5

export default function CTA() {
  const contentRef  = useReveal<HTMLDivElement>({ threshold: 0.25 })
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const [text,    setText]    = useState(TARGET_TEXT)
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState<'idle'|'success'|'error'|'duplicate'>('idle')
  const [errorMsg,setErrorMsg]= useState('')

  /* Scramble */
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

  /* Submit */
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

      if (res.status === 409) { setStatus('duplicate'); return }
      if (!res.ok) { setStatus('error'); setErrorMsg(data.error || 'Something went wrong.'); return }

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

  return (
    <section className={styles.cta} aria-label="Call to action">
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.content} ref={contentRef} data-reveal="up">

        <h2 className={`${styles.headline} ${styles.revealChild}`} style={{ transitionDelay: '0ms' }}>
          Ready to build the
          <span className={styles.accent}>agent economy?</span>
        </h2>

        <p className={`${styles.sub} ${styles.revealChild}`} style={{ transitionDelay: '80ms' }}>
          Deploy your first endpoint in minutes. No KYC. No subscriptions.
          Just a wallet and USDC.
        </p>

        <div className={`${styles.revealChild}`} style={{ transitionDelay: '160ms' }}>
          {status === 'success' ? (
            <div className={styles.successMsg}>
              <span className={styles.successIcon}>✓</span>
              You&apos;re on the list. We&apos;ll be in touch.
            </div>
          ) : (
            <div className={`${styles.formWrap} ${status === 'error' ? styles.formError : ''}`}>
              <div className={styles.inputWrap}>
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
                className={styles.btn}
                onClick={joinWaitlist}
                disabled={loading || !email}
                onMouseEnter={scramble}
                onMouseLeave={stopScramble}
              >
                <span className={styles.btnText}>
                  {loading ? 'Joining...' : text}
                </span>
              </button>
            </div>
          )}

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