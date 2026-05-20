"use client";

import { useReveal } from "@/hooks/useReveal";
import styles from "./Protocol.module.css";

const STEPS = [
  {
    id: "01",
    title: "Discovery",
    desc: "Agents query the on-chain registry to discover available endpoints, data schemas, and pricing structures without human API key generation.",
  },
  {
    id: "02",
    title: "HTTP 402 Challenge",
    desc: "The requested API endpoint intercepts the call, returning a 402 Payment Required status alongside the required X402 payment payload.",
  },
  {
    id: "03",
    title: "EIP-3009 Auth",
    desc: "The agent generates a gasless transferWithAuthorization signature for the exact USDC amount, requiring zero wallet popups or manual approvals.",
  },
  {
    id: "04",
    title: "Settlement & Release",
    desc: "The X402Facilitator smart contract verifies the signature on Morph L2. Upon sub-cent settlement, the data is instantly released to the agent.",
  },
];

export default function Protocol() {
  const headerRef = useReveal<HTMLDivElement>({ threshold: 0.1 });
  const gridRef = useReveal<HTMLDivElement>({ threshold: 0.2 });
  const impactRef = useReveal<HTMLDivElement>({ threshold: 0.2 });

  return (
    <section id="protocol" className={styles.section}>
      <div className="container">
        
        {/* ── Section Header ──────────────────────────── */}
        <div 
          ref={headerRef} 
          className={styles.header}
          data-reveal="up"
        >
          <span className={styles.badge}>Protocol</span>
          <h2 className={styles.title}>Payment as Authentication.</h2>
          <p className={styles.subtitle}>
            The internet was built for humans. AgentMesh rebuilds the interface layer 
            for machines, replacing credentials with cryptographic micropayments.
          </p>
        </div>

        {/* ── Architecture Grid ───────────────────────── */}
        <div 
          ref={gridRef} 
          className={styles.grid}
          data-reveal="up"
        >
          {STEPS.map((step) => (
            <div key={step.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.stepNum}>{step.id}</span>
                <h3 className={styles.cardTitle}>{step.title}</h3>
              </div>
              <p className={styles.cardDesc}>{step.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Regional Impact ─────────────────────────── */}
        <div 
          ref={impactRef} 
          className={styles.impactWrapper}
          data-reveal="up"
        >
          <div className={styles.impactContent}>
            <h3 className={styles.impactTitle}>Unlocking Southeast Asia</h3>
            <p className={styles.impactText}>
              Over 70 million adults in the region remain unbanked, relying heavily on intermediaries 
              to interact with digital financial services. AgentMesh allows AI agents to act as autonomous 
              proxies—executing micro-transactions and coordinating across platforms without requiring 
              credit cards, KYC, or traditional banking.
            </p>
            <p className={styles.impactText}>
              By leveraging Morph&apos;s L2 infrastructure, we ensure sub-cent transaction viability, 
              removing the human bottlenecks that have historically excluded this market from the global API economy.
            </p>
          </div>
          <div className={styles.impactVisual} aria-hidden="true">
            <div className={styles.codeBlock}>
              <span className={styles.comment}>X402 Facilitator Settlement</span>
              <span className={styles.keyword}>function</span> <span className={styles.func}>settlePayment</span>(
              <br />  <span className={styles.type}>address</span> agent,
              <br />  <span className={styles.type}>uint256</span> amount,
              <br />  <span className={styles.type}>bytes</span> <span className={styles.keyword}>calldata</span> signature
              <br />) <span className={styles.keyword}>external</span> {'{'}
              <br />  <span className={styles.comment}> EIP-3009 transfer execution</span>
              <br />  usdc.receiveWithAuthorization(agent, amount, signature);
              <br />{'}'}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}