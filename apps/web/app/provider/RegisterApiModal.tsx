'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useAccount, useWaitForTransactionReceipt, useWriteContract, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { submitMetadata } from '@/lib/backend'
import { morph } from '@/lib/chains'
import styles from './Provider.module.css'

// Contract details
const REGISTRY_ADDRESS = '0x007c677F96A5E934D84502Ccd81FD161023b2cfA' as const
const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerAPI',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'pricePerCall', type: 'uint256' },
    ],
    outputs: [{ name: 'apiId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
] as const

type RegisterApiModalProps = {
  open: boolean
  onClose: () => void
  onRegistered?: (apiId: string) => void
}

const CATEGORIES = [
  'Price Feed',
  'Data Feed',
  'Security',
  'Geolocation',
  'Weather',
  'AI / Compute',
  'Fun & Entertainment',
  'Other',
]

type Step = 'form' | 'confirm' | 'mining' | 'metadata' | 'success' | 'error'

export default function RegisterApiModal({ open, onClose, onRegistered }: RegisterApiModalProps) {
  const { address } = useAccount()
  const [step, setStep] = useState<Step>('form')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  // Form field cache for the metadata step
  const [formData, setFormData] = useState<{
    name: string
    category: string
    endpoint: string
    priceUsd: string
    tags: string
    description: string
  } | null>(null)

  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()

  const { data: receipt, isLoading: isMining, isSuccess: mined } =
    useWaitForTransactionReceipt({ hash: txHash ?? undefined })

  // Once the tx mines, extract apiId from logs and submit metadata
  useEffect(() => {
    if (!mined || !receipt || !formData || !address) return

    const doMetadata = async () => {
      setStep('metadata')

      // The APIRegistered event: keccak256("APIRegistered(bytes32,address,string,string,uint256)")
      // apiId is the first topic after the event sig (indexed)
      const API_REGISTERED_SIG = '0xbe17b1b290dad4db8807b2a4fb94e0288b2749e13c8716dd0f7d41edb4ab332e'
      const log = receipt.logs.find(
        (l) => l.topics[0]?.toLowerCase() === API_REGISTERED_SIG.toLowerCase()
      )
      const apiId = log?.topics[1] ?? null

      if (apiId) {
        const tags = formData.tags
          ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : []
        const slug = formData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        try {
          await submitMetadata({
            apiId,
            providerAddress: address,
            slug,
            category: formData.category,
            tags,
            description: formData.description,
          })
        } catch {
          // Non-fatal — API is on-chain already
        }

        onRegistered?.(apiId)
      }

      setStep('success')
    }

    doMetadata()
  }, [mined, receipt, formData, address, onRegistered])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step === 'form') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose, step])

  useEffect(() => {
    if (open) {
      setStep('form')
      setErrorMsg(null)
      setTxHash(null)
      setFormData(null)
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!address) {
      setErrorMsg('Wallet not connected.')
      setStep('error')
      return
    }

    const form = e.currentTarget
    const data = new FormData(form)
    const name = (data.get('name') as string).trim()
    const category = data.get('category') as string
    const endpoint = (data.get('endpoint') as string).trim()
    const priceUsd = (data.get('price') as string).trim()
    const tags = (data.get('tags') as string).trim()
    const description = (data.get('description') as string).trim()

    const priceNum = parseFloat(priceUsd)
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMsg('Price must be a positive number (e.g. 0.0010).')
      setStep('error')
      return
    }

    // pricePerCall in micro-USDC (6 decimals)
    const pricePerCall = parseUnits(priceUsd, 6)

    setFormData({ name, category, endpoint, priceUsd, tags, description })
    setStep('confirm')

    try {
      // Ensure we're on Morph L2 before submitting
      await switchChainAsync({ chainId: morph.id })

      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'registerAPI',
        args: [name, endpoint, pricePerCall],
      })
      setTxHash(hash)
      setStep('mining')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(
        msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('denied')
          ? 'Transaction rejected in wallet.'
          : msg
      )
      setStep('error')
    }
  }

  const isBlocked = step === 'confirm' || step === 'mining' || step === 'metadata'

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={!isBlocked ? onClose : undefined}
    >
      <div
        className={`${styles.modal} ${styles.registerModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-api-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.modalTop}>
          <div>
            <span className={styles.modalKicker}>Provider Registry</span>
            <h2 id="register-api-title" className={styles.modalTitle}>
              Register an API
            </h2>
          </div>
          {!isBlocked && (
            <button
              type="button"
              className={styles.modalCloseBtn}
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>

        {/* ── SUCCESS ── */}
        {step === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            <p className={styles.modalSuccess}>
              API registered on-chain. Your wallet is the on-chain owner — it will appear in your provider dashboard once indexed.
            </p>
            {txHash && (
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                TX:{' '}
                <a
                  href={`https://explorer-hoodi.morphl2.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
                >
                  {txHash.slice(0, 10)}…{txHash.slice(-6)}
                </a>
              </span>
            )}
            <div className={styles.modalActions}>
              <button className={styles.modalConnectBtn} onClick={onClose}>Done</button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            <p style={{ color: '#f87171', fontSize: '0.84rem', lineHeight: 1.6 }}>{errorMsg}</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
              <button className={styles.modalConnectBtn} onClick={() => setStep('form')}>Try Again</button>
            </div>
          </div>
        )}

        {/* ── MINING / METADATA STATUS ── */}
        {(step === 'confirm' || step === 'mining' || step === 'metadata') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0', color: 'var(--color-text-muted)', fontSize: '0.84rem' }}>
            <p style={{ color: step === 'confirm' ? 'var(--color-text-primary)' : 'var(--color-accent)' }}>
              {step === 'confirm' && 'Switching to Morph L2 and waiting for wallet confirmation…'}
              {step === 'mining' && 'Transaction submitted — waiting for confirmation on Morph L2…'}
              {step === 'metadata' && 'Transaction confirmed. Saving metadata…'}
            </p>
            {txHash && (
              <span style={{ fontSize: '0.75rem' }}>
                TX:{' '}
                <a
                  href={`https://explorer-hoodi.morphl2.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
                >
                  {txHash.slice(0, 10)}…{txHash.slice(-6)}
                </a>
              </span>
            )}
          </div>
        )}

        {/* ── FORM ── */}
        {step === 'form' && (
          <>
            <p className={styles.modalDesc}>
              Registers directly on-chain via your wallet — you become the on-chain owner and payment receiver.
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
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
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
                  Price Per Call (USD)
                  <input
                    name="price"
                    inputMode="decimal"
                    placeholder="0.0010"
                    required
                  />
                </label>

                <label className={styles.formField}>
                  Tags
                  <input name="tags" placeholder="crypto, realtime, oracle" />
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
                <span>settlement</span>
                <strong>Morph L2</strong>
                <span>provider revenue</span>
                <strong>99%</strong>
              </div>

              {!address && (
                <p style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '8px' }}>
                  Connect your wallet — your address becomes the on-chain owner and payment receiver.
                </p>
              )}

              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.modalConnectBtn}
                  disabled={!address}
                >
                  Register API
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
