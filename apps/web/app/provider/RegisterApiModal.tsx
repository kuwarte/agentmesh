'use client'

import { FormEvent, useEffect, useState } from 'react'
import styles from './Provider.module.css'

type RegisterApiModalProps = {
  open: boolean
  onClose: () => void
}

const CATEGORIES = [
  'Price Feed',
  'Data Feed',
  'Security',
  'Geolocation',
  'Weather',
  'AI / Compute',
]

export default function RegisterApiModal({ open, onClose }: RegisterApiModalProps) {
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) setSubmitted(false)
  }, [open])

  if (!open) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div
        className={`${styles.modal} ${styles.registerModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-api-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.modalTop}>
          <div>
            <span className={styles.modalKicker}>Provider Registry</span>
            <h2 id="register-api-title" className={styles.modalTitle}>
              Register an API
            </h2>
          </div>

          <button
            type="button"
            className={styles.modalCloseBtn}
            aria-label="Close register API modal"
            onClick={onClose}
          >
            x
          </button>
        </div>

        <p className={styles.modalDesc}>
          Publish endpoint metadata, price each x402 call, and make the API
          discoverable in the Agent Mesh marketplace.
        </p>

        <form className={styles.registerForm} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <label className={styles.formField}>
              API Name
              <input name="name" placeholder="BTC/USD Price Feed" required />
            </label>

            <label className={styles.formField}>
              Category
              <select name="category" defaultValue="Price Feed" required>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.formFieldWide}>
              Endpoint URL
              <input
                name="endpoint"
                type="url"
                placeholder="https://api.example.com/v1/price"
                required
              />
            </label>

            <label className={styles.formField}>
              Price Per Call
              <input
                name="price"
                inputMode="decimal"
                placeholder="0.0010"
                required
              />
            </label>

            <label className={styles.formField}>
              Health Check Path
              <input name="health" placeholder="/health" />
            </label>

            <label className={styles.formFieldWide}>
              Tags
              <input
                name="tags"
                placeholder="crypto, realtime, oracle, market-data"
              />
            </label>

            <label className={styles.formFieldWide}>
              Description
              <textarea
                name="description"
                placeholder="Describe what the endpoint returns, freshness guarantees, limits, and expected response shape."
                required
              />
            </label>
          </div>

          <div className={styles.registrationSummary}>
            <span>x402 payment rail</span>
            <strong>Morph L2</strong>
            <span>Provider revenue</span>
            <strong>99%</strong>
          </div>

          {submitted ? (
            <p className={styles.modalSuccess}>
              API draft created. You can connect this to the on-chain registry
              flow when the backend endpoint is ready.
            </p>
          ) : null}

          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.modalConnectBtn}>
              Create API Draft
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
