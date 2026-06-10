'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount, useConnect, useWriteContract } from 'wagmi'
import ProviderSidebar from '@/components/layout/ProviderSidebar'
import RegisterApiModal from '../RegisterApiModal'
import styles from '../Provider.module.css'
import { morph } from '@/lib/chains'
import {
  fetchProviderOverview,
  fetchProviderEarnings,
  fetchApiById,
  type ProviderOverview,
  type ProviderEarnings,
} from '@/lib/backend'

const REGISTRY_ADDRESS = '0x007c677F96A5E934D84502Ccd81FD161023b2cfA' as const
const UPDATE_ABI = [
  {
    type: 'function',
    name: 'updateAPI',
    inputs: [
      { name: 'apiId', type: 'bytes32' },
      { name: 'newPrice', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

// ─── Connect prompt ───────────────────────────────────────────────────────────
function ConnectPrompt() {
  const { connect, connectors, isPending } = useConnect()
  const connector =
    connectors.find((c) => c.type === 'injected') ?? connectors[0]

  return (
    <main className={styles.content}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My APIs</h1>
          <p className={styles.pageSubtitle}>
            Connect your wallet to manage your registered endpoints.
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

// ─── API List ─────────────────────────────────────────────────────────────────
function ApiList() {
  const { address } = useAccount()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [overview, setOverview] = useState<ProviderOverview | null>(null)
  const [earnings, setEarnings] = useState<ProviderEarnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  // Extra APIs registered this session (gateway-owned, appended immediately after registration)
  const [sessionApis, setSessionApis] = useState<ProviderOverview['apis']>([])

  const { writeContractAsync } = useWriteContract()

  const toggleActive = useCallback(async (apiId: string, currentActive: boolean, pricePerCall: string) => {
    setTogglingId(apiId)
    try {
      await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: UPDATE_ABI,
        functionName: 'updateAPI',
        args: [apiId as `0x${string}`, BigInt(pricePerCall), !currentActive],
        chainId: morph.id,
      })
      // Optimistically update the UI
      setOverview((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          apis: prev.apis.map((a) =>
            a.apiId === apiId ? { ...a, active: !currentActive } : a
          ),
        }
      })
      setSessionApis((prev) =>
        prev.map((a) => (a.apiId === apiId ? { ...a, active: !currentActive } : a))
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.toLowerCase().includes('user rejected') && !msg.toLowerCase().includes('denied')) {
        setError(msg)
      }
    } finally {
      setTogglingId(null)
    }
  }, [writeContractAsync])

  useEffect(() => {
    if (!address) return

    let cancelled = false

    const load = (initial: boolean) => {
      if (initial) { setLoading(true); setError(null) }
      Promise.all([
        fetchProviderOverview(address),
        fetchProviderEarnings(address),
      ])
        .then(([ov, ea]) => {
          if (cancelled) return
          setOverview(ov)
          setEarnings(ea)
        })
        .catch((err: Error) => { if (!cancelled) setError(err.message) })
        .finally(() => { if (!cancelled && initial) setLoading(false) })
    }

    load(true)
    const interval = setInterval(() => load(false), 15_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [address])

  // Called by RegisterApiModal after a successful on-chain registration
  const handleRegistered = useCallback(async (apiId: string) => {
    try {
      const data = await fetchApiById(apiId)
      const api = data?.api ?? data
      if (api) {
        setSessionApis((prev) => {
          // Avoid duplicates
          if (prev.some((a) => a.apiId === apiId)) return prev
          return [api, ...prev]
        })
      }
    } catch {
      // Non-fatal — the success screen already shows the apiId
    }
  }, [])

  const provider = overview?.provider
  // Merge on-chain APIs with session-registered ones (deduplicated)
  const onChainApis = overview?.apis ?? []
  const onChainIds = new Set(onChainApis.map((a) => a.apiId))
  const apis = [...onChainApis, ...sessionApis.filter((a) => !onChainIds.has(a.apiId))]
  const breakdown = earnings?.breakdown ?? []

  // Average price across all APIs.
  // The provider overview omits priceUsd, so fall back to pricePerCall
  // (stored in micro-USDC, divide by 1_000_000).
  const avgPrice =
    apis.length > 0
      ? (() => {
          const sum = apis.reduce((acc, a) => {
            const usd =
              a.priceUsd != null && a.priceUsd !== ''
                ? parseFloat(a.priceUsd)
                : parseFloat(a.pricePerCall) / 1_000_000
            return acc + (isNaN(usd) ? 0 : usd)
          }, 0)
          return (sum / apis.length).toFixed(6)
        })()
      : '0.000000'

  // Total calls across all APIs (from earnings breakdown)
  const totalCalls = breakdown.reduce((sum, b) => sum + b.calls, 0)

  const earningsByName = new Map(
    breakdown.map((b) => [b.apiName, b])
  )

  return (
    <main className={styles.content}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My APIs</h1>
          <p className={styles.pageSubtitle}>
            Manage pricing, availability, and endpoint metadata for the APIs
            listed under your provider wallet.
          </p>
        </div>
        <button
          className={styles.registerBtn}
          onClick={() => setRegisterOpen(true)}
        >
          REGISTER AN API
        </button>
      </div>

      {/* Stats row */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Listed APIs</span>
          <div className={styles.statValue}>
            {loading ? '–' : provider?.totalApis ?? 0}
          </div>
          <span className={styles.badge}>
            {loading ? '' : `${provider?.activeApis ?? 0} active`}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Avg. Price</span>
          <div className={styles.statValue}>
            {loading ? '–' : avgPrice}
          </div>
          <span className={styles.statSubtext}>USDC per call</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Calls</span>
          <div className={styles.statValue}>
            {loading ? '–' : totalCalls.toLocaleString()}
          </div>
          <span className={styles.badge}>all time</span>
        </div>
      </div>

      {/* Endpoint registry */}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Endpoint Registry</h2>
          <span className={styles.badge}>Morph L2 settlement</span>
        </div>

        <div className={styles.apiList}>
          {loading && (
            <p style={{ opacity: 0.4, fontSize: '0.85rem', padding: '12px 0' }}>
              Loading…
            </p>
          )}

          {error && (
            <p style={{ color: '#f87171', fontSize: '0.85rem', padding: '12px 0' }}>
              {error}
            </p>
          )}

          {!loading && !error && apis.length === 0 && (
            <p style={{ opacity: 0.4, fontSize: '0.85rem', padding: '12px 0' }}>
              No APIs registered yet.
            </p>
          )}

          {apis.map((api) => {
            const stats = earningsByName.get(api.name)
            const revenue = stats
              ? `+$${parseFloat(stats.earningsUsd).toFixed(4)}`
              : '$0.00'
            const callCount = stats ? stats.calls.toLocaleString() : '–'

            return (
              <article key={api.apiId} className={styles.apiRow}>
                <div className={styles.apiMain}>
                  <span
                    className={`${styles.statusDot} ${
                      !api.active ? styles.statusDraft : ''
                    }`}
                  />
                  <div>
                    <h3>{api.name}</h3>
                    <code>{api.endpoint}</code>
                  </div>
                </div>

                <div className={styles.apiMetrics}>
                  <span>{api.active ? 'Active' : 'Inactive'}</span>
                  <span>
                    {api.priceUsd != null && api.priceUsd !== ''
                      ? api.priceUsd
                      : (parseFloat(api.pricePerCall) / 1_000_000).toFixed(6)}{' '}
                    USDC
                  </span>
                  <span>{callCount}</span>
                  <strong>{revenue}</strong>
                </div>

                <button
                  className={styles.secondaryBtn}
                  onClick={() => toggleActive(api.apiId, api.active, api.pricePerCall)}
                  disabled={togglingId === api.apiId}
                >
                  {togglingId === api.apiId
                    ? '…'
                    : api.active ? 'Deactivate' : 'Activate'}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      <RegisterApiModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegistered={handleRegistered}
      />
    </main>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProviderApisPage() {
  const { isConnected } = useAccount()

  return (
    <div className={styles.layout}>
      <ProviderSidebar />
      {isConnected ? <ApiList /> : <ConnectPrompt />}
    </div>
  )
}
