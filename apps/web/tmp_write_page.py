content = '''"use client";

import AppSidebar from "@/components/layout/AppSidebar";
import { fetchApiBySlug } from "@/lib/backend";
import { morph } from "@/lib/chains";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useConnections, useSignMessage } from "wagmi";
import { encodePacked, keccak256 } from "viem";
import styles from "./apiDetail.module.css";

type Tab = "docs" | "playground" | "recent";
type PlaygroundParams = Record<string, string>;

type CallRecord = {
  id: string;
  apiName: string;
  endpoint: string;
  status: number;
  amount: string;
  createdAt: string;
  latencyMs: number;
  response: unknown;
};

type LiveApi = {
  apiId: string;
  provider: string;
  name: string;
  endpoint: string;
  pricePerCall: string;
  priceUsd: string;
  active: boolean;
  slug: string | null;
  category: string | null;
  tags: string[];
  description: string | null;
  longDesc: string | null;
  params: { name: string; type: string; required: string; description: string }[];
  codeExample: string | null;
  responseSchema: string | null;
};

type PaymentChallenge = {
  currency: string;
  amount: string;
  amountUsd: string;
  provider: string;
  decimals: number;
  facilitator: string;
  network: string;
  chainId: number;
};

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

async function fetchPaymentChallenge(apiId: string): Promise<PaymentChallenge> {
  const res = await fetch(`${BASE}/api/v1/call/${apiId}`, { cache: "no-store" });
  if (res.status !== 402) throw new Error(`Expected 402, got ${res.status}`);
  const body = await res.json();
  return body.payment as PaymentChallenge;
}

async function fetchNonce(): Promise<{ nonce: string; deadline: number }> {
  const res = await fetch(`${BASE}/payment/nonce`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch nonce");
  return res.json();
}

async function callWithPayment(
  apiId: string,
  xPayment: string
): Promise<{ status: number; body: unknown; latencyMs: number }> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/v1/call/${apiId}`, {
    headers: { "X-Payment": xPayment },
    cache: "no-store",
  });
  const latencyMs = Date.now() - t0;
  const body = await res.json().catch(() => null);
  return { status: res.status, body, latencyMs };
}

export default function ApiDetailPage() {
  const params = useParams();
  const slug = params?.apiId as string;

  const [api, setApi] = useState<LiveApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchApiBySlug(slug)
      .then((data) => {
        if (!data) { setNotFound(true); return; }
        setApi(data.api ?? data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const [tab, setTab] = useState<Tab>("docs");
  const [copied, setCopied] = useState(false);
  const [playgroundParams, setPlaygroundParams] = useState<PlaygroundParams>({});
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<unknown>(null);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);

  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const connections = useConnections();
  const { signMessageAsync } = useSignMessage();

  const connector = connectors.find((c) => c.type === "injected") ?? connectors[0];
  const connectedAddress = address ?? connections[0]?.accounts[0] ?? undefined;
  const hasWalletConnection = isConnected || connections.length > 0;
  const visibleConnectError = connectError?.message.includes("already connected") ? null : connectError;

  const callUrl = api ? `${BASE}/api/v1/call/${api.apiId}` : "";

  const requestUrl = useMemo(() => {
    if (!api) return "";
    const url = new URL(callUrl);
    (api.params ?? []).forEach((param) => {
      const value = playgroundParams[param.name];
      if (value) url.searchParams.set(param.name, value);
    });
    return url.toString();
  }, [api, callUrl, playgroundParams]);

  useEffect(() => {
    if (!api) return;
    setPlaygroundParams({});
    setCallResult(null);
    setCallStartedAt(null);
    setRecentCalls([]);
    setRunError(null);
  }, [api]);

  const copy = async () => {
    await navigator.clipboard.writeText(callUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = () => {
    if (hasWalletConnection) { setTab("playground"); return; }
    if (!connector) return;
    connect({ connector, chainId: morph.id });
  };

  const updatePlaygroundParam = (name: string, value: string) => {
    setPlaygroundParams((cur) => ({ ...cur, [name]: value }));
  };

  const runLiveRequest = async () => {
    if (!api || !connectedAddress) return;
    setIsRunning(true);
    setRunError(null);
    setCallResult(null);
    const startedAt = new Date();

    try {
      const challenge = await fetchPaymentChallenge(api.apiId);
      const { nonce, deadline } = await fetchNonce();

      const msgHash = keccak256(
        encodePacked(
          ["address", "address", "address", "uint256", "bytes32", "uint256"],
          [
            challenge.facilitator as `0x${string}`,
            connectedAddress as `0x${string}`,
            challenge.provider as `0x${string}`,
            BigInt(challenge.amount),
            nonce as `0x${string}`,
            BigInt(deadline),
          ]
        )
      );

      const signature = await signMessageAsync({ message: { raw: msgHash } });

      const xPayment = btoa(
        JSON.stringify({
          payer: connectedAddress,
          provider: challenge.provider,
          amount: challenge.amount,
          nonce,
          deadline,
          signature,
        })
      );

      const { status, body, latencyMs } = await callWithPayment(api.apiId, xPayment);

      const response = {
        status,
        payment: {
          standard: "x402",
          chain: "Morph L2",
          payer: connectedAddress,
          amount: `${challenge.amountUsd} USDC`,
        },
        data: body,
      };

      setCallResult(response);
      setCallStartedAt(startedAt.toLocaleTimeString());
      setRecentCalls((prev) => [
        {
          id: `${api.apiId}-${startedAt.getTime()}`,
          apiName: api.name,
          endpoint: requestUrl,
          status,
          amount: `${challenge.amountUsd} USDC`,
          createdAt: startedAt.toLocaleTimeString(),
          latencyMs,
          response,
        },
        ...prev,
      ]);
      setTab("recent");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunError(
        msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("denied")
          ? "Signature rejected. Approve the signing request in your wallet to continue."
          : msg
      );
    } finally {
      setIsRunning(false);
    }
  };

  const showCallResponse = (call: CallRecord) => {
    setCallResult(call.response);
    setCallStartedAt(call.createdAt);
    setTab("playground");
  };

  const displayPrice =
    api?.priceUsd && api.priceUsd !== ""
      ? api.priceUsd
      : api?.pricePerCall
      ? (parseInt(api.pricePerCall) / 1_000_000).toFixed(6)
      : "0.000000";

  if (loading) {
    return (
      <div className={styles.shell}>
        <AppSidebar />
        <div className={styles.body} style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
          Loading\u2026
        </div>
      </div>
    );
  }

  if (notFound || !api) {
    return (
      <div className={styles.shell}>
        <AppSidebar />
        <div className={styles.body}>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>404</span>
            <p className={styles.emptyTitle}>API not found</p>
            <p className={styles.emptySubtitle}>This API does not exist or has been removed.</p>
            <Link href="/marketplace" className={styles.connectBtn}>Back to Marketplace</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <AppSidebar />
      <div className={styles.body}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/marketplace" className={styles.breadcrumbLink}>Marketplace</Link>
          <span className={styles.breadcrumbSep} aria-hidden="true">/</span>
          <span className={styles.breadcrumbLink} style={{ opacity: 0.5 }}>{api.category}</span>
          <span className={styles.breadcrumbSep} aria-hidden="true">/</span>
          <span className={styles.breadcrumbCurrent}>{api.name}</span>
        </nav>

        <div className={styles.layout}>
          <main className={styles.main}>
            <div className={styles.tags}>
              {(api.tags ?? []).map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>

            <h1 className={styles.title}>{api.name}</h1>
            <p className={styles.desc}>{api.longDesc ?? api.description}</p>

            <div className={styles.statsBar}>
              <span className={styles.stat}>settlement: <strong>Morph L2</strong></span>
              {!api.active && (
                <span className={styles.stat} style={{ color: "#f87171" }}>
                  status: <strong style={{ color: "#f87171" }}>inactive</strong>
                </span>
              )}
            </div>

            <div className={styles.divider} />

            <div className={styles.tabs} role="tablist">
              {(["docs", "playground", "recent"] as Tab[]).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t === "docs" && <span className={styles.tabIcon}>[]</span>}
                  {t === "playground" && <span className={styles.tabIcon}>&gt;</span>}
                  {t === "docs" ? "Docs" : t === "playground" ? "Playground" : "Recent Calls"}
                </button>
              ))}
            </div>

            {tab === "docs" && (
              <div className={styles.docsContent}>
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Endpoint</h2>
                  <div className={styles.endpointBox}>
                    <div className={styles.endpointRow}>
                      <span className={styles.methodBadge}>GET</span>
                      <code className={styles.endpointUrl}>{callUrl}</code>
                      <button className={styles.copyBtn} onClick={copy}>{copied ? "COPIED" : "COPY"}</button>
                    </div>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
                        </thead>
                        <tbody>
                          {(api.params ?? []).map((p) => (
                            <tr key={p.name}>
                              <td><code className={styles.paramName}>{p.name}</code></td>
                              <td><span className={styles.typeTag}>{p.type}</span></td>
                              <td className={styles.requiredCell}>{p.required}</td>
                              <td className={styles.descCell}>{p.description}</td>
                            </tr>
                          ))}
                          {(api.params ?? []).length === 0 && (
                            <tr><td colSpan={4} className={styles.descCell} style={{ opacity: 0.5 }}>No parameters</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Protocol</h2>
                  <div className={styles.endpointBox}>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr><th>Property</th><th>Value</th><th>Description</th></tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><code className={styles.paramName}>Payment Standard</code></td>
                            <td><span className={styles.typeTag}>x402</span></td>
                            <td className={styles.descCell}>Machine-native payment protocol</td>
                          </tr>
                          <tr>
                            <td><code className={styles.paramName}>Token</code></td>
                            <td><span className={styles.typeTag}>USDC</span></td>
                            <td className={styles.descCell}>Settlement currency for API calls</td>
                          </tr>
                          <tr>
                            <td><code className={styles.paramName}>Settlement Chain</code></td>
                            <td><span className={styles.typeTag}>Morph L2</span></td>
                            <td className={styles.descCell}>Network used for fast settlement</td>
                          </tr>
                          <tr>
                            <td><code className={styles.paramName}>Speed</code></td>
                            <td><span className={styles.typeTag}>&lt;1s</span></td>
                            <td className={styles.descCell}>Average settlement finality</td>
                          </tr>
                          <tr>
                            <td><code className={styles.paramName}>Provider Address</code></td>
                            <td colSpan={2} className={styles.protocolAddress}>{api.provider}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {api.codeExample && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Example - Agent Integration</h2>
                    <pre className={styles.codeBlock}><code>{api.codeExample}</code></pre>
                  </section>
                )}

                {api.responseSchema && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Response Schema</h2>
                    <pre className={styles.codeBlock}><code>{api.responseSchema}</code></pre>
                  </section>
                )}
              </div>
            )}

            {tab === "playground" && (
              hasWalletConnection ? (
                <div className={styles.playgroundPanel}>
                  <div className={styles.playgroundHeader}>
                    <div>
                      <h2 className={styles.sectionTitle}>Live API Playground</h2>
                      <p className={styles.playgroundIntro}>
                        {api.active
                          ? "Makes a real x402 payment. Your wallet will prompt you to sign \u2014 no token approval needed."
                          : "This API is currently inactive and cannot be called."}
                      </p>
                    </div>
                    <div className={styles.walletPill}>
                      <span className={styles.walletDot} />
                      {connectedAddress
                        ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`
                        : "Connected"}
                    </div>
                  </div>

                  <div className={styles.playgroundGrid}>
                    <section className={styles.playgroundCard}>
                      <h3 className={styles.playgroundCardTitle}>Parameters</h3>
                      <div className={styles.paramForm}>
                        {(api.params ?? []).map((param) => (
                          <label key={param.name} className={styles.paramField}>
                            <span className={styles.paramLabelRow}>
                              <span>{param.name}</span>
                              <span className={styles.paramMeta}>
                                {param.type} \u2013 {param.required === "Yes" ? "required" : "optional"}
                              </span>
                            </span>
                            {param.type === "boolean" ? (
                              <select
                                className={styles.playgroundInput}
                                value={playgroundParams[param.name] ?? ""}
                                onChange={(e) => updatePlaygroundParam(param.name, e.target.value)}
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <input
                                className={styles.playgroundInput}
                                value={playgroundParams[param.name] ?? ""}
                                onChange={(e) => updatePlaygroundParam(param.name, e.target.value)}
                                placeholder={param.description}
                              />
                            )}
                          </label>
                        ))}
                        {(api.params ?? []).length === 0 && (
                          <p style={{ opacity: 0.5, fontSize: "0.85em" }}>No parameters required.</p>
                        )}
                      </div>

                      <div className={styles.mockPayment}>
                        <span>x402 payment</span>
                        <strong>{displayPrice} USDC</strong>
                      </div>

                      {runError && (
                        <p style={{ color: "#f87171", fontSize: "0.8rem", marginTop: "10px", lineHeight: 1.5 }}>
                          {runError}
                        </p>
                      )}

                      <button
                        className={styles.runBtn}
                        onClick={runLiveRequest}
                        disabled={isRunning || !api.active}
                        title={!api.active ? "This API is inactive" : undefined}
                      >
                        {isRunning ? "Waiting for signature\u2026" : api.active ? "Run API Call" : "API Inactive"}
                      </button>
                    </section>

                    <section className={styles.playgroundCard}>
                      <h3 className={styles.playgroundCardTitle}>Request</h3>
                      <pre className={styles.playgroundCode}>
                        <code>{`GET ${requestUrl}\\nX-Payment: <signed x402 payload>\\n// wallet signs: keccak256(facilitator, payer, provider, amount, nonce, deadline)`}</code>
                      </pre>

                      <h3 className={styles.playgroundCardTitle}>Response</h3>
                      <pre className={styles.playgroundCode}>
                        <code>
                          {callResult
                            ? JSON.stringify(callResult, null, 2)
                            : isRunning
                            ? "// Signing and calling\u2026"
                            : "// Response will appear here after a live call."}
                        </code>
                      </pre>

                      {callStartedAt && (
                        <p className={styles.mockStatus}>
                          Call at {callStartedAt} \u2014 settled on Morph L2
                        </p>
                      )}
                    </section>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>&gt;</span>
                  <p className={styles.emptyTitle}>Connect wallet to use Playground</p>
                  <p className={styles.emptySubtitle}>
                    Connect your wallet to make a live x402 payment and call this API directly from your browser.
                  </p>
                  <button
                    className={styles.connectBtn}
                    onClick={handleConnect}
                    disabled={isPending || !connector}
                  >
                    {isPending ? "Connecting..." : "Connect Wallet"}
                  </button>
                  {visibleConnectError && (
                    <p className={styles.connectError}>{visibleConnectError.message}</p>
                  )}
                </div>
              )
            )}

            {tab === "recent" && (
              recentCalls.length > 0 ? (
                <div className={styles.recentPanel}>
                  <div className={styles.recentHeader}>
                    <h2 className={styles.sectionTitle}>Recent Calls</h2>
                    <span className={styles.recentCount}>{recentCalls.length} this session</span>
                  </div>
                  <div className={styles.recentList}>
                    {recentCalls.map((call) => (
                      <article key={call.id} className={styles.recentCall}>
                        <div className={styles.recentCallMain}>
                          <span className={styles.statusPill}>HTTP {call.status}</span>
                          <div>
                            <h3>{call.apiName}</h3>
                            <p>{call.endpoint}</p>
                          </div>
                        </div>
                        <div className={styles.recentCallMeta}>
                          <span>{call.amount}</span>
                          <span>{call.latencyMs}ms</span>
                          <span>{call.createdAt}</span>
                        </div>
                        <button className={styles.viewResponseBtn} onClick={() => showCallResponse(call)}>
                          View Response
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>()</span>
                  <p className={styles.emptyTitle}>No recent calls</p>
                  <p className={styles.emptySubtitle}>Run an API call and it will appear here automatically.</p>
                </div>
              )
            )}
          </main>

          <aside className={styles.priceCardWrap}>
            <div className={styles.priceCard}>
              <div className={styles.priceRow}>
                <div className={styles.priceDisplay}>
                  <span className={styles.priceValue}>{displayPrice}</span>
                  <span className={styles.priceUnit}>USDC/CALL</span>
                </div>
              </div>
              <ul className={styles.featureList}>
                {[
                  "No account or API key required",
                  "Wallet balance funds calls directly",
                  "Sub-1s settlement on Morph L2",
                  "99% revenue to provider",
                ].map((f) => (
                  <li key={f} className={styles.featureItem}>
                    <span className={styles.featureCheck} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <button className={styles.playgroundBtn} onClick={() => setTab("playground")}>
                TRY IN PLAYGROUND
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
'''

dest = '/home/kuwarte/x402agentic-payment/agentmesh/apps/web/app/marketplace/[apiId]/page.tsx'
with open(dest, 'w') as f:
    f.write(content)
print("done")
