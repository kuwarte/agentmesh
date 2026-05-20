"use client";

import { useReveal, useRevealChildren } from "@/hooks/useReveal";
import type { RefObject } from "react";
import styles from "./UnitEconomics.module.css";

const STATS = [
  {
    value: "99%",
    label: "Provider take-home rate",
    sub: "vs 70–80% on Web2",
  },
  {
    value: "$0.00",
    label: "Minimum viable unit price",
    sub: "enabled by L2 scaling",
  },
  {
    value: "<1s",
    label: "Settlement time",
    sub: "vs 7–30 days on Stripe",
  },
  {
    value: "$100K",
    label: "Daily protocol revenue",
    sub: "at 50K active agents",
  },
];

export default function UnitEconomics() {
  const headerRef = useReveal<HTMLDivElement>({ threshold: 0.2 });
  const statsRef = useRevealChildren<HTMLDivElement>({
    stagger: 100,
    threshold: 0.15,
  });

  return (
    <section className={styles.section} aria-label="Unit Economics">
      <div className={styles.inner}>
        {/* Header */}
        <div className={styles.header} ref={headerRef} data-reveal="up">
          <div className={styles.label}>
            <span className={styles.labelLine} aria-hidden="true" />
            <span className={styles.labelText}>Unit Economics</span>
          </div>
          <h2 className={styles.headline}>Numbers that scale.</h2>
        </div>

        {/* Stats — each child staggered */}
        <div className={styles.stats} ref={statsRef}>
          {STATS.map(({ value, label, sub }, i) => (
            <div
              key={i}
              className={styles.stat}
              data-reveal="scale"
              data-stagger={String(i + 1)}
            >
              {i > 0 && <div className={styles.divider} aria-hidden="true" />}
              <div className={styles.statInner}>
                <span className={styles.value}>{value}</span>
                <p className={styles.label2}>{label}</p>
                <p className={styles.sub}>{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
