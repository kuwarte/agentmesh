"use client";

import { useReveal, useRevealChildren } from "@/hooks/useReveal";
import { useEffect, useRef } from "react";
import styles from "./TechnicalApproach.module.css";

const STEPS = [
  {
    num: "01",
    title: "Registry Discovery",
    body: "The agent queries the on-chain ",
    code: "APIRegistry",
    body2:
      " contract on Morph L2 to resolve an endpoint URL and its USDC price per call. No off-chain directory, no account required.",
  },
  {
    num: "02",
    title: "Challenge Initiation",
    body: "The agent issues an unsigned GET request. Provider middleware intercepts it and returns HTTP 402 Payment Required — containing the endpoint ID, required USDC amount, facilitator contract address, chain ID, and instructions.",
    code: null,
    body2: "",
  },
  {
    num: "03",
    title: "Autonomous Payment Authorization",
    body: "The agent constructs and signs an EIP-3009 USDC ",
    code: "transferWithAuthorization",
    body2:
      " using its private key. A unique nonce and short-expiry deadline prevent replay attacks. The signed payload is attached to the X-Payment header.",
  },
  {
    num: "04",
    title: "On-chain Settlement Verification",
    body: "Provider middleware calls ",
    code: "X402Facilitator.settle()",
    body2:
      " on Morph L2. The contract verifies the EIP-712 signature, enforces nonce uniqueness, validates the deadline, and executes the USDC transfer — 99% to the provider, 1% to the protocol treasury.",
  },
  {
    num: "05",
    title: "Data Release",
    body: "Upon confirmed on-chain settlement, provider middleware releases the API response with HTTP 200 OK. The agent receives the data. The entire cycle — discovery to data receipt — requires zero human interaction.",
    code: null,
    body2: "",
  },
];

const BEAM_COUNT = 72;

export default function TechnicalApproach() {
  const beamsRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const progressRef = useRef(0);
  const targetRef = useRef(0);

  /* Reveal refs */
  const leftRef = useReveal<HTMLDivElement>({ threshold: 0.2 });
  const stepsRef = useRevealChildren<HTMLDivElement>({
    stagger: 90,
    threshold: 0.1,
    childSelector: `.${styles.step}`,
  });

  useEffect(() => {
    const wrap = wrapRef.current;
    const beamsEl = beamsRef.current;
    if (!wrap || !beamsEl) return;

    const onScroll = () => {
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight;
      const entered = vh - rect.top;
      const total = rect.height + vh * 0.5;
      targetRef.current = Math.min(1, Math.max(0, entered / total));
    };

    const beams = beamsEl.querySelectorAll<HTMLElement>(`.${styles.beam}`);

    const tick = () => {
      const diff = targetRef.current - progressRef.current;
      if (Math.abs(diff) > 0.0005) {
        progressRef.current += diff * 0.06;
        const p = progressRef.current;

        beams.forEach((beam, i) => {
          const centerDist = parseFloat(
            beam.style.getPropertyValue("--center-dist") || "0",
          );
          const wave = i / (BEAM_COUNT - 1);
          const delay = 0.15 + wave * 0.3;
          const local = Math.min(1, Math.max(0, (p - delay) / (1 - delay)));
          const eased = local * local * (3 - 2 * local);
          const boost = eased * (0.5 + centerDist * 0.5);
          beam.style.setProperty("--scroll-boost", String(boost));
          beam.style.setProperty("--scroll-scale", String(0.4 + eased * 0.6));
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section className={styles.section} aria-label="Technical Approach">
      <div className={styles.grid}>
        {/* Left col — reveal from left */}
        <div className={styles.left} ref={leftRef} data-reveal="left">
          <div className={styles.badge}>
            <span className={styles.badgeLine} aria-hidden="true" />
            <span className={styles.badgeText}>Technical Approach</span>
          </div>
          <h2 className={styles.headline}>
            Payment-as-
            <br />
            authentication.
            <br />
            A five-step
            <br />
            protocol.
          </h2>
          <p className={styles.body}>
            The approach replaces credential-based authentication with payment
            proof across three distinct system components, requiring zero human
            interaction end-to-end.
          </p>
        </div>

        {/* Right col — steps staggered from right */}
        <div className={styles.right} ref={stepsRef}>
          {STEPS.map(({ num, title, body, code, body2 }) => (
            <div key={num} className={styles.step} data-reveal="right">
              <div className={styles.stepHeader}>
                <span className={styles.stepNum}>{num}</span>
                <h3 className={styles.stepTitle}>{title}</h3>
              </div>
              <p className={styles.stepBody}>
                {body}
                {code && <code className={styles.code}>{code}</code>}
                {body2}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Beam footer */}
      <div className={styles.beamWrap} ref={wrapRef} aria-hidden="true">
        <div className={styles.beams} ref={beamsRef}>
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
                    "--scroll-boost": 0,
                    "--scroll-scale": 0.4,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
        <div className={styles.beamGlow} />
        <div className={styles.beamFade} />
      </div>
    </section>
  );
}
