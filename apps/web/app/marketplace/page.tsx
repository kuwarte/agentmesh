'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import AppSidebar from '@/components/layout/AppSidebar'
import Footer from '@/components/layout/Footer'

import styles from './marketplace.module.css'

const APIS = [
  {
    id: 1,
    slug: 'ip-geolocation',
    category: 'Data Feeds',
    name: 'IP Geolocation',
    description:
      'City, country, ASN, VPN detection, and threat score for any IP address with ultra-fast response times.',
    provider: '0x5E6F···3E4F',
    endpoint: 'api.agentmesh.io/v1/ip-geolocation',
    price: '$0.0005',
  },
  {
    id: 2,
    slug: 'btc-usd-price-feed',
    category: 'Crypto/DeFi',
    name: 'BTC/USD Price Feed',
    description:
      'Real-time Bitcoin spot price feed powered by decentralized oracle aggregation.',
    provider: '0x4F3A···839B',
    endpoint: 'api.agentmesh.io/v1/btc-price',
    price: '$0.0010',
  },
  {
    id: 3,
    slug: 'eth-usd-price-feed',
    category: 'Crypto/DeFi',
    name: 'ETH/USD Price Feed',
    description:
      'Institutional-grade Ethereum price feed with sub-second updates and historical snapshots.',
    provider: '0x4F3A···839B',
    endpoint: 'api.agentmesh.io/v1/eth-price',
    price: '$0.0010',
  },
  {
    id: 4,
    slug: 'weather-api',
    category: 'Weather',
    name: 'Global Weather API',
    description:
      'Forecast, rainfall, humidity, and climate data for over 50,000 global locations.',
    provider: '0x7E2F···4E5F',
    endpoint: 'api.agentmesh.io/v1/weather',
    price: '$0.0020',
  },
  {
    id: 5,
    slug: 'forex-rates',
    category: 'Finance',
    name: 'Forex Currency Rates',
    description:
      'Live exchange rates for 170+ fiat currency pairs with central bank references.',
    provider: '0x7E2F···4E5F',
    endpoint: 'api.agentmesh.io/v1/forex',
    price: '$0.0020',
  },
  {
    id: 6,
    slug: 'web-scraper',
    category: 'Web Scraping',
    name: 'Web Content Scraper',
    description:
      'Headless browser scraping with JavaScript rendering and markdown extraction.',
    provider: '0x4F3A···839B',
    endpoint: 'api.agentmesh.io/v1/scrape',
    price: '$0.0050',
  },
  {
    id: 7,
    slug: 'llm-inference',
    category: 'AI/Compute',
    name: 'LLM Inference API',
    description:
      'Low-latency inference endpoint for Llama 3.1 70B with streaming support.',
    provider: '0x9A1B···2C3D',
    endpoint: 'api.agentmesh.io/v1/llm',
    price: '$0.0001',
  },
  {
    id: 8,
    slug: 'image-classification',
    category: 'AI/Compute',
    name: 'Image Classification',
    description:
      'Computer vision endpoint returning top predictions and confidence scores.',
    provider: '0x9A1B···2C3D',
    endpoint: 'api.agentmesh.io/v1/image-classification',
    price: '$0.0008',
  },
  {
    id: 9,
    slug: 'gas-oracle',
    category: 'Data Feeds',
    name: 'Gas Price Oracle',
    description:
      'Multi-chain gas estimation and predictive pricing updated every block.',
    provider: '0x5E6F···3E4F',
    endpoint: 'api.agentmesh.io/v1/gas-oracle',
    price: '$0.0003',
  },
  {
    id: 10,
    slug: 'nft-floor-prices',
    category: 'Data Feeds',
    name: 'NFT Floor Prices',
    description:
      'Aggregated NFT floor prices from OpenSea, Blur, and Magic Eden marketplaces.',
    provider: '0x5E6F···3E4F',
    endpoint: 'api.agentmesh.io/v1/nft-floor',
    price: '$0.0015',
  },
  {
    id: 11,
    slug: 'stock-quotes',
    category: 'Finance',
    name: 'Stock Quotes API',
    description:
      'Real-time stock prices, market caps, and daily volume for major exchanges.',
    provider: '0x7E2F···4E5F',
    endpoint: 'api.agentmesh.io/v1/stocks',
    price: '$0.0025',
  },
  {
    id: 12,
    slug: 'defi-liquidity-feed',
    category: 'Crypto/DeFi',
    name: 'DeFi Liquidity Feed',
    description:
      'Uniswap v3 liquidity positions, reserves, and tick-level analytics.',
    provider: '0x4F3A···839B',
    endpoint: 'api.agentmesh.io/v1/liquidity',
    price: '$0.0012',
  },
  {
    id: 13,
    slug: 'social-sentiment',
    category: 'Web Scraping',
    name: 'Social Sentiment API',
    description:
      'AI-scored sentiment aggregation from X, Reddit, Discord, and Telegram.',
    provider: '0x8B2C···F01A',
    endpoint: 'api.agentmesh.io/v1/sentiment',
    price: '$0.0030',
  },
  {
    id: 14,
    slug: 'wallet-risk-score',
    category: 'Crypto/DeFi',
    name: 'Wallet Risk Score',
    description:
      'Analyze wallet behavior, sanctions exposure, and fraud probability instantly.',
    provider: '0x8B2C···F01A',
    endpoint: 'api.agentmesh.io/v1/wallet-risk',
    price: '$0.0018',
  },
  {
    id: 15,
    slug: 'email-validation',
    category: 'Data Feeds',
    name: 'Email Validation',
    description:
      'Disposable email detection, MX lookup, and domain verification API.',
    provider: '0x3AC9···91FF',
    endpoint: 'api.agentmesh.io/v1/email-verify',
    price: '$0.0004',
  },
  {
    id: 16,
    slug: 'ocr-document-parser',
    category: 'AI/Compute',
    name: 'OCR Document Parser',
    description:
      'Extract text, tables, and structured fields from PDFs and scanned documents.',
    provider: '0x9A1B···2C3D',
    endpoint: 'api.agentmesh.io/v1/ocr',
    price: '$0.0040',
  },
]

