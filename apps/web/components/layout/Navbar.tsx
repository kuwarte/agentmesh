"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "./Navbar.module.css";

const NAV_LINKS = [
  { label: "Marketplace", href: "marketplace" },
  { label: "Provider", href: "provider" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={`nav ${styles.header} ${scrolled ? styles.scrolled : ""}`}
      >
        <div className="nav__inner">
          {/* ── Left Side: Logo ───────────────────────────── */}
          <Link href="/" className={styles.logo}>
            <Image
              src="/logo.png"
              alt="Agent Mesh Logo"
              width={30}
              height={30}
              className={styles.logoImage}
              priority
            />
            <span className={styles.logoText}>Agent Mesh</span>
          </Link>

          {/* ── Right Side: Tabs & Mobile Menu ────────────── */}
          <div className={styles.actions}>
            <nav className="nav__links">
              {NAV_LINKS.map((l) => (
                <Link key={l.label} href={l.href} className="nav__link">
                  {l.label}
                </Link>
              ))}
            </nav>

            <ThemeToggle />

            <button
              className={styles.hamburger}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle mobile menu"
            >
              <span
                className={`${styles.bar} ${menuOpen ? styles.barTopOpen : ""}`}
              />
              <span
                className={`${styles.bar} ${menuOpen ? styles.barMidOpen : ""}`}
              />
              <span
                className={`${styles.bar} ${menuOpen ? styles.barBotOpen : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Menu Overlay ─────────────────────────── */}
      <div
        id="mobile-menu"
        className={`${styles.mobileMenu} ${
          menuOpen ? styles.mobileMenuOpen : ""
        }`}
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
          <ThemeToggle />
        </nav>
      </div>
    </>
  );
}
