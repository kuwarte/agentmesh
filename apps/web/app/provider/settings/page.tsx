'use client'

import ProviderSidebar from '@/components/layout/ProviderSidebar'
import styles from '../Provider.module.css'

export default function ProviderSettingsPage() {
  return (
    <div className={styles.layout}>
      <ProviderSidebar />

      <main className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Settings</h1>
            <p className={styles.pageSubtitle}>
              Configure provider profile metadata, payout preferences, and
              endpoint notification rules.
            </p>
          </div>
        </div>

        <div className={styles.settingsGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Provider Profile</h2>
              <span className={styles.badge}>public</span>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.formField}>
                Display name
                <input defaultValue="AgentMesh Data Labs" />
              </label>
              <label className={styles.formField}>
                Support email
                <input defaultValue="ops@agentmesh.io" />
              </label>
              <label className={styles.formFieldWide}>
                Description
                <textarea defaultValue="Low-latency data APIs for autonomous agents, trading systems, and analytics workflows." />
              </label>
            </div>

            <button className={styles.registerBtn}>SAVE PROFILE</button>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Payouts</h2>
              <span className={styles.badge}>USDC</span>
            </div>

            <div className={styles.settingList}>
              <div className={styles.settingRow}>
                <div>
                  <strong>Auto-claim earnings</strong>
                  <span>Claim settled USDC when balance exceeds 50 USDC.</span>
                </div>
                <input type="checkbox" defaultChecked />
              </div>
              <div className={styles.settingRow}>
                <div>
                  <strong>Daily payout summary</strong>
                  <span>Send a compact email report every 24 hours.</span>
                </div>
                <input type="checkbox" defaultChecked />
              </div>
              <div className={styles.settingRow}>
                <div>
                  <strong>Draft endpoint approvals</strong>
                  <span>Require manual review before a draft goes live.</span>
                </div>
                <input type="checkbox" />
              </div>
            </div>
          </section>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>API Defaults</h2>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.formField}>
              Default price
              <input defaultValue="0.0010 USDC" />
            </label>
            <label className={styles.formField}>
              Rate limit
              <input defaultValue="1200 calls / minute" />
            </label>
            <label className={styles.formField}>
              Settlement chain
              <input defaultValue="Morph L2" />
            </label>
            <label className={styles.formField}>
              Health check path
              <input defaultValue="/health" />
            </label>
          </div>
        </section>
      </main>
    </div>
  )
}
