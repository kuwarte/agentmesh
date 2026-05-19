import styles from './CTA.module.css'

export default function CTA() {
  return (
    <section className={styles.cta} aria-label="Call to action">

      {/* Radial glow behind content */}
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.content}>
        <h2 className={styles.headline}>
          Ready to build the<br />
          <span className={styles.accent}>agent economy?</span>
        </h2>

        <p className={styles.sub}>
          Deploy your first endpoint in minutes. No KYC. No subscriptions. Just a wallet and USDC.
        </p>

        <button className={styles.btn}>
          Join Waitlist
        </button>
      </div>

    </section>
  )
}