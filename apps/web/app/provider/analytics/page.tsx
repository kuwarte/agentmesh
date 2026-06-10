'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useEffect, useState } from 'react'
import ProviderSidebar from '@/components/layout/ProviderSidebar'
import styles from '../Provider.module.css'

const earningsData = [
  { name: 'Jan', earnings: 420, calls: 188000 },
  { name: 'Feb', earnings: 760, calls: 284000 },
  { name: 'Mar', earnings: 610, calls: 230000 },
  { name: 'Apr', earnings: 980, calls: 371000 },
  { name: 'May', earnings: 1256, calls: 482000 },
]

const endpointMix = [
  { name: 'BTC', value: 42 },
  { name: 'ETH', value: 35 },
  { name: 'Weather', value: 15 },
  { name: 'Risk', value: 8 },
]

export default function ProviderAnalyticsPage() {
  const [chartsMounted, setChartsMounted] = useState(false)

  useEffect(() => {
    setChartsMounted(true)
  }, [])

  return (
    <div className={styles.layout}>
      <ProviderSidebar />

      <main className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Analytics</h1>
            <p className={styles.pageSubtitle}>
              Track provider revenue, call volume, settlement activity, and
              endpoint mix across your registered APIs.
            </p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Earnings</span>
            <div className={styles.statValue}>$1.25K</div>
            <span className={styles.badge}>+18.2%</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Call Success</span>
            <div className={styles.statValue}>99.8%</div>
            <span className={styles.statSubtext}>last 30 days</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Median Latency</span>
            <div className={styles.statValue}>82ms</div>
            <span className={styles.badge}>-11ms</span>
          </div>
        </div>

        <div className={styles.analyticsGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Earnings Trend</h2>
              <span className={styles.badge}>monthly</span>
            </div>
            <div className={styles.analyticsChart}>
              {chartsMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={earningsData}>
                    <XAxis dataKey="name" stroke="var(--color-text-faint)" />
                    <YAxis stroke="var(--color-text-faint)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    />
                    <Line
                      dataKey="earnings"
                      stroke="var(--color-accent)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Endpoint Mix</h2>
              <span className={styles.badge}>share</span>
            </div>
            <div className={styles.analyticsChart}>
              {chartsMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={endpointMix}>
                    <CartesianGrid stroke="rgba(34, 240, 120, 0.06)" />
                    <XAxis dataKey="name" stroke="var(--color-text-faint)" />
                    <YAxis stroke="var(--color-text-faint)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    />
                    <Bar dataKey="value" fill="var(--color-accent)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </section>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Operational Signals</h2>
          </div>
          <div className={styles.signalGrid}>
            {[
              ['Settlement delay', '0.8s', 'healthy'],
              ['Failed calls', '0.2%', 'below threshold'],
              ['Revenue share', '99%', 'provider payout'],
              ['Pending claims', '0', 'all settled'],
            ].map(([label, value, detail]) => (
              <div key={label} className={styles.signalCard}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
