'use client'

import { useRef, useEffect } from 'react'
import styles from './TechnicalApproach.module.css'

const STEPS = [
  {
    num: '01',
    title: 'Registry Discovery',
    body: 'The agent queries the on-chain ',
    code: 'AgentMeshRegistry',
    body2: ' contract on Morph L2 to resolve an endpoint URL and its USDC price per call. No off-chain directory, no account required.',
  },
  {
    num: '02',
    title: 'Challenge Initiation',
    body: 'The agent issues an unsigned GET request. Provider middleware intercepts it and returns HTTP 402 Payment Required — containing the endpoint ID, required USDC amount, facilitator contract address, and chain ID.',
    code: null,
    body2: '',
  },
  {
    num: '03',
    title: 'Autonomous Payment Authorization',
    body: 'The agent constructs and signs an EIP-3009 USDC ',
    code: 'transferWithAuthorization',
    body2: ' using its private key. A unique nonce and short-expiry deadline prevent replay attacks. The signed payload is attached to the X-Payment header.',
  },
  {
    num: '04',
    title: 'On-chain Settlement Verification',
    body: 'Provider middleware calls ',
    code: 'X402Facilitator.settle()',
    body2: ' on Morph L2. The contract verifies the EIP-712 signature, enforces nonce uniqueness, validates the deadline, and executes the USDC transfer — 99% to the provider, 1% to the protocol treasury.',
  },
  {
    num: '05',
    title: 'Data Release',
    body: 'Upon confirmed on-chain settlement, provider middleware releases the API response with HTTP 200 OK. The agent receives the data. The entire cycle — discovery to data receipt — requires zero human interaction.',
    code: null,
    body2: '',
  },
]

const BEAM_COUNT = 72

export default function TechnicalApproach() {
  const beamsRef    = useRef<HTMLDivElement>(null)
  const wrapRef     = useRef<HTMLDivElement>(null)
  const rafRef      = useRef<number>(0)
  const progressRef = useRef(0)   // 0 = dark, 1 = fully lit
  const targetRef   = useRef(0)   // scroll-driven target

  useEffect(() => {
    const wrap = wrapRef.current
    const beamsEl = beamsRef.current
    if (!wrap || !beamsEl) return

    /* ── Scroll → target progress ───────────────────────
       As the beamWrap enters the viewport from the bottom,
       target goes 0 → 1. When scrolling back up, reverses.
    ─────────────────────────────────────────────────────*/
    const onScroll = () => {
      const rect     = wrap.getBoundingClientRect()
      const vh       = window.innerHeight
      // How far the bottom of the wrap has scrolled into view
      // 0 = wrap bottom just touched viewport bottom
      // 1 = wrap top has reached viewport center
      const entered  = vh - rect.top
      const total    = rect.height + vh * 0.5
      targetRef.current = Math.min(1, Math.max(0, entered / total))
    }

    /* ── rAF loop — smoothly lerp progress → target ─────*/
    const beams = beamsEl.querySelectorAll<HTMLElement>(`.${styles.beam}`)

    const tick = () => {
      // Lerp current toward target
      const diff = targetRef.current - progressRef.current
      if (Math.abs(diff) > 0.0005) {
        progressRef.current += diff * 0.06

        const p = progressRef.current

        beams.forEach((beam, i) => {
          const centerDist = parseFloat(beam.style.getPropertyValue('--center-dist') || '0')

          // Each beam lights up with a bottom-to-top wave:
          // beams at the bottom (low index or high index = edge) light later
          // stagger based on index so wave sweeps left→right as well
          const wave    = (i / (BEAM_COUNT - 1))           // 0..1 left→right
          const delay   = 0.15 + wave * 0.3                // stagger offset
          const local   = Math.min(1, Math.max(0, (p - delay) / (1 - delay)))
          const eased   = local * local * (3 - 2 * local)  // smoothstep

          // Opacity boost driven by scroll + center proximity
          const boost   = eased * (0.5 + centerDist * 0.5)
          beam.style.setProperty('--scroll-boost', String(boost))

          // scaleY: beams grow upward as scroll progresses
          const scale   = 0.4 + eased * 0.6
          beam.style.setProperty('--scroll-scale', String(scale))
        })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // init on mount
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <section className={styles.section} aria-label="Technical Approach">

      {/* ── Main content grid ───────────────────────── */}
      <div className={styles.grid}>

        {/* Left col */}
        <div className={styles.left}>
          <div className={styles.badge}>
            <span className={styles.badgeLine} aria-hidden="true" />
            <span className={styles.badgeText}>Technical Approach</span>
          </div>

          <h2 className={styles.headline}>
            Payment-as-<br />
            authentication.<br />
            A five-step<br />
            protocol.
          </h2>

          <p className={styles.body}>
            The approach replaces credential-based authentication
            with payment proof across three distinct system
            components, requiring zero human interaction end-to-end.
          </p>
        </div>

        {/* Right col — steps */}
        <div className={styles.right}>
          {STEPS.map(({ num, title, body, code, body2 }) => (
            <div key={num} className={styles.step}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNum}>{num}</span>
                <h3 className={styles.stepTitle}>{title}</h3>
              </div>
              <p className={styles.stepBody}>
                {body}
                {code && <code className={styles.code}>{code}</code>}
                {body2}
              </p>
            </div>
          ))}
        </div>

      </div>

      {/* ── Beam footer — full viewport width ───────── */}
      <div className={styles.beamWrap} ref={wrapRef} aria-hidden="true">

        {/* Full-bleed beam container — escapes container padding */}
        <div className={styles.beams} ref={beamsRef}>
          {Array.from({ length: BEAM_COUNT }).map((_, i) => {
            const centerDist = 1 - Math.abs(i / (BEAM_COUNT - 1) - 0.5) * 2
            return (
              <span
                key={i}
                className={styles.beam}
                style={{
                  '--i':            i,
                  '--center-dist':  centerDist,
                  '--scroll-boost': 0,
                  '--scroll-scale': 0.4,
                } as React.CSSProperties}
              />
            )
          })}
        </div>

        <div className={styles.beamGlow} />
        <div className={styles.beamFade} />
      </div>

    </section>
  )
}