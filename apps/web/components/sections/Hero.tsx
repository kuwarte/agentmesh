"use client";

import { useRef, useEffect, useCallback } from "react";
import styles from "./Hero.module.css";

const WAITLIST_COUNT = 120_384;
const BEAM_COUNT = 75;

export default function Hero() {
  const beamsRef = useRef<HTMLDivElement>(null);

  /* ─────────────────────────────────────────────────────
     Smooth beam interaction
     Slower + softer lighting response
  ───────────────────────────────────────────────────── */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = beamsRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const beams = container.querySelectorAll<HTMLElement>(`.${styles.beam}`);

    const total = beams.length;

    beams.forEach((beam, i) => {
      const beamCenterX = (i / (total - 1)) * rect.width;

      const dist = Math.abs(mouseX - beamCenterX);

      /* wider interaction spread */
      const maxDist = rect.width * 0.28;

      const proximity = Math.max(0, 1 - dist / maxDist);

      /* softer exponential easing */
      const boost = Math.pow(proximity, 2.8);

      beam.style.setProperty("--hover-boost", String(boost));

      beam.style.setProperty("--hover-scaleX", String(1 + boost * 0.18));
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const container = beamsRef.current;
    if (!container) return;

    container
      .querySelectorAll<HTMLElement>(`.${styles.beam}`)
      .forEach((beam) => {
        beam.style.setProperty("--hover-boost", "0");
        beam.style.setProperty("--hover-scaleX", "1");
      });
  }, []);

  useEffect(() => {
    const hero = beamsRef.current?.closest(
      `.${styles.hero}`,
    ) as HTMLElement | null;

    if (!hero) return;

    hero.addEventListener("mousemove", handleMouseMove as EventListener);

    hero.addEventListener("mouseleave", handleMouseLeave as EventListener);

    return () => {
      hero.removeEventListener("mousemove", handleMouseMove as EventListener);

      hero.removeEventListener("mouseleave", handleMouseLeave as EventListener);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <section className={styles.hero} aria-label="Hero">
      {/* ── Beams ───────────────────────────── */}
      <div className={styles.beams} ref={beamsRef} aria-hidden="true">
        {Array.from({ length: BEAM_COUNT }).map((_, i) => {
          const centerDist = 1 - Math.abs(i / (BEAM_COUNT - 1) - 0.5) * 2;

          return (
            <span
              key={i}
              className={styles.beam}
              style={
                {
                  "--i": i,
                  "--center-dist": centerDist,
                  "--hover-boost": 0,
                  "--hover-scaleX": 1,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      {/* ── Glow Pool ─────────────────────── */}
      <div className={styles.glowPool} aria-hidden="true" />

      {/* ── Vignette ──────────────────────── */}
      <div className={styles.vignette} aria-hidden="true" />

      {/* ── Content ───────────────────────── */}
      <div className={styles.content}>
        <h1 className={`${styles.headline} animate-fade-up delay-200`}>
          APIs for
          <br />
          <span className={styles.headlineAccent}>Autonomous Agents</span>
        </h1>

        <p className={`${styles.sub} animate-fade-up delay-300`}>
          Discover, pay, and access APIs instantly, no accounts or API keys
          required.
        </p>

        {/* ── Waitlist ───────────────────── */}
        <div className={`${styles.waitlist} animate-fade-up delay-400`}>
          <div className={styles.avatars} aria-hidden="true">
            <span className={styles.avatar} />
            <span className={styles.avatar} />
            <span className={styles.avatar} />
          </div>

          <span className={styles.waitlistText}>
            {WAITLIST_COUNT.toLocaleString()} worldwide on waitlist
          </span>
        </div>

        {/* ── CTA ────────────────────────── */}
        <div className="animate-fade-up delay-500">
          <button className={styles.cta}>Join Waitlist</button>
        </div>
      </div>
    </section>
  );
}
