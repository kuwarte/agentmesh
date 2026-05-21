import { defineChain } from 'viem'

export const morph = defineChain({
  id: 2910, // Morph mainnet = 2818 (adjust if testnet = 2910)
  name: 'Morph',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.morphl2.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MorphScan',
      url: 'https://explorer.morphl2.io',
    },
  },
})