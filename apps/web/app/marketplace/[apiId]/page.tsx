"use client";

import AppSidebar from "@/components/layout/AppSidebar";
import { APIS, type ApiItem } from "@/lib/apis";
import { morph } from "@/lib/chains";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useConnections } from "wagmi";
import styles from "./apiDetail.module.css";

type Tab = "docs" | "playground" | "recent";
type PlaygroundParams = Record<string, string>;
type MockCall = {
  id: string;
  apiName: string;
  endpoint: string;
  status: number;
  amount: string;
  createdAt: string;
  latencyMs: number;
  response: unknown;
};

function getApi(slug: string) {
  return APIS.find((api) => api.slug === slug) ?? null;
}

function getDefaultParamValue(slug: string, name: string) {
  const defaults: Record<string, PlaygroundParams> = {
    "ip-geolocation": { ip: "8.8.8.8", threat: "true" },
    "btc-usd-price-feed": { pair: "BTCUSD" },
    "eth-usd-price-feed": { pair: "ETHUSD" },
    "global-weather-api": { city: "Tokyo", units: "metric" },
  };

  return defaults[slug]?.[name] ?? "";
}

function createMockResponse(api: ApiItem, params: PlaygroundParams) {
  const now = Math.floor(Date.now() / 1000);

  if (api.slug === "ip-geolocation") {
    return {
      ip: params.ip || "8.8.8.8",
      country: "United States",
      region: "California",
      city: "Mountain View",
      latitude: 37.386,
      longitude: -122.0838,
      asn: "AS15169",
      isp: "Google LLC",
      threat_score: params.threat === "true" ? 0.01 : undefined,
      cached: false,
      timestamp: now,
    };
  }

  if (api.slug === "btc-usd-price-feed") {
    return {
      pair: params.pair || "BTCUSD",
      price: 108421.22,
      confidence: 0.999,
      source: "mock-chainlink",
      timestamp: now,
    };
  }

  if (api.slug === "eth-usd-price-feed") {
    return {
      pair: params.pair || "ETHUSD",
      price: 5122.91,
      confidence: 0.998,
      source: "mock-chainlink",
      timestamp: now,
    };
  }

  if (api.slug === "global-weather-api") {
    return {
      city: params.city || "Tokyo",
      units: params.units || "metric",
      temperature: 27,
      condition: "Cloudy",
      humidity: 61,
      wind_kph: 14,
      timestamp: now,
    };
  }

  return { ok: true, api: api.slug, timestamp: now };
}

