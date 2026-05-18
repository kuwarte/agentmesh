import type { Metadata, Viewport } from 'next'
import { Space_Mono, Syne, Lexend } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

/* ============================================================
   FONT LOADING
   Space Mono  → --font-space-mono  → --font-mono  (code, badges, nav, buttons)
   Syne        → --font-syne        → --font-display (headings, hero)
   Lexend      → --font-lexend      → --font-body    (body copy, UI labels)
   ============================================================ */

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const lexend = Lexend({
  variable: '--font-lexend',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
})

/* ============================================================
   METADATA
   ============================================================ */

export const metadata: Metadata = {
  title: {
    default: 'AgentMesh — APIs for Autonomous Agents',
    template: '%s | AgentMesh',
  },
  description:
    'Discover, pay, and access APIs instantly. No accounts or API keys required. The payment-as-authentication protocol built for autonomous AI agents.',
  keywords: [
    'AI agents',
    'autonomous agents',
    'machine payments',
    'x402 protocol',
    'agent API',
    'Web3',
    'blockchain payments',
    'AI infrastructure',
    'decentralized API',
  ],
  authors: [{ name: 'AgentMesh' }],
  creator: 'AgentMesh',
  metadataBase: new URL('https://agentmesh.xyz'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://agentmesh.xyz',
    siteName: 'AgentMesh',
    title: 'AgentMesh — APIs for Autonomous Agents',
    description:
      'Payment-as-authentication. A five-protocol layer enabling AI agents to discover, pay, and access APIs with no human delegation.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AgentMesh — APIs for Autonomous Agents',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentMesh — APIs for Autonomous Agents',
    description:
      'Payment-as-authentication. Built for the agent economy.',
    images: ['/og-image.png'],
    creator: '@agentmesh',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#080c0a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

/* ============================================================
   ROOT LAYOUT
   ============================================================ */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${spaceMono.variable} ${syne.variable} ${lexend.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}