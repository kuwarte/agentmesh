'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAccount, useConnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import ProviderSidebar from '@/components/layout/ProviderSidebar'
import { morph } from '@/lib/chains'
import styles from '../Provider.module.css'

// ─── ABIs ──────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

// MaxUint256
const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
// Threshold: if allowance ≥ this, consider it "approved"
const MIN_ALLOWANCE = BigInt('1000000000000') // 1 million USDC in micro-units

// ─── Types ─────────────────────────────────────────────────────────────────
interface GatewayConfig {
  contracts: {
    facilitator: string
    usdc: string
  }
}

// ─── Connect prompt ────────────────────────────────────────────────────────
function ConnectPrompt() {
  const { connect, connectors, isPending } = useConnect()
  const connector = connectors.find((c) => c.type === 'injected') ?? connectors[0]

  return (
    <main className={styles.content}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.pageSubtitle}>Connect your wallet to manage settings.</p>
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

// ─── Approval panel ────────────────────────────────────────────────────────
function ApprovalPanel() {
  const { address } = useAccount()
  const [config, setConfig] = useState<GatewayConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

  // Fetch gateway config (facilitator + usdc addresses)
  useEffect(() => {
    fetch(`${backendUrl}/config`)
      .then((r) => r.json())
      .then((d) => setConfig(d))
      .catch(() => setConfigError('Could not load gateway config'))
  }, [backendUrl])

  const usdcAddress = config?.contracts?.usdc as `0x${string}` | undefined
  const facilitatorAddress = config?.contracts?.facilitator as `0x${string}` | undefined

  // Read current allowance
  const {
    data: allowance,
    isLoading: allowanceLoading,
    refetch: refetchAllowance,
  } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && facilitatorAddress ? [address, facilitatorAddress] : undefined,
    query: { enabled: !!address && !!usdcAddress && !!facilitatorAddress },
  })

  // Write: approve
  const { writeContract, data: approveTxHash, isPending: approveLoading, error: approveError, reset: resetWrite } = useWriteContract()

  // Wait for tx confirmation
  const { isLoading: confirmLoading, isSuccess: confirmSuccess } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  })

  // Refetch allowance after confirmation
  useEffect(() => {
    if (confirmSuccess) refetchAllowance()
  }, [confirmSuccess, refetchAllowance])

  const handleApprove = useCallback(() => {
    if (!usdcAddress || !facilitatorAddress) return
    resetWrite()
    writeContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [facilitatorAddress, MAX_UINT256],
      chainId: morph.id,
    })
  }, [usdcAddress, facilitatorAddress, writeContract, resetWrite])

  const isApproved = allowance !== undefined && (allowance as bigint) >= MIN_ALLOWANCE

  const allowanceDisplay = () => {
    if (allowanceLoading) return 'Checking…'
    if (allowance === undefined) return '—'
    const a = allowance as bigint
    if (a >= MAX_UINT256 / BigInt(2)) return 'Unlimited'
    return `${(Number(a) / 1_000_000).toFixed(2)} USDC`
  }

  const btnLabel = () => {
    if (approveLoading) return 'Confirm in wallet…'
    if (confirmLoading) return 'Waiting for confirmation…'
    if (confirmSuccess && isApproved) return 'Approved ✓'
    return 'APPROVE USDC SPENDING'
  }

  const isDisabled = approveLoading || confirmLoading || !usdcAddress || !facilitatorAddress

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>USDC Approval</h2>
        <span className={`${styles.badge}`} style={isApproved ? { color: '#22f078', borderColor: 'rgba(34,240,120,0.4)' } : { color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }}>
          {allowanceLoading ? 'CHECKING' : isApproved ? 'APPROVED' : 'NOT APPROVED'}
        </span>
      </div>

      <p style={{ color: '#93a39b', fontSize: '0.85rem', lineHeight: 1.65, marginBottom: 18 }}>
        Before calling any paid API from the marketplace, your wallet must approve the
        X402 Facilitator contract to transfer USDC on your behalf. Without this approval,
        settlement will fail and your calls won&apos;t be recorded.
      </p>

      <div className={styles.settingList}>
        <div className={styles.settingRow}>
          <div>
            <strong>Current allowance</strong>
            <span>USDC approved for the facilitator contract</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: isApproved ? '#22f078' : '#f87171', flexShrink: 0 }}>
            {allowanceDisplay()}
          </span>
        </div>

        <div className={styles.settingRow}>
          <div>
            <strong>Facilitator contract</strong>
            <span>X402 payment processor on Morph L2</span>
          </div>
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#6f8279', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
            {facilitatorAddress ? `${facilitatorAddress.slice(0, 10)}…${facilitatorAddress.slice(-6)}` : '—'}
          </code>
        </div>

        <div className={styles.settingRow}>
          <div>
            <strong>USDC contract</strong>
            <span>MockUSDC token on Morph Hoodi testnet</span>
          </div>
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#6f8279', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
            {usdcAddress ? `${usdcAddress.slice(0, 10)}…${usdcAddress.slice(-6)}` : '—'}
          </code>
        </div>
      </div>

      {configError && (
        <p style={{ color: '#f87171', fontSize: '0.82rem', margin: '12px 0' }}>{configError}</p>
      )}

      {approveError && (
        <p style={{ color: '#f87171', fontSize: '0.82rem', margin: '12px 0' }}>
          {(approveError as Error).message?.includes('User rejected') || (approveError as Error).message?.includes('denied')
            ? 'Transaction rejected in wallet.'
            : `Error: ${(approveError as Error).message}`}
        </p>
      )}

      {confirmSuccess && isApproved && (
        <p style={{ color: '#22f078', fontSize: '0.82rem', margin: '12px 0' }}>
          Approval confirmed. You can now call paid APIs from the marketplace.
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        {!isApproved || confirmSuccess ? (
          <button
            className={styles.registerBtn}
            onClick={handleApprove}
            disabled={isDisabled}
            style={isApproved && confirmSuccess ? { opacity: 0.6, cursor: 'default' } : {}}
          >
            {btnLabel()}
          </button>
        ) : (
          <button
            className={styles.secondaryBtn}
            onClick={handleApprove}
            disabled={isDisabled}
          >
            Re-approve (update allowance)
          </button>
        )}
      </div>
    </section>
  )
}

