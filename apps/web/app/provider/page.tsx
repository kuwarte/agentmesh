'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAccount, useConnect } from 'wagmi'
import ProviderSidebar from '@/components/layout/ProviderSidebar'
import {
  fetchProviderOverview,
  fetchProviderEarnings,
  fetchProviderCalls,
  type ProviderOverview,
  type ProviderApi,
  type LedgerEntry,
  type EarningsBreakdown,
} from '@/lib/backend'
import styles from './Provider.module.css'

// ─── Connect Modal Component ──────────────────────────────────────────────────

function ConnectModal() {
  const { connect, connectors, isPending } = useConnect()
  const availableConnector = connectors[0]

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>

        <h2 className={styles.modalTitle}>Connect as Provider</h2>
        <p className={styles.modalDesc}>
          Link your wallet to register API endpoints, track earnings, and manage your on-chain listings on Morph L2.
        </p>

        <div className={styles.modalList}>
          <div className={styles.modalListItem}>
            <span className={styles.listDot} />
            Register endpoints — permissionless, no approval
          </div>
          <div className={styles.modalListItem}>
            <span className={styles.listDot} />
            99% of every call routes to your wallet
          </div>
          <div className={styles.modalListItem}>
            <span className={styles.listDot} />
            Instant USDC settlement via x402 protocol
          </div>
          <div className={styles.modalListItem}>
            <span className={styles.listDot} />
            Update pricing or deactivate any time
          </div>
        </div>

        <button
          className={styles.modalConnectBtn}
          onClick={() => connect({ connector: availableConnector })}
          disabled={isPending || !availableConnector}
        >
          {isPending ? 'Connecting...' : 'Connect Wallet'}
        </button>

        <span className={styles.modalFooter}>Morph L2 · EIP-1193 compatible</span>
      </div>
    </div>
  )
}

// ─── Dashboard Component ──────────────────────────────────────────────────────

