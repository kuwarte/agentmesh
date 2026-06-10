import type { Metadata, Viewport } from 'next'
import { Space_Mono, Syne, Lexend } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

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

export const metadata: Metadata = {
  title: {
    default: 'AgentMesh — APIs for Autonomous Agents',
    template: '%s | AgentMesh',
  },
  description:
    'Discover, pay, and access APIs instantly. No accounts or API keys required.',
  authors: [{ name: 'AgentMesh' }],
  creator: 'AgentMesh',
  metadataBase: new URL('https://agentmesh.xyz'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://agentmesh.xyz',
    siteName: 'AgentMesh',
    title: 'AgentMesh — APIs for Autonomous Agents',
    description: 'Payment-as-authentication. Built for the agent economy.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AgentMesh' }],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#080c0a',
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
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