export default function ApiDetailPage() {
  const params = useParams();
  const slug = params?.apiId as string;
  const matchedApi = getApi(slug);
  const api = matchedApi ?? APIS[0];
  const [tab, setTab] = useState<Tab>("docs");
  const [copied, setCopied] = useState(false);
  const [playgroundParams, setPlaygroundParams] = useState<PlaygroundParams>({});
  const [isTesting, setIsTesting] = useState(false);
  const [mockResult, setMockResult] = useState<unknown>(null);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);
  const [recentCalls, setRecentCalls] = useState<MockCall[]>([]);
  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const connections = useConnections();
  const connector =
    connectors.find((availableConnector) => availableConnector.type === "injected") ??
    connectors[0];
  const connectedAddress =
    address ?? connections[0]?.accounts[0] ?? undefined;
  const hasWalletConnection = isConnected || connections.length > 0;
  const visibleConnectError =
    connectError?.message.includes("already connected") ? null : connectError;

  const requestUrl = useMemo(() => {
    const url = new URL(api.endpoint);

    api.params.forEach((param) => {
      const value = playgroundParams[param.name];
      if (value) url.searchParams.set(param.name, value);
    });

    return url.toString();
  }, [api, playgroundParams]);

  useEffect(() => {
    const nextParams = Object.fromEntries(
      api.params.map((param) => [
        param.name,
        getDefaultParamValue(api.slug, param.name),
      ]),
    );

    setPlaygroundParams(nextParams);
    setMockResult(null);
    setCallStartedAt(null);
    setRecentCalls([]);
  }, [api]);

  if (!matchedApi) return notFound();

  const copy = async () => {
    await navigator.clipboard.writeText(api.endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = () => {
    if (hasWalletConnection) {
      setTab("playground");
      return;
    }

    if (!connector) return;

    connect({
      connector,
      chainId: morph.id,
    });
  };

  const updatePlaygroundParam = (name: string, value: string) => {
    setPlaygroundParams((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const runMockRequest = () => {
    setIsTesting(true);
    const startedAt = new Date();
    setCallStartedAt(startedAt.toLocaleTimeString());

    window.setTimeout(() => {
      const response = {
        status: 200,
        payment: {
          mode: "mock",
          standard: "x402",
          chain: "Morph L2",
          payer: connectedAddress,
          amount: `${api.price} USDC`,
        },
        data: createMockResponse(api, playgroundParams),
      };

      setMockResult(response);
      setRecentCalls((currentCalls) => [
        {
          id: `${api.slug}-${startedAt.getTime()}`,
          apiName: api.name,
          endpoint: requestUrl,
          status: response.status,
          amount: response.payment.amount,
          createdAt: startedAt.toLocaleTimeString(),
          latencyMs: 548,
          response,
        },
        ...currentCalls,
      ]);
      setTab("recent");
      setIsTesting(false);
    }, 550);
  };

  const showCallResponse = (call: MockCall) => {
    setMockResult(call.response);
    setCallStartedAt(call.createdAt);
    setTab("playground");
  };

  return (
    <div className={styles.shell}>
      <AppSidebar />

      <div className={styles.body}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/marketplace" className={styles.breadcrumbLink}>
            Marketplace
          </Link>
          <span className={styles.breadcrumbSep} aria-hidden="true">
            /
          </span>
          <span className={styles.breadcrumbLink} style={{ opacity: 0.5 }}>
            {api.category}
          </span>
          <span className={styles.breadcrumbSep} aria-hidden="true">
            /
          </span>
          <span className={styles.breadcrumbCurrent}>{api.name}</span>
        </nav>

        <div className={styles.layout}>
          <main className={styles.main}>
            <div className={styles.tags}>
              {api.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>

            <h1 className={styles.title}>{api.name}</h1>
            <p className={styles.desc}>{api.longDesc}</p>

            <div className={styles.statsBar}>
              <span className={styles.stat}>
                <strong>{api.totalCalls}</strong> total calls
              </span>
              <span className={styles.dot}>-</span>
              <span className={styles.stat}>
                <strong>{api.agentsActive}</strong> agents active
              </span>
              <span className={styles.dot}>-</span>
              <span className={styles.stat}>
                settlement: <strong>{api.settlement}</strong>
              </span>
            </div>

            <div className={styles.divider} />

            <div className={styles.tabs} role="tablist">
              {(["docs", "playground", "recent"] as Tab[]).map((currentTab) => (
                <button
                  key={currentTab}
                  role="tab"
                  aria-selected={tab === currentTab}
                  className={`${styles.tab} ${
                    tab === currentTab ? styles.tabActive : ""
                  }`}
                  onClick={() => setTab(currentTab)}
                >
                  {currentTab === "docs" && <span className={styles.tabIcon}>[]</span>}
                  {currentTab === "playground" && (
                    <span className={styles.tabIcon}>&gt;</span>
                  )}
                  {currentTab === "docs"
                    ? "Docs"
                    : currentTab === "playground"
                      ? "Playground"
                      : "Recent Calls"}
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
                      <code className={styles.endpointUrl}>{api.endpoint}</code>
                      <button className={styles.copyBtn} onClick={copy}>
                        {copied ? "COPIED" : "COPY"}
                      </button>
                    </div>

                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Type</th>
                            <th>Required</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {api.params.map((param) => (
                            <tr key={param.name}>
                              <td>
                                <code className={styles.paramName}>
                                  {param.name}
                                </code>
                              </td>
                              <td>
                                <span className={styles.typeTag}>{param.type}</span>
                              </td>
                              <td className={styles.requiredCell}>
                                {param.required}
                              </td>
                              <td className={styles.descCell}>
                                {param.description}
                              </td>
                            </tr>
                          ))}
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
                          <tr>
                            <th>Property</th>
                            <th>Value</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>
                              <code className={styles.paramName}>
                                Payment Standard
                              </code>
                            </td>
                            <td>
                              <span className={styles.typeTag}>x402</span>
                            </td>
                            <td className={styles.descCell}>
                              Machine-native payment protocol
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <code className={styles.paramName}>Token</code>
                            </td>
                            <td>
                              <span className={styles.typeTag}>USDC</span>
                            </td>
                            <td className={styles.descCell}>
                              Settlement currency for API calls
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <code className={styles.paramName}>
                                Settlement Chain
                              </code>
                            </td>
                            <td>
                              <span className={styles.typeTag}>Morph L2</span>
                            </td>
                            <td className={styles.descCell}>
                              Network used for fast settlement
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <code className={styles.paramName}>Speed</code>
                            </td>
                            <td>
                              <span className={styles.typeTag}>&lt;1s</span>
                            </td>
                            <td className={styles.descCell}>
                              Average settlement finality
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <code className={styles.paramName}>
                                Provider Address
                              </code>
                            </td>
                            <td colSpan={2} className={styles.protocolAddress}>
                              {api.providerFull}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    Example - Agent Integration
                  </h2>
                  <pre className={styles.codeBlock}>
                    <code>{api.codeExample}</code>
                  </pre>
                </section>

                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Response Schema</h2>
                  <pre className={styles.codeBlock}>
                    <code>{api.responseSchema}</code>
                  </pre>
                </section>
              </div>
            )}

            {tab === "playground" &&
              (hasWalletConnection ? (
                <div className={styles.playgroundPanel}>
                  <div className={styles.playgroundHeader}>
                    <div>
                      <h2 className={styles.sectionTitle}>Mock API Playground</h2>
                      <p className={styles.playgroundIntro}>
                        Test the request shape with a simulated x402 payment. No
                        live endpoint call or token transfer is made.
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
                        {api.params.map((param) => (
                          <label key={param.name} className={styles.paramField}>
                            <span className={styles.paramLabelRow}>
                              <span>{param.name}</span>
                              <span className={styles.paramMeta}>
                                {param.type} -{" "}
                                {param.required === "Yes" ? "required" : "optional"}
                              </span>
                            </span>

                            {param.type === "boolean" ? (
                              <select
                                className={styles.playgroundInput}
                                value={playgroundParams[param.name] ?? ""}
                                onChange={(event) =>
                                  updatePlaygroundParam(
                                    param.name,
                                    event.target.value,
                                  )
                                }
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <input
                                className={styles.playgroundInput}
                                value={playgroundParams[param.name] ?? ""}
                                onChange={(event) =>
                                  updatePlaygroundParam(
                                    param.name,
                                    event.target.value,
                                  )
                                }
                                placeholder={param.description}
                              />
                            )}
                          </label>
                        ))}
                      </div>

                      <div className={styles.mockPayment}>
                        <span>Mock x402 payment</span>
                        <strong>{api.price} USDC</strong>
                      </div>

                      <button
                        className={styles.runBtn}
                        onClick={runMockRequest}
                        disabled={isTesting}
                      >
                        {isTesting ? "Running Mock Call..." : "Run Mock API Test"}
                      </button>
                    </section>

                    <section className={styles.playgroundCard}>
                      <h3 className={styles.playgroundCardTitle}>Request</h3>
                      <pre className={styles.playgroundCode}>
                        <code>{`GET ${requestUrl}
x402-payment: mock-signature
x-agent-wallet: ${connectedAddress ?? "connected-wallet"}`}</code>
                      </pre>

                      <h3 className={styles.playgroundCardTitle}>Response</h3>
                      <pre className={styles.playgroundCode}>
                        <code>
                          {mockResult
                            ? JSON.stringify(mockResult, null, 2)
                            : "// Run a mock test to generate a response."}
                        </code>
                      </pre>

                      {callStartedAt ? (
                        <p className={styles.mockStatus}>
                          Last mock call at {callStartedAt} - settled instantly
                          on simulated Morph L2.
                        </p>
                      ) : null}
                    </section>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>&gt;</span>
                  <p className={styles.emptyTitle}>
                    Connect wallet to use Playground
                  </p>
                  <p className={styles.emptySubtitle}>
                    Connect your wallet to simulate an x402 payment and test this
                    API against a mock endpoint.
                  </p>
                  <button
                    className={styles.connectBtn}
                    onClick={handleConnect}
                    disabled={isPending || !connector}
                  >
                    {isPending ? "Connecting..." : "Connect Wallet"}
                  </button>
                  {visibleConnectError ? (
                    <p className={styles.connectError}>{visibleConnectError.message}</p>
                  ) : null}
                </div>
              ))}

            {tab === "recent" && (
              recentCalls.length > 0 ? (
                <div className={styles.recentPanel}>
                  <div className={styles.recentHeader}>
                    <h2 className={styles.sectionTitle}>Recent Mock Calls</h2>
                    <span className={styles.recentCount}>
                      {recentCalls.length} saved
                    </span>
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

                        <button
                          className={styles.viewResponseBtn}
                          onClick={() => showCallResponse(call)}
                        >
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
                  <p className={styles.emptySubtitle}>
                    Run a mock API test and the call will appear here
                    automatically.
                  </p>
                </div>
              )
            )}
          </main>

          <aside className={styles.priceCardWrap}>
            <div className={styles.priceCard}>
              <div className={styles.priceRow}>
                <div className={styles.priceDisplay}>
                  <span className={styles.priceValue}>{api.price}</span>
                  <span className={styles.priceUnit}>USDC/CALL</span>
                </div>
              </div>

              <ul className={styles.featureList}>
                {[
                  "No account or API key required",
                  "Wallet balance funds calls directly",
                  "Sub-1s settlement on Morph L2",
                  "99% revenue to provider",
                ].map((feature) => (
                  <li key={feature} className={styles.featureItem}>
                    <span className={styles.featureCheck} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={styles.playgroundBtn}
                onClick={() => setTab("playground")}
              >
                TRY IN PLAYGROUND
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
