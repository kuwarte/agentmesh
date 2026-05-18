'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './Navbar.module.css'

import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useChainId,
} from 'wagmi'

import { morph } from '@/lib/chains'

const NAV_LINKS = [
  { label: 'Protocol', href: '#protocol' },
  { label: 'Docs', href: '#docs' },
  { label: 'Pricing', href: '#pricing' },
]

function truncate(addr?: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  /* scroll effect */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* lock scroll */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const handleWallet = async () => {
    if (isConnected) {
      disconnect()
      return
    }

    const connector = connectors[0]
    if (connector) connect({ connector })
  }

  const ensureMorphChain = async () => {
    if (chainId !== morph.id && switchChain) {
      try {
        await switchChain({ chainId: morph.id })
      } catch (e) {
        console.error('Chain switch failed', e)
      }
    }
  }

  return (
    <>
      <header className={`nav ${styles.header} ${scrolled ? styles.scrolled : ''}`}>
        <div className="nav__inner">

          {/* LOGO */}
          <Link href="/" className={`nav__logo ${styles.logo}`}>
            <span className={styles.logoIcon}>/&gt;</span>
            Agent Mesh
          </Link>

          {/* NAV */}
          <nav className="nav__links">
            {NAV_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="nav__link">
                {l.label}
              </Link>
            ))}
          </nav>

          {/* ACTIONS */}
          <div className={styles.actions}>

            {/* WALLET BUTTON */}
            <button
              className={`btn btn-ghost ${styles.walletBtn}`}
              onClick={async () => {
                await handleWallet()
                await ensureMorphChain()
              }}
              disabled={isPending}
            >
              {isConnected
                ? truncate(address)
                : isPending
                  ? 'Connecting...'
                  : 'Connect Wallet'}
            </button>

            {/* HAMBURGER */}
            <button
              className={styles.hamburger}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className={`${styles.bar} ${menuOpen ? styles.barTopOpen : ''}`} />
              <span className={`${styles.bar} ${menuOpen ? styles.barMidOpen : ''}`} />
              <span className={`${styles.bar} ${menuOpen ? styles.barBotOpen : ''}`} />
            </button>

          </div>
        </div>
      </header>

      {/* MOBILE MENU */}
      <div
        id="mobile-menu"
        className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}
      >
        <nav className={styles.mobileLinks}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={styles.mobileLink}
              onClick={() => setMenuOpen(false)}
            >
              <span className={styles.mobileLinkArrow}>→</span>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={styles.mobileCta}>
          <button
            className={`btn btn-primary ${styles.mobileWalletBtn}`}
            onClick={async () => {
              await handleWallet()
              await ensureMorphChain()
              setMenuOpen(false)
            }}
          >
            {isConnected ? 'Disconnect' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    </>
  )
}