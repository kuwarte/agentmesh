'use client'

import ProviderSidebar from '@/components/layout/ProviderSidebar'
import styles from '../Provider.module.css'

const providerApis = [
  {
    name: 'BTC/USD Price Feed',
    endpoint: 'api.agentmesh.io/v1/btc-price',
    status: 'Active',
    price: '0.0010 USDC',
    calls: '642.8K',
    revenue: '+$658.40',
  },
  {
    name: 'ETH/USD Price Feed',
    endpoint: 'api.agentmesh.io/v1/eth-price',
    status: 'Active',
    price: '0.0010 USDC',
    calls: '418.1K',
    revenue: '+$658.40',
  },
  {
    name: 'Global Weather API',
    endpoint: 'api.agentmesh.io/v1/weather',
    status: 'Active',
    price: '0.0020 USDC',
    calls: '91.4K',
    revenue: '+$124.00',
  },
  {
    name: 'Wallet Risk Score',
    endpoint: 'api.agentmesh.io/v1/wallet-risk',
    status: 'Draft',
    price: '0.0030 USDC',
    calls: '-',
    revenue: '$0.00',
  },
]

export default function ProviderApisPage() {
  return (
    <div className={styles.layout}>
      <ProviderSidebar />

      <main className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My APIs</h1>
            <p className={styles.pageSubtitle}>
              Manage pricing, availability, and endpoint metadata for the APIs
              listed under your provider wallet.
            </p>
          </div>
          <button className={styles.registerBtn}>REGISTER AN API</button>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Listed APIs</span>
            <div className={styles.statValue}>4</div>
            <span className={styles.badge}>3 active</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Avg. Price</span>
            <div className={styles.statValue}>0.0018</div>
            <span className={styles.statSubtext}>USDC per call</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Monthly Calls</span>
            <div className={styles.statValue}>1.15M</div>
            <span className={styles.badge}>+12.4%</span>
          </div>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Endpoint Registry</h2>
            <span className={styles.badge}>Morph L2 settlement</span>
          </div>

          <div className={styles.apiList}>
            {providerApis.map((api) => (
              <article key={api.name} className={styles.apiRow}>
                <div className={styles.apiMain}>
                  <span
                    className={`${styles.statusDot} ${
                      api.status === 'Draft' ? styles.statusDraft : ''
                    }`}
                  />
                  <div>
                    <h3>{api.name}</h3>
                    <code>{api.endpoint}</code>
                  </div>
                </div>

                <div className={styles.apiMetrics}>
                  <span>{api.status}</span>
                  <span>{api.price}</span>
                  <span>{api.calls}</span>
                  <strong>{api.revenue}</strong>
                </div>

                <button className={styles.secondaryBtn}>Manage</button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
