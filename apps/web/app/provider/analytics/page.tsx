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
import { useAccount, useConnect } from 'wagmi'
import ProviderSidebar from '@/components/layout/ProviderSidebar'
import styles from '../Provider.module.css'
import { morph } from '@/lib/chains'
import {
  fetchProviderOverview,
  fetchProviderEarnings,
  type ProviderOverview,
  type ProviderEarnings,
} from '@/lib/backend'

// ─── Connect prompt ───────────────────────────────────────────────────────────
function ConnectPrompt() {
  const { connect, connectors, isPending } = useConnect()
  const connector =
    connectors.find((c) => c.type === 'injected') ?? connectors[0]

  return (
    <main className={styles.content}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.pageSubtitle}>
            Connect your wallet to view earnings and call volume analytics.
          </p>
        </div>
      </div>
      <div className={styles.panel} style={{ textAlign: 'center', padding: '48px 0' }}>
        <p style={{ color: 'var(--color-text-faint)', marginBottom: '16px' }}>
          Wallet not connected
        </p>
        <button
          className={styles.registerBtn}
          onClick={() => connector && connect({ connector, chainId: morph.id })}
          disabled={isPending || !connector}
        >
          {isPending ? 'Connecting…' : 'Connect Wallet'}
        </button>
      </div>
    </main>
  )
}

// ─── Analytics Content ────────────────────────────────────────────────────────
function AnalyticsContent() {
  const { address } = useAccount()
  const [chartsMounted, setChartsMounted] = useState(false)
  const [overview, setOverview] = useState<ProviderOverview | null>(null)
  const [earnings, setEarnings] = useState<ProviderEarnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setChartsMounted(true)
  }, [])

  useEffect(() => {
    if (!address) return
    setLoading(true)
    setError(null)
    Promise.all([
      fetchProviderOverview(address),
      fetchProviderEarnings(address),
    ])
      .then(([ov, ea]) => {
        setOverview(ov)
        setEarnings(ea)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [address])

  const provider = overview?.provider
  const breakdown = earnings?.breakdown ?? []
  const recentCalls = overview?.recentCalls ?? []

  // Earnings trend: one point per API (earnings)
  const earningsData = breakdown.map((b) => ({
    name: b.apiName.length > 10 ? b.apiName.slice(0, 10) + '…' : b.apiName,
    earnings: parseFloat(b.earningsUsd),
  }))

  // Endpoint mix: one bar per API (call share)
  const endpointMix = breakdown.map((b) => ({
    name: b.apiName.length > 8 ? b.apiName.slice(0, 8) + '…' : b.apiName,
    calls: b.calls,
  }))

  const totalEarnings = parseFloat(earnings?.totalEarningsUsd ?? '0')
  const totalCalls = provider?.totalCalls ?? 0

  // Success rate: settled / total from recent calls (rough)
  const settledCalls = recentCalls.length
  const successRate =
    totalCalls > 0 ? ((settledCalls / Math.max(totalCalls, settledCalls)) * 100).toFixed(1) : '–'

  const formatUsd = (val: string | number | undefined) => {
    if (val === undefined || val === null) return '0.00'
    const n = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(n) ? '0.00' : n < 1000 ? `$${n.toFixed(2)}` : `$${(n / 1000).toFixed(2)}K`
  }

  return (
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

      {error && (
        <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</p>
      )}

      {/* Stats row */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Earnings</span>
          <div className={styles.statValue}>
            {loading ? '–' : formatUsd(totalEarnings)}
          </div>
          <span className={styles.badge}>all time</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Calls</span>
          <div className={styles.statValue}>
            {loading ? '–' : totalCalls.toLocaleString()}
          </div>
          <span className={styles.statSubtext}>as provider</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active APIs</span>
          <div className={styles.statValue}>
            {loading ? '–' : provider?.activeApis ?? 0}
          </div>
          <span className={styles.badge}>
            {loading ? '' : `of ${provider?.totalApis ?? 0} total`}
          </span>
        </div>
      </div>

      {/* Charts */}
      <div className={styles.analyticsGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Earnings by API</h2>
            <span className={styles.badge}>all time</span>
          </div>
          <div className={styles.analyticsChart}>
            {loading && (
              <p style={{ opacity: 0.4, fontSize: '0.85rem', padding: '12px 0' }}>
                Loading…
              </p>
            )}
            {!loading && earningsData.length === 0 && (
              <p style={{ opacity: 0.4, fontSize: '0.85rem', padding: '12px 0' }}>
                No earnings data yet.
              </p>
            )}
            {!loading && earningsData.length > 0 && chartsMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={earningsData}>
                  <XAxis dataKey="name" stroke="var(--color-text-faint)" />
                  <YAxis stroke="var(--color-text-faint)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                    formatter={(val) => [`$${Number(val ?? 0).toFixed(4)}`, 'Earnings']}
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
            <h2 className={styles.panelTitle}>Call Volume by API</h2>
            <span className={styles.badge}>share</span>
          </div>
          <div className={styles.analyticsChart}>
            {loading && (
              <p style={{ opacity: 0.4, fontSize: '0.85rem', padding: '12px 0' }}>
                Loading…
              </p>
            )}
            {!loading && endpointMix.length === 0 && (
              <p style={{ opacity: 0.4, fontSize: '0.85rem', padding: '12px 0' }}>
                No call data yet.
              </p>
            )}
            {!loading && endpointMix.length > 0 && chartsMounted ? (
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
                    formatter={(val) => [Number(val ?? 0).toLocaleString(), 'Calls']}
                  />
                  <Bar dataKey="calls" fill="var(--color-accent)" />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </section>
      </div>

      {/* Operational signals */}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Operational Signals</h2>
        </div>
        <div className={styles.signalGrid}>
          {[
            [
              'Total Earnings',
              loading ? '–' : formatUsd(totalEarnings),
              'all time',
            ],
            [
              'Total Calls',
              loading ? '–' : totalCalls.toLocaleString(),
              'as provider',
            ],
            [
              'Active APIs',
              loading ? '–' : String(provider?.activeApis ?? 0),
              `of ${provider?.totalApis ?? 0} registered`,
            ],
            [
              'USDC Balance',
              loading ? '–' : formatUsd(provider?.usdcBalance),
              'current balance',
            ],
          ].map(([label, value, detail]) => (
            <div key={label} className={styles.signalCard}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </div>
      </section>

      {/* Recent call log */}
      {recentCalls.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent Settlements</h2>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>API</th>
                <th>Payer</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentCalls.map((row, idx) => (
                <tr key={idx}>
                  <td>{new Date(row.timestamp).toLocaleString()}</td>
                  <td>{row.apiName}</td>
                  <td>
                    {row.payer.slice(0, 6)}…{row.payer.slice(-4)}
                  </td>
                  <td className="text-mono">
                    +${parseFloat(row.amountUsd).toFixed(6)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProviderAnalyticsPage() {
  const { isConnected } = useAccount()

  return (
    <div className={styles.layout}>
      <ProviderSidebar />
      {isConnected ? <AnalyticsContent /> : <ConnectPrompt />}
    </div>
  )
}