// ─── Settings content ──────────────────────────────────────────────────────
function SettingsContent() {
  return (
    <main className={styles.content}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.pageSubtitle}>
            Manage your wallet approvals and provider preferences.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* USDC Approval — the important one */}
        <ApprovalPanel />

        {/* Provider profile — cosmetic for now */}
        <div className={styles.settingsGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Provider Profile</h2>
              <span className={styles.badge}>coming soon</span>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                Display name
                <input defaultValue="" placeholder="Your provider name" disabled />
              </label>
              <label className={styles.formField}>
                Support email
                <input defaultValue="" placeholder="contact@example.com" disabled />
              </label>
              <label className={styles.formFieldWide}>
                Description
                <textarea defaultValue="" placeholder="Describe your API offerings…" disabled />
              </label>
            </div>
            <button className={styles.registerBtn} disabled style={{ opacity: 0.4, cursor: 'not-allowed' }}>
              SAVE PROFILE
            </button>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Notifications</h2>
              <span className={styles.badge}>coming soon</span>
            </div>
            <div className={styles.settingList}>
              <div className={styles.settingRow}>
                <div>
                  <strong>Daily payout summary</strong>
                  <span>Email report every 24 hours.</span>
                </div>
                <input type="checkbox" disabled />
              </div>
              <div className={styles.settingRow}>
                <div>
                  <strong>Low balance alert</strong>
                  <span>Notify when USDC balance falls below 10 USDC.</span>
                </div>
                <input type="checkbox" disabled />
              </div>
              <div className={styles.settingRow}>
                <div>
                  <strong>New caller alert</strong>
                  <span>Notify when a new wallet calls your API.</span>
                </div>
                <input type="checkbox" disabled />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function ProviderSettingsPage() {
  const { isConnected } = useAccount()

  return (
    <div className={styles.layout}>
      <ProviderSidebar />
      {isConnected ? <SettingsContent /> : <ConnectPrompt />}
    </div>
  )
}
