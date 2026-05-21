'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import styles from './AppSidebar.module.css'

const PROVIDER_NAV = [
  {
    label: 'Dashboard',
    href: '/provider',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="3" width="7" height="7" rx="1" />
        <rect x="15" y="3" width="7" height="7" rx="1" />
        <rect x="2" y="14" width="7" height="7" rx="1" />
        <rect x="15" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: 'My APIs',
    href: '/provider/apis',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 6h16M4 12h16M4 18h8" />
      </svg>
    ),
  },
  {
    label: 'Analytics',
    href: '/provider/analytics',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/provider/settings',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
    ),
  },
]

export default function ProviderSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : ''

  const handleDisconnect = () => {
    disconnect()
    // Stay on /provider — the page gate will show the ConnectModal automatically
    // since wagmi's isConnected will flip to false reactively
  }

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoWrap}>
        <Link href="/" className={styles.logo}>
          <Image
            src="/logo.png"
            alt="AgentMesh"
            width={30}
            height={30}
            priority
            className={styles.logoImage}
          />
          <span className={styles.logoText}>Agent Mesh</span>
        </Link>
      </div>

      {/* Navigation — only shown when connected */}
      <nav className={styles.nav} aria-label="Provider navigation">
        {isConnected &&
          PROVIDER_NAV.map(({ label, href, icon }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${
                pathname === href ? styles.navActive : ''
              }`}
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
            </Link>
          ))}
      </nav>

      {/* Bottom */}
      <div className={styles.bottom}>
        {isConnected ? (
          <>
            {/* Live wallet address chip */}
            <div className={styles.walletConnected}>
              <span className={styles.walletDot} />
              {shortAddress}
            </div>

            {/* Disconnect */}
            <button
              className={styles.disconnectBtn}
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          </>
        ) : (
          /* Not connected — show nothing, modal handles it */
          <span className={styles.sidebarHint}>Connect wallet to continue</span>
        )}
      </div>
    </aside>
  )
}
