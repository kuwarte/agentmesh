'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import AppSidebar from '@/components/layout/AppSidebar'
import Footer from '@/components/layout/Footer'
import { fetchApis, fetchCategories, type ApiListItem } from '@/lib/backend'

import styles from './marketplace.module.css'

export default function MarketplacePage() {
  const [apis, setApis]           = useState<ApiListItem[]>([])
  const [categories, setCategories] = useState<string[]>(['All'])
  const [search, setSearch]       = useState('')
  const [active, setActive]       = useState('All')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([fetchApis(), fetchCategories()])
      .then(([apiData, catData]) => {
        setApis(apiData)
        setCategories(catData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    return apis.filter(api => {
      const matchCategory =
        active === 'All' || api.category === active

      const matchSearch =
        api.name.toLowerCase().includes(search.toLowerCase()) ||
        (api.description ?? '').toLowerCase().includes(search.toLowerCase())

      return matchCategory && matchSearch
    })
  }, [apis, search, active])

  // Format provider address for display: 0xABCD···1234
  function shortAddr(addr: string) {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}···${addr.slice(-4)}`
  }

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
            {categories.map(category => (
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
          {loading ? (
            <div className={styles.grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.card} style={{ opacity: 0.4, pointerEvents: 'none' }} />
              ))}
            </div>
          ) : (
            <div className={styles.grid}>
              {visible.map(api => (
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
                      <code>{shortAddr(api.provider)}</code>
                    </div>

                    <div className={styles.metaRow}>
                      <span>API ID</span>
                      <code>{api.apiId.slice(0, 10)}···</code>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <div className={styles.price}>
                      ${api.priceUsd}
                      <span>USDC/CALL</span>
                    </div>

                    <div className={styles.viewBtn}>
                      VIEW
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

        </main>

      </div>
    </div>
  )
}
