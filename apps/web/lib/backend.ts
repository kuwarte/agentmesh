/**
 * lib/backend.ts
 *
 * Typed fetch helpers for the AgentMesh backend API.
 * All functions throw on non-2xx responses.
 */

// Next.js inlines NEXT_PUBLIC_* at build time — declare it for TypeScript.
declare const NEXT_PUBLIC_BACKEND_URL: string | undefined;

const BASE: string = (() => {
  try {
    // eslint-disable-next-line no-undef
    return NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  } catch {
    return "http://localhost:3001";
  }
})();

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiListItem {
  apiId:        string;
  provider:     string;
  name:         string;
  endpoint:     string;
  pricePerCall: string;
  priceUsd:     string;
  active:       boolean;
  slug:         string | null;
  category:     string | null;
  tags:         string[];
  description:  string | null;
}

export interface ApiParam {
  name:        string;
  type:        string;
  required:    string;
  description: string;
}

export interface ApiDetail extends ApiListItem {
  longDesc:       string | null;
  params:         ApiParam[];
  codeExample:    string | null;
  responseSchema: string | null;
}

export interface ProviderOverview {
  usdcBalance:      string;
  totalEarningsUsd: string;
  totalCalls:       number;
  activeApis:       number;
  totalApis:        number;
}

export interface ProviderApi {
  apiId:        string;
  name:         string;
  pricePerCall: string;
  active:       boolean;
}

export interface LedgerEntry {
  txHash:      string;
  apiId:       string;
  apiName:     string;
  payer:       string;
  provider:    string;
  amount:      string;
  amountUsd:   string;
  fee:         string;
  nonce:       string;
  timestamp:   number;
  explorerUrl: string;
}

export interface EarningsBreakdown {
  apiName:     string;
  calls:       number;
  earningsUsd: string;
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export async function fetchApis(category?: string): Promise<ApiListItem[]> {
  const qs = category && category !== "All" ? `?category=${encodeURIComponent(category)}` : "";
  const data = await get<{ apis: ApiListItem[] }>(`/registry/apis${qs}`);
  return data.apis;
}

export async function fetchCategories(): Promise<string[]> {
  const data = await get<{ categories: string[] }>("/registry/categories");
  return ["All", ...data.categories];
}

export async function fetchApiBySlug(slug: string): Promise<ApiDetail | null> {
  try {
    const data = await get<{ api: ApiDetail }>(`/registry/slug/${slug}`);
    return data.api;
  } catch {
    return null;
  }
}

export async function fetchApiById(apiId: string): Promise<ApiDetail | null> {
  try {
    const data = await get<{ api: ApiDetail }>(`/registry/api/${apiId}`);
    return data.api;
  } catch {
    return null;
  }
}

// ─── Provider portal ──────────────────────────────────────────────────────────

export async function fetchProviderOverview(address: string): Promise<{
  provider: ProviderOverview;
  apis:     ProviderApi[];
  recentCalls: LedgerEntry[];
}> {
  return get(`/provider/${address}`);
}

export async function fetchProviderEarnings(address: string): Promise<{
  totalEarningsUsd: string;
  totalCalls:       number;
  breakdown:        EarningsBreakdown[];
}> {
  return get(`/provider/${address}/earnings`);
}

export async function fetchProviderCalls(address: string, page = 1): Promise<{
  calls:      LedgerEntry[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  return get(`/provider/${address}/calls?page=${page}&limit=20`);
}

export async function fetchBalance(address: string): Promise<string> {
  const data = await get<{ usdcBalance: string }>(`/payment/balance/${address}`);
  return data.usdcBalance;
}
