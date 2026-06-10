import { defineChain } from 'viem'

export const morph = defineChain({
  id: 2910,
  name: 'Morph Hoodi',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-hoodi.morphl2.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Morph Hoodi Explorer',
      url: 'https://explorer-hoodi.morphl2.io',
    },
  },
  testnet: true,
})