function Dashboard() {
  const { address } = useAccount()

  const [overview,   setOverview]   = useState<ProviderOverview | null>(null)
  const [apis,       setApis]       = useState<ProviderApi[]>([])
  const [calls,      setCalls]      = useState<LedgerEntry[]>([])
  const [breakdown,  setBreakdown]  = useState<EarningsBreakdown[]>([])
  const [chartData,  setChartData]  = useState<{ name: string; earnings: number }[]>([])
  const [breakdownPeriod, setBreakdownPeriod] = useState('ALL')

  useEffect(() => {
    if (!address) return

    Promise.all([
      fetchProviderOverview(address),
      fetchProviderEarnings(address),
      fetchProviderCalls(address),
    ]).then(([ov, earn, callsData]) => {
      setOverview(ov.provider)
      setApis(ov.apis)
      setCalls(callsData.calls)
      setBreakdown(earn.breakdown)

      // Build a simple chart from call history grouped by month
      const byMonth: Record<string, number> = {}
      for (const c of ov.recentCalls) {
        const month = new Date(c.timestamp).toLocaleString('default', { month: 'short' })
        byMonth[month] = (byMonth[month] ?? 0) + parseFloat(c.amountUsd) * 0.99
      }
      setChartData(
        Object.entries(byMonth).map(([name, earnings]) => ({ name, earnings: parseFloat(earnings.toFixed(2)) }))
      )
    }).catch(console.error)
  }, [address])

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '—'

  const totalEarnings = overview?.totalEarningsUsd ?? '0.000000'

  // Max earnings for breakdown bar scaling
  const maxEarnings = breakdown.reduce((m, b) => Math.max(m, parseFloat(b.earningsUsd)), 0.001)

  return (
    <main className={styles.content}>
      {/* Top Header Row */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <div className={styles.walletId}>
            Wallet ID: {shortAddress}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer' }}>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </div>
        </div>
        <button className={styles.registerBtn}>REGISTER AN API</button>
      </div>

      {/* Balance Card */}
      <div className={styles.balanceCard}>
        <span className={styles.balanceLabel}>USDC Balance</span>
        <div className={styles.balanceValue}>
          {overview?.usdcBalance ?? '—'} <span className={styles.balanceCurrency}>USDC</span>
        </div>
        <div className={styles.balanceTrend}>▲ +{totalEarnings} earned</div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total API calls</span>
          <div className={styles.statValue}>{overview?.totalCalls?.toLocaleString() ?? '—'}</div>
          <span className={styles.badge}>on-chain settled</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Earnings</span>
          <div className={styles.statValue}>${totalEarnings}</div>
          <span className={styles.statSubtext}>after 1% platform fee</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>APIs Registered</span>
          <div className={styles.statValue}>{overview?.totalApis ?? '—'}</div>
          <span className={styles.badge}>{overview?.activeApis ?? 0} active</span>
        </div>
      </div>

      {/* Analytics Main Section */}
      <div className={styles.mainGrid}>
        {/* Earnings Chart Card */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <span className={styles.chartSub}>Total Earnings</span>
              <div className={styles.chartVal}>${totalEarnings}</div>
            </div>
          </div>

          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.length ? chartData : [{ name: '—', earnings: 0 }]}>
                <XAxis
                  dataKey="name"
                  stroke="var(--color-text-faint)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: '6px',
                  }}
                  itemStyle={{ color: 'var(--color-accent)' }}
                />
                <Line
                  type="monotone"
                  dataKey="earnings"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-bg-base)', stroke: 'var(--color-accent)' }}
                  activeDot={{ r: 5, fill: 'var(--color-accent)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Active Endpoints */}
        <div className={styles.endpointsCard}>
          <h3 className={styles.sectionTitle}>
            My Endpoints <span className={styles.titleBadge}>{apis.length}</span>
          </h3>
          <div className={styles.endpointsList}>
            {apis.map((ep) => (
              <div key={ep.apiId} className={styles.endpointRow}>
                <div>
                  <div className={styles.endpointName}>{ep.name}</div>
                  <div className={styles.endpointPrice}>
                    ${(Number(ep.pricePerCall) / 1_000_000).toFixed(4)}/call
                  </div>
                </div>
                <div className={styles.endpointEarned}>
                  {ep.active ? 'Active' : 'Inactive'}
                </div>
              </div>
            ))}
            {apis.length === 0 && (
              <div style={{ opacity: 0.4, fontSize: 13, padding: '12px 0' }}>No APIs registered yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Logs Table and Sector Splits */}
      <div className={styles.bottomGrid}>
        <div className={styles.tableCard}>
          <h3 className={styles.sectionTitle}>Call History</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>API / Endpoint</th>
                <th>Type</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((row) => (
                <tr key={row.txHash}>
                  <td>{new Date(row.timestamp).toLocaleString()}</td>
                  <td>{row.apiName}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.typeBadge}`}>
                      EARNING
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-accent)' }}>Settled</td>
                  <td className="text-mono">+${row.amountUsd}</td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ opacity: 0.4, textAlign: 'center', padding: '16px 0' }}>
                    No calls yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Earnings Breakdown */}
        <div className={styles.breakdownCard}>
          <div className={styles.breakdownTop}>
            <h3 className={styles.sectionTitle}>Earnings by API</h3>
            <div className={styles.toggleGroup}>
              {['ALL', '1M', '1W'].map((period) => (
                <button
                  key={period}
                  className={`${styles.toggleBtn} ${breakdownPeriod === period ? styles.toggleActive : ''}`}
                  onClick={() => setBreakdownPeriod(period)}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {breakdown.map((item) => (
            <div key={item.apiName} className={styles.breakdownRow}>
              <div className={styles.breakdownLabelRow}>
                <span>{item.apiName}</span>
                <span>${item.earningsUsd}</span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.round((parseFloat(item.earningsUsd) / maxEarnings) * 100)}%` }}
                />
              </div>
            </div>
          ))}

          {breakdown.length === 0 && (
            <div style={{ opacity: 0.4, fontSize: 13, padding: '12px 0' }}>No earnings yet</div>
          )}

          <div className={styles.breakdownTotal}>
            <span>Total Earnings</span>
            <span className={styles.totalVal}>${totalEarnings}</span>
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── Page Container ───────────────────────────────────────────────────────────

export default function ProviderPage() {
  const { isConnected } = useAccount()

  return (
    <div className={styles.layout}>
      <ProviderSidebar />
      {isConnected ? <Dashboard /> : <ConnectModal />}
    </div>
  )
}
