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
import { morph } from '@/lib/chains'
import {
  fetchProviderOverview,
  fetchProviderEarnings,
  type ProviderOverview,
  type ProviderEarnings,
  type LedgerEntry,
} from '@/lib/backend'
import RegisterApiModal from './RegisterApiModal'
import styles from './Provider.module.css'

// ─── Connect Modal Component ──────────────────────────────────────────────────

function ConnectModal() {
  const { connect, connectors, error, isPending } = useConnect()

  const availableConnector =
    connectors.find((connector) => connector.type === 'injected') ??
    connectors[0]

  const handleConnect = () => {
    if (!availableConnector) return
    connect({ connector: availableConnector, chainId: morph.id })
  }

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
          {[
            'Register endpoints - permissionless, no approval',
            '99% of every call routes to your wallet',
            'Instant USDC settlement via x402 protocol',
            'Update pricing or deactivate any time',
          ].map((item) => (
            <div key={item} className={styles.modalListItem}>
              <span className={styles.listDot} />
              {item}
            </div>
          ))}
        </div>

        <button
          className={styles.modalConnectBtn}
          onClick={handleConnect}
          disabled={isPending || !availableConnector}
        >
          {isPending ? 'Connecting...' : 'Connect Wallet'}
        </button>
        {error ? <p className={styles.modalError}>{error.message}</p> : null}

        <span className={styles.modalFooter}>Morph L2 - EIP-1193 compatible</span>
      </div>
    </div>
  )
}

// ─── Dashboard Component ──────────────────────────────────────────────────────

function Dashboard() {
  const { address } = useAccount()
  const [breakdownPeriod, setBreakdownPeriod] = useState('ALL')
  const [registerOpen, setRegisterOpen] = useState(false)

  const [overview, setOverview] = useState<ProviderOverview | null>(null)
  const [earnings, setEarnings] = useState<ProviderEarnings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return

    let cancelled = false

    const load = (initial: boolean) => {
      if (initial) setLoading(true)
      Promise.all([
        fetchProviderOverview(address),
        fetchProviderEarnings(address),
      ])
        .then(([ov, ea]) => {
          if (cancelled) return
          setOverview(ov)
          setEarnings(ea)
        })
        .catch(console.error)
        .finally(() => { if (!cancelled && initial) setLoading(false) })
    }

    load(true)
    const interval = setInterval(() => load(false), 15_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [address])

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '—'

  const provider = overview?.provider
  const apis = overview?.apis ?? []
  const recentCalls: LedgerEntry[] = overview?.recentCalls ?? []
  const breakdown = earnings?.breakdown ?? []

  // Build chart data from earnings breakdown (one point per API)
  const chartData = breakdown.map((b) => ({
    name: b.apiName.length > 12 ? b.apiName.slice(0, 12) + '…' : b.apiName,
    earnings: parseFloat(b.earningsUsd),
  }))

  const formatUsd = (val: string | number | undefined) => {
    if (val === undefined || val === null) return '0.00'
    const n = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(n) ? '0.00' : n.toFixed(2)
  }

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
        <button
          className={styles.registerBtn}
          onClick={() => setRegisterOpen(true)}
        >
          REGISTER AN API
        </button>
      </div>

      {/* Balance Card */}
      <div className={styles.balanceCard}>
        <span className={styles.balanceLabel}>USDC Balance</span>
        <div className={styles.balanceValue}>
          {loading ? '—' : formatUsd(provider?.usdcBalance)}{' '}
          <span className={styles.balanceCurrency}>USDC</span>
        </div>
        <div className={styles.balanceTrend}>
          {loading ? '' : `+${formatUsd(provider?.totalEarningsUsd)} USDC total earned`}
        </div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total API calls</span>
          <div className={styles.statValue}>
            {loading ? '—' : (provider?.totalCalls ?? 0).toLocaleString()}
          </div>
          <span className={styles.badge}>as provider</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Earned</span>
          <div className={styles.statValue}>
            ${loading ? '—' : formatUsd(provider?.totalEarningsUsd)}
          </div>
          <span className={styles.statSubtext}>99% of each call</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>APIs Registered</span>
          <div className={styles.statValue}>
            {loading ? '—' : provider?.totalApis ?? 0}
          </div>
          <span className={styles.badge}>{loading ? '' : `${provider?.activeApis ?? 0} active`}</span>
        </div>
      </div>

      {/* Analytics Main Section */}
      <div className={styles.mainGrid}>
        {/* Earnings Chart Card */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <span className={styles.chartSub}>Total Earnings</span>
              <div className={styles.chartVal}>
                ${loading ? '—' : formatUsd(provider?.totalEarningsUsd)}
              </div>
            </div>
          </div>

          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
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
            {loading && <p style={{ opacity: 0.4, fontSize: '0.85rem' }}>Loading…</p>}
            {!loading && apis.length === 0 && (
              <p style={{ opacity: 0.4, fontSize: '0.85rem' }}>No APIs registered yet.</p>
            )}
            {apis.map((api) => {
              const earned = breakdown.find((b) => b.apiName === api.name)
              return (
                <div key={api.apiId} className={styles.endpointRow}>
                  <div>
                    <div className={styles.endpointName}>{api.name}</div>
                    <div className={styles.endpointPrice}>${api.priceUsd}/call</div>
                  </div>
                  <div className={styles.endpointEarned}>
                    {earned ? `+$${parseFloat(earned.earningsUsd).toFixed(4)}` : '$0.00'}
                  </div>
                </div>
              )
            })}
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
              {loading && (
                <tr>
                  <td colSpan={5} style={{ opacity: 0.4 }}>Loading…</td>
                </tr>
              )}
              {!loading && recentCalls.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ opacity: 0.4 }}>No calls yet.</td>
                </tr>
              )}
              {recentCalls.map((row, idx) => (
                <tr key={idx}>
                  <td>{new Date(row.timestamp).toLocaleString()}</td>
                  <td>{row.apiName}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.typeBadge}`}>
                      EARNING
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-accent)' }}>
                    {row.explorerUrl ? (
                      <a
                        href={row.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
                      >
                        Settled ↗
                      </a>
                    ) : 'Settled'}
                  </td>
                  <td className="text-mono">+${parseFloat(row.amountUsd).toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Earnings by API Breakdown */}
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

          {loading && <p style={{ opacity: 0.4, fontSize: '0.85rem' }}>Loading…</p>}
          {!loading && breakdown.length === 0 && (
            <p style={{ opacity: 0.4, fontSize: '0.85rem' }}>No earnings data yet.</p>
          )}
          {breakdown.map((item) => {
            const total = parseFloat(earnings?.totalEarningsUsd ?? '0') || 1
            const pct = Math.round((parseFloat(item.earningsUsd) / total) * 100)
            return (
              <div key={item.apiName} className={styles.breakdownRow}>
                <div className={styles.breakdownLabelRow}>
                  <span>{item.apiName}</span>
                  <span>${parseFloat(item.earningsUsd).toFixed(4)}</span>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}

          <div className={styles.breakdownTotal}>
            <span>Total Earned</span>
            <span className={styles.totalVal}>
              ${loading ? '—' : formatUsd(earnings?.totalEarningsUsd)}
            </span>
          </div>
        </div>
      </div>

      <RegisterApiModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
      />
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