const CATEGORIES = [
  'All',
  'Crypto/DeFi',
  'Finance',
  'Weather',
  'Web Scraping',
  'AI/Compute',
  'Data Feeds',
]

export default function MarketplacePage() {
  const [search, setSearch] = useState('')
  const [active, setActive] = useState('All')

  const visible = useMemo(() => {
    return APIS.filter(api => {
      const matchCategory =
        active === 'All' || api.category === active

      const matchSearch =
        api.name.toLowerCase().includes(search.toLowerCase()) ||
        api.description.toLowerCase().includes(search.toLowerCase())

      return matchCategory && matchSearch
    })
  }, [search, active])

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
            {CATEGORIES.map(category => (
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
          <div className={styles.grid}>
            {visible.map(api => (
              <Link
                key={api.id}
                href={`/marketplace/${api.slug}`}
                className={styles.card}
              >
                <div className={styles.cardTop}>
                  <span className={styles.badge}>
                    {api.category}
                  </span>

                  <h3 className={styles.cardTitle}>
                    {api.name}
                  </h3>

                  <p className={styles.cardDesc}>
                    {api.description}
                  </p>
                </div>

                <div className={styles.cardMeta}>
                  <div className={styles.metaRow}>
                    <span>Provider</span>
                    <code>{api.provider}</code>
                  </div>

                  <div className={styles.metaRow}>
                    <span>Endpoint</span>
                    <code>{api.endpoint}</code>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.price}>
                    {api.price}
                    <span>USDC/CALL</span>
                  </div>

                  <div className={styles.viewBtn}>
                    VIEW
                  </div>
                </div>
              </Link>
            ))}
          </div>

        </main>

      </div>
    </div>
  )
}