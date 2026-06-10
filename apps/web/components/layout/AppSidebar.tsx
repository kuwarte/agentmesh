"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useConnections, useDisconnect } from "wagmi";
import { morph } from "@/lib/chains";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "./AppSidebar.module.css";

const NAV_ITEMS = [
  {
    label: "Marketplace",
    href: "/marketplace",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="2" y="3" width="7" height="7" rx="1" />
        <rect x="15" y="3" width="7" height="7" rx="1" />
        <rect x="2" y="14" width="7" height="7" rx="1" />
        <rect x="15" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Provider",
    href: "/provider",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const connections = useConnections();
  const { disconnect } = useDisconnect();

  const connector =
    connectors.find((connector) => connector.type === "injected") ??
    connectors[0];

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : connections[0]?.accounts[0]
      ? `${connections[0].accounts[0].slice(0, 6)}...${connections[0].accounts[0].slice(-4)}`
    : "";
  const hasWalletConnection = isConnected || connections.length > 0;

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

      {/* Navigation */}
      <nav className={styles.nav} aria-label="App navigation">
        {NAV_ITEMS.map(({ label, href, icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${
              pathname?.startsWith(href) ? styles.navActive : ""
            }`}
          >
            <span className={styles.navIcon}>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom */}
      <div className={styles.bottom}>
        <ThemeToggle compact />

        <Link href="/provider" className={styles.providerBtn}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          Be a Provider
        </Link>

        {!hasWalletConnection ? (
          <button
            className={styles.walletBtn}
            onClick={() => connector && connect({ connector, chainId: morph.id })}
            disabled={isPending || !connector}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <path d="M1 10h22" />
            </svg>

            {isPending ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <button
            className={styles.walletConnected}
            onClick={() => disconnect()}
          >
            <span className={styles.walletDot} />

            {shortAddress}
          </button>
        )}
      </div>
    </aside>
  );
}
