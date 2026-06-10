'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import AppSidebar from '@/components/layout/AppSidebar'
import { fetchApis, type BackendApi } from '@/lib/backend'

import styles from './marketplace.module.css'

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}···${addr.slice(-4)}`
}

export default function MarketplacePage() {
  const [search, setSearch] = useState('')
  const [active, setActive] = useState('All')
  const [apis, setApis] = useState<BackendApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchApis({ active: true })
      .then((data) => setApis(data.apis))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Derive categories dynamically from live data
  const categories = useMemo(() => {
    const cats = Array.from(
      new Set(apis.map((api) => api.category).filter(Boolean))
    ) as string[]
    return ['All', ...cats.sort()]
  }, [apis])

  const visible = useMemo(() => {
    return apis.filter((api) => {
      const matchCategory =
        active === 'All' || api.category === active

      const matchSearch =
        api.name.toLowerCase().includes(search.toLowerCase()) ||
        (api.description ?? '').toLowerCase().includes(search.toLowerCase())

      return matchCategory && matchSearch
    })
  }, [apis, search, active])

  return (
    <div className={styles.shell}>

      <AppSidebar />

      <div className={styles.content}>

        <main className={styles.main}>

          {/* Header */}
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Marketplace</h1>
              <p className={styles.subtitle}>
                Discover machine-native APIs powered by x402 micropayments
              </p>
            </div>

            <div className={styles.searchWrap}>
              <input
                type="text"
                placeholder="Search APIs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Categories */}
          <div className={styles.categories}>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActive(category)}
                className={`${styles.categoryBtn} ${
                  active === category ? styles.categoryActive : ''
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading && (
            <div className={styles.grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.card} style={{ opacity: 0.4, pointerEvents: 'none' }}>
                  <div className={styles.cardTop}>
                    <span className={styles.badge}>Loading</span>
                    <h3 className={styles.cardTitle}>—</h3>
                    <p className={styles.cardDesc}>Fetching APIs…</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--color-error, #f87171)', padding: '1rem 0' }}>
              Failed to load APIs: {error}
            </p>
          )}

          {!loading && !error && (
            <div className={styles.grid}>
              {visible.map((api) => (
                <Link
                  key={api.apiId}
                  href={`/marketplace/${api.slug ?? api.apiId}`}
                  className={styles.card}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.badge}>
                      {api.category ?? 'Uncategorized'}
                    </span>

                    <h3 className={styles.cardTitle}>
                      {api.name}
                    </h3>

                    <p className={styles.cardDesc}>
                      {api.description ?? 'No description available.'}
                    </p>
                  </div>

                  <div className={styles.cardMeta}>
                    <div className={styles.metaRow}>
                      <span>Provider</span>
                      <code>{shortenAddress(api.provider)}</code>
                    </div>

                    <div className={styles.metaRow}>
                      <span>Call ID</span>
                      <code title={api.callUrl}>
                        {`/api/v1/call/${api.apiId.slice(0, 10)}…`}
                      </code>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <div className={styles.price}>
                      {api.priceUsd}
                      <span>USDC/CALL</span>
                    </div>

                    <div className={styles.viewBtn}>
                      VIEW
                    </div>
                  </div>
                </Link>
              ))}

              {visible.length === 0 && (
                <p style={{ opacity: 0.5 }}>No APIs match your search.</p>
              )}
            </div>
          )}

        </main>

      </div>
    </div>
  )
}