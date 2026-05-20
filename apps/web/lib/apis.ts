// lib/apis.ts

export type ApiItem = {
  id: number
  slug: string
  category: string
  name: string
  description: string
  longDesc: string
  provider: string
  providerFull: string
  endpoint: string
  price: string
  tags: string[]
  totalCalls: string
  agentsActive: string
  settlement: string

  params: {
    name: string
    type: string
    required: string
    description: string
  }[]

  codeExample: string
  responseSchema: string
}

export const APIS: ApiItem[] = [
  {
    id: 1,
    slug: 'ip-geolocation',

    category: 'Data Feeds',

    name: 'IP Geolocation',

    description:
      'City, country, ASN and threat score for any IP address. Response under 10ms.',

    longDesc:
      'Ultra-low latency IP intelligence API optimized for autonomous agents, fraud systems, analytics pipelines, and geo-aware routing. Returns ASN, ISP, threat signals, geolocation, and network metadata.',

    provider: '0x5E6F···3E4F',

    providerFull:
      '0x5E6Fa8120fA3129B8d91B8F71C5fF1239c3E3E4F',

    endpoint:
      'https://api.agentmesh.io/v1/geo1',

    price: '0.0005',

    tags: [
      'geo',
      'security',
      'threat-intelligence',
      'ipv4',
      'ipv6',
    ],

    totalCalls: '12.4M',

    agentsActive: '3,482',

    settlement: 'Morph L2',

    params: [
      {
        name: 'ip',
        type: 'string',
        required: 'Yes',
        description: 'IPv4 or IPv6 address',
      },
      {
        name: 'threat',
        type: 'boolean',
        required: 'No',
        description: 'Include threat intelligence data',
      },
    ],

    codeExample: `fetch("https://api.agentmesh.io/v1/geo1?ip=8.8.8.8", {
  headers: {
    "x402-payment": signedPaymentHeader
  }
})
.then(res => res.json())
.then(console.log)`,

    responseSchema: `{
  "ip": "8.8.8.8",
  "country": "United States",
  "city": "Mountain View",
  "asn": "AS15169",
  "threat_score": 0.01
}`,
  },

  {
    id: 2,
    slug: 'btc-usd-price-feed',

    category: 'Crypto/DeFi',

    name: 'BTC/USD Price Feed',

    description:
      'Real-time Bitcoin spot price via Chainlink oracle. Sub-second latency, cryptographically verified.',

    longDesc:
      'Institution-grade Bitcoin pricing endpoint designed for trading agents, autonomous treasury systems, arbitrage bots, and onchain analytics platforms.',

    provider: '0x4f3A···839b',

    providerFull:
      '0x4f3A18B29d1eA84d9920AcfB12A67a0fA9d9839b',

    endpoint:
      'https://api.agentmesh.io/v1/btc-price',

    price: '0.0010',

    tags: [
      'bitcoin',
      'oracle',
      'market-data',
      'defi',
    ],

    totalCalls: '31.2M',

    agentsActive: '8,291',

    settlement: 'Morph L2',

    params: [
      {
        name: 'pair',
        type: 'string',
        required: 'Yes',
        description: 'Trading pair symbol',
      },
    ],

    codeExample: `const response = await fetch(
  "https://api.agentmesh.io/v1/btc-price?pair=BTCUSD",
  {
    headers: {
      "x402-payment": signedPaymentHeader
    }
  }
)

const data = await response.json()`,

    responseSchema: `{
  "pair": "BTCUSD",
  "price": 108421.22,
  "timestamp": 1747419201
}`,
  },

  {
    id: 3,
    slug: 'eth-usd-price-feed',

    category: 'Crypto/DeFi',

    name: 'ETH/USD Price Feed',

    description:
      'Ethereum spot price with 99.99% uptime SLA. Used by 200+ autonomous agents.',

    longDesc:
      'Reliable Ethereum spot pricing endpoint with millisecond updates and oracle-backed settlement verification.',

    provider: '0x4f3A···839b',

    providerFull:
      '0x4f3A18B29d1eA84d9920AcfB12A67a0fA9d9839b',

    endpoint:
      'https://api.agentmesh.io/v1/eth-price',

    price: '0.0010',

    tags: [
      'ethereum',
      'oracle',
      'defi',
      'market-data',
    ],

    totalCalls: '18.7M',

    agentsActive: '5,412',

    settlement: 'Morph L2',

    params: [
      {
        name: 'pair',
        type: 'string',
        required: 'Yes',
        description: 'Trading pair symbol',
      },
    ],

    codeExample: `const response = await fetch(
  "https://api.agentmesh.io/v1/eth-price?pair=ETHUSD",
  {
    headers: {
      "x402-payment": signedPaymentHeader
    }
  }
)

const data = await response.json()`,

    responseSchema: `{
  "pair": "ETHUSD",
  "price": 5122.91,
  "timestamp": 1747419201
}`,
  },

  {
    id: 4,
    slug: 'global-weather-api',

    category: 'Weather',

    name: 'Global Weather API',

    description:
      'Hourly forecast, current conditions and historical data for 50,000+ locations worldwide.',

    longDesc:
      'Global weather intelligence API optimized for logistics agents, travel systems, fleet automation, and forecasting models.',

    provider: '0x7e2F···4E5F',

    providerFull:
      '0x7e2F71B291Af28A4C2A0B4d1A7b23A0f5b7D4E5F',

    endpoint:
      'https://api.agentmesh.io/v1/weather',

    price: '0.0020',

    tags: [
      'weather',
      'forecasting',
      'temperature',
      'climate',
    ],

    totalCalls: '7.8M',

    agentsActive: '1,940',

    settlement: 'Morph L2',

    params: [
      {
        name: 'city',
        type: 'string',
        required: 'Yes',
        description: 'City name',
      },
      {
        name: 'units',
        type: 'string',
        required: 'No',
        description: 'metric or imperial',
      },
    ],

    codeExample: `fetch(
  "https://api.agentmesh.io/v1/weather?city=Tokyo",
  {
    headers: {
      "x402-payment": signedPaymentHeader
    }
  }
)
.then(r => r.json())`,

    responseSchema: `{
  "city": "Tokyo",
  "temperature": 27,
  "condition": "Cloudy",
  "humidity": 61
}`,
  },
]

export function getApiBySlug(slug: string) {
  return APIS.find((api) => api.slug === slug)
}