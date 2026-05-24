"use client";

import AppSidebar from "@/components/layout/AppSidebar";
import { fetchApiBySlug, fetchApiById, type ApiDetail } from "@/lib/backend";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./apiDetail.module.css";

type Tab = "docs" | "playground" | "recent";

export default function ApiDetailPage() {
  const params = useParams();
  const slug   = params?.apiId as string;

  const [api, setApi]     = useState<ApiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]     = useState<Tab>("docs");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Try slug first, fall back to raw apiId lookup
    fetchApiBySlug(slug)
      .then(data => {
        if (data) { setApi(data); return; }
        return fetchApiById(slug).then(d => setApi(d));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return null; // keep layout stable while fetching
  if (!api)    return notFound();

  const callUrl = `/api/v1/call/${api.apiId}`;

  const copy = async () => {
    await navigator.clipboard.writeText(callUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.shell}>
      {/* ── Left sidebar ──────────────────────────────── */}
      <AppSidebar />

      {/* ── Scrollable content area ───────────────────── */}
      <div className={styles.body}>
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/marketplace" className={styles.breadcrumbLink}>
            Marketplace
          </Link>
          <span className={styles.breadcrumbSep} aria-hidden="true">
            ›
          </span>
          <span className={styles.breadcrumbLink} style={{ opacity: 0.5 }}>
            {api.category ?? "Uncategorized"}
          </span>
          <span className={styles.breadcrumbSep} aria-hidden="true">
            ›
          </span>
          <span className={styles.breadcrumbCurrent}>{api.name}</span>
        </nav>

        {/* Two-col layout: main + sticky price card */}
        <div className={styles.layout}>
          {/* ── Main ──────────────────────────────────── */}
          <main className={styles.main}>
            {/* Tags */}
            <div className={styles.tags}>
              {(api.tags ?? []).map((t) => (
                <span key={t} className={styles.tag}>
                  {t}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className={styles.title}>{api.name}</h1>

            {/* Description */}
            <p className={styles.desc}>{api.longDesc ?? api.description ?? ""}</p>

            {/* Stats */}
            <div className={styles.statsBar}>
              <span className={styles.stat}>
                settlement: <strong>Morph L2</strong>
              </span>
            </div>

            <div className={styles.divider} />

            {/* Tabs */}
            <div className={styles.tabs} role="tablist">
              {(["docs", "playground", "recent"] as Tab[]).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t === "docs" && <span className={styles.tabIcon}>□</span>}
                  {t === "playground" && (
                    <span className={styles.tabIcon}>▷</span>
                  )}
                  {t === "docs"
                    ? "Docs"
                    : t === "playground"
                      ? "Playground"
                      : "Recent Calls"}
                </button>
              ))}
            </div>

            {/* ── DOCS TAB ──────────────────────────── */}
            {tab === "docs" && (
              <div className={styles.docsContent}>
                {/* Endpoint */}
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Endpoint</h2>
                  <div className={styles.endpointBox}>
                    <div className={styles.endpointRow}>
                      <span className={styles.methodBadge}>GET</span>
                      <code className={styles.endpointUrl}>{callUrl}</code>
                      <button className={styles.copyBtn} onClick={copy}>
                        {copied ? "✓ COPIED" : "COPY"}
                      </button>
                    </div>

                    {(api.params ?? []).length > 0 && (
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
                            {api.params.map((p) => (
                              <tr key={p.name}>
                                <td>
                                  <code className={styles.paramName}>
                                    {p.name}
                                  </code>
                                </td>
                                <td>
                                  <span className={styles.typeTag}>{p.type}</span>
                                </td>
                                <td className={styles.requiredCell}>
                                  {p.required}
                                </td>
                                <td className={styles.descCell}>
                                  {p.description}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>

                {/* Protocol */}
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
                            <td colSpan={2} className={styles.protocolAddress}>
                              {api.provider}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {/* Code example */}
                {api.codeExample && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                      Example — Agent Integration
                    </h2>
                    <pre className={styles.codeBlock}>
                      <code>{api.codeExample}</code>
                    </pre>
                  </section>
                )}

                {/* Response schema */}
                {api.responseSchema && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Response Schema</h2>
                    <pre className={styles.codeBlock}>
                      <code>{api.responseSchema}</code>
                    </pre>
                  </section>
                )}
              </div>
            )}

            {/* ── PLAYGROUND TAB ────────────────────── */}
            {tab === "playground" && (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>▷</span>
                <p className={styles.emptyTitle}>
                  Connect wallet to use Playground
                </p>
                <p className={styles.emptySubtitle}>
                  Sign an x402 payment and test this API live against the real
                  endpoint.
                </p>
                <button className={styles.connectBtn}>Connect Wallet</button>
              </div>
            )}

            {/* ── RECENT CALLS TAB ──────────────────── */}
            {tab === "recent" && (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>◷</span>
                <p className={styles.emptyTitle}>No recent calls</p>
                <p className={styles.emptySubtitle}>
                  Your agent call history will appear here after your first
                  request.
                </p>
              </div>
            )}
          </main>

          {/* ── Sticky price card ─────────────────────── */}
          <aside className={styles.priceCardWrap}>
            <div className={styles.priceCard}>
              <div className={styles.priceRow}>
                <div className={styles.priceDisplay}>
                  <span className={styles.priceValue}>${api.priceUsd}</span>
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
                    <span className={styles.featureCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button className={styles.playgroundBtn}>
                TRY IN PLAYGROUND
              </button>
            </div>
          </aside>
        </div>

      </div>
    </div>
  );
}
