'use client'

import { useState } from 'react'
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
import RegisterApiModal from './RegisterApiModal'
import styles from './Provider.module.css'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const chartData = [
  { name: 'Jan', earnings: 400 },
  { name: 'Feb', earnings: 800 },
  { name: 'Mar', earnings: 600 },
  { name: 'Apr', earnings: 1000 },
  { name: 'May', earnings: 1256.5 },
]

const ENDPOINTS = [
  { name: 'BTC/USD Price Feed', price: '$0.0010/call', earned: '+$658.40' },
  { name: 'ETH/USD Price Feed', price: '$0.0010/call', earned: '+$658.40' },
  { name: 'Global Weather API', price: '$0.0010/call', earned: '+$124.00' },
]

const CALL_HISTORY = [
  {
    ts: 'May 20 14:57:59',
    name: 'Web Content Scraper',
    type: 'API CALL',
    status: 'Settled',
    amount: '-$0.0041',
  },
  {
    ts: 'May 20 14:57:59',
    name: 'Web Content Scraper',
    type: 'EARNING',
    status: 'Settled',
    amount: '+$1.0044',
  },
  {
    ts: 'May 20 14:57:59',
    name: 'BTC/USD Price Feed',
    type: 'REGISTRY',
    status: 'Settled',
    amount: '-',
  },
]

const BREAKDOWN = [
  { label: 'Crypto / DeFi', val: '$850.50', pct: 75 },
  { label: 'Finance', val: '$201.00', pct: 40 },
  { label: 'Web Scraping', val: '$105.00', pct: 20 },
  { label: 'AI / Compute', val: '$100.00', pct: 15 },
]

// ─── Connect Modal Component ──────────────────────────────────────────────────

function ConnectModal() {
  const { connect, connectors, error, isPending } = useConnect()
  
  const availableConnector =
    connectors.find((connector) => connector.type === 'injected') ??
    connectors[0]

  const handleConnect = () => {
    if (!availableConnector) return

    connect({
      connector: availableConnector,
      chainId: morph.id,
    })
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
          <div className={styles.modalListItem}>
            <span className={styles.listDot} />
            Register endpoints - permissionless, no approval
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

        {/* Unified, single option wallet execution button */}
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

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '0x4F3A...839B'

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
          4,284.41 <span className={styles.balanceCurrency}>USDC</span>
        </div>
        <div className={styles.balanceTrend}>+0.0203 USDC</div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total API calls</span>
          <div className={styles.statValue}>1.2M</div>
          <span className={styles.badge}>2.8K today</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Transactions</span>
          <div className={styles.statValue}>1.3K</div>
          <span className={styles.statSubtext}>1.3K settled on-chain</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>APIs Registered</span>
          <div className={styles.statValue}>6</div>
          <span className={styles.badge}>+1 this week</span>
        </div>
      </div>

      {/* Analytics Main Section */}
      <div className={styles.mainGrid}>
        {/* Earnings Chart Card */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <span className={styles.chartSub}>Total Earnings</span>
              <div className={styles.chartVal}>$1,256.50</div>
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

        {/* Right Active Endpoints Checklist */}
        <div className={styles.endpointsCard}>
          <h3 className={styles.sectionTitle}>
            My Endpoints <span className={styles.titleBadge}>3</span>
          </h3>
          <div className={styles.endpointsList}>
            {ENDPOINTS.map((ep) => (
              <div key={ep.name} className={styles.endpointRow}>
                <div>
                  <div className={styles.endpointName}>{ep.name}</div>
                  <div className={styles.endpointPrice}>{ep.price}</div>
                </div>
                <div className={styles.endpointEarned}>{ep.earned}</div>
              </div>
            ))}
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
              {CALL_HISTORY.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.ts}</td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.typeBadge}`}>
                      {row.type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-accent)' }}>{row.status}</td>
                  <td className="text-mono">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sector Yield Breakdown Progress Stack */}
        <div className={styles.breakdownCard}>
          <div className={styles.breakdownTop}>
            <h3 className={styles.sectionTitle}>Earnings by Sector</h3>
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

          {BREAKDOWN.map((item) => (
            <div key={item.label} className={styles.breakdownRow}>
              <div className={styles.breakdownLabelRow}>
                <span>{item.label}</span>
                <span>{item.val}</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}

          <div className={styles.breakdownTotal}>
            <span>Total Spend</span>
            <span className={styles.totalVal}>$1,256.50</span>
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
