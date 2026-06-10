'use client'

import {
  WagmiProvider,
  createConfig,
  http,
  injected,
  type CreateConnectorFn,
} from 'wagmi'
import { coinbaseWallet, walletConnect } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { morph } from '@/lib/chains'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

const connectors: CreateConnectorFn[] = [
  injected({ unstable_shimAsyncInject: 1_000 }),
  coinbaseWallet({ appName: 'AgentMesh' }),
]

if (walletConnectProjectId) {
  connectors.push(
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: true,
    }),
  )
}

const config = createConfig({
  chains: [morph],
  connectors,
  ssr: true,
  transports: {
    [morph.id]: http(morph.rpcUrls.default.http[0]),
  },
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
