'use client'

import { useTheme } from './ThemeProvider'
import styles from './ThemeToggle.module.css'

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className={`${styles.toggle} ${compact ? styles.compact : ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
    >
      <span className={styles.icon} aria-hidden="true">
        {isLight ? '☀' : '☾'}
      </span>
    </button>
  )
}
