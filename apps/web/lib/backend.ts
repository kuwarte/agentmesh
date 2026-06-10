/**
 * lib/backend.ts
 *
 * Thin client for the Agent Mesh backend API.
 * Base URL is read from NEXT_PUBLIC_BACKEND_URL (falls back to localhost:3001).
 */

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

// ─── Types matching /registry/apis response ───────────────────────────────

export type BackendApi = {
  apiId: string
  provider: string
  name: string
  endpoint: string
  callUrl: string
  pricePerCall: string
  priceUsd: string
  active: boolean
  // metadata (null if not submitted to Supabase yet)
  slug: string | null
  category: string | null
  tags: string[]
  description: string | null
}

export type RegistryResponse = {
  success: boolean
  count: number
  metadataEnabled: boolean
  apis: BackendApi[]
}

// ─── Fetch helpers ────────────────────────────────────────────────────────

export async function fetchApis(params?: {
  category?: string
  active?: boolean
}): Promise<RegistryResponse> {
  const url = new URL(`${BASE}/registry/apis`)

  if (params?.category) url.searchParams.set('category', params.category)
  if (params?.active !== undefined)
    url.searchParams.set('active', String(params.active))

  const res = await fetch(url.toString(), { next: { revalidate: 30 } })

  if (!res.ok) throw new Error(`Failed to fetch APIs: ${res.status}`)

  return res.json()
}

export async function fetchApiById(apiId: string) {
  const res = await fetch(`${BASE}/registry/api/${apiId}`, {
    next: { revalidate: 30 },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to fetch API: ${res.status}`)
  return res.json()
}

export async function fetchApiBySlug(slug: string) {
  const res = await fetch(`${BASE}/registry/slug/${slug}`, {
    next: { revalidate: 30 },
  })

  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to fetch API: ${res.status}`)

  return res.json()
}

export async function fetchCategories(): Promise<string[]> {
  const res = await fetch(`${BASE}/registry/categories`, {
    next: { revalidate: 60 },
  })

  if (!res.ok) return []

  const data = await res.json()
  return data.categories ?? []
}

// ─── Provider endpoints ───────────────────────────────────────────────────

export type ProviderOverview = {
  success: boolean
  address: string
  provider: {
    usdcBalance: string
    totalEarningsUsd: string
    totalCalls: number
    activeApis: number
    totalApis: number
  }
  apis: {
    apiId: string
    name: string
    endpoint: string
    pricePerCall: string
    priceUsd: string
    active: boolean
    provider: string
  }[]
  recentCalls: LedgerEntry[]
}

export type ProviderEarnings = {
  success: boolean
  address: string
  totalEarningsUsd: string
  totalCalls: number
  breakdown: {
    apiName: string
    calls: number
    earningsUsd: string
  }[]
}

export type LedgerEntry = {
  apiId: string
  apiName: string
  payer: string
  provider: string
  amount: string        // raw micro-USDC
  amountUsd: string     // human-readable USD
  fee: string
  txHash: string
  blockNumber: number
  timestamp: number     // milliseconds since epoch
  explorerUrl?: string
}

export async function fetchProviderOverview(address: string): Promise<ProviderOverview> {
  const res = await fetch(`${BASE}/provider/${address}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Provider fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchProviderEarnings(address: string): Promise<ProviderEarnings> {
  const res = await fetch(`${BASE}/provider/${address}/earnings`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Earnings fetch failed: ${res.status}`)
  return res.json()
}

// ─── Registration endpoints ───────────────────────────────────────────────────

export type RegisterApiResult = {
  success: boolean
  apiId: string
  txHash: string
  explorerUrl: string
}

export type MetadataParam = {
  name: string
  type: string
  required: string
  description: string
}

export type SubmitMetadataPayload = {
  apiId: string
  providerAddress: string
  slug?: string
  category?: string
  tags?: string[]
  description?: string
  longDesc?: string
  params?: MetadataParam[]
  codeExample?: string
  responseSchema?: string
}

const INTERNAL_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

/**
 * Register a new API on-chain via the backend gateway.
 * priceUsd is a human-readable USD value e.g. "0.0010" — converted to micro-USDC internally.
 */
export async function registerApi(payload: {
  name: string
  endpoint: string
  priceUsd: string
  providerAddress: string
}): Promise<RegisterApiResult> {
  const pricePerCall = Math.round(parseFloat(payload.priceUsd) * 1_000_000)

  const body = JSON.stringify({
    name: payload.name.trim(),
    endpoint: payload.endpoint.trim(),
    pricePerCall,
    providerAddress: payload.providerAddress,
  })

  const res = await fetch(`${BASE}/registry/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': INTERNAL_KEY,
    },
    body,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Registration failed: ${res.status}`)
  return data as RegisterApiResult
}

/**
 * Submit off-chain metadata for a registered API (slug, category, tags, descriptions).
 * Note: for APIs registered via the gateway (POST /registry/register), the on-chain
 * provider is the gateway wallet — omit X-Provider-Address so the backend allows the write.
 */
export async function submitMetadata(payload: SubmitMetadataPayload): Promise<{ success: boolean }> {
  const { apiId, providerAddress, ...meta } = payload

  // Only send X-Provider-Address if caller is the actual on-chain provider.
  // For gateway-registered APIs the on-chain provider is the gateway wallet,
  // so we omit the header and rely on the open-write MVP behaviour.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (providerAddress) {
    headers['x-provider-address'] = providerAddress
  }

  const res = await fetch(`${BASE}/registry/metadata/${apiId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(meta),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Metadata submit failed: ${res.status}`)
  return data
}
