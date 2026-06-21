export interface NavItem {
  title: string;
  href?: string;
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  {
    title: 'What is Horizon',
    href: '/docs/what-is-horizon',
  },
  {
    title: 'How It Works',
    href: '/docs/how-it-works',
    children: [
      { title: 'Yield Tokens', href: '/docs/how-it-works/yield-tokens' },
      { title: 'AMM Mechanics', href: '/docs/how-it-works/amm-mechanics' },
    ],
  },
  {
    title: 'Getting Started',
    href: '/docs/getting-started',
  },
  {
    title: 'Guides',
    href: '/docs/guides',
    children: [
      { title: 'Earn Fixed Yield', href: '/docs/guides/earn-fixed-yield' },
      { title: 'Trade Yield', href: '/docs/guides/trade-yield' },
      { title: 'Provide Liquidity', href: '/docs/guides/provide-liquidity' },
      { title: 'Manage Positions', href: '/docs/guides/manage-positions' },
      { title: 'Analytics', href: '/docs/guides/analytics' },
    ],
  },
  {
    title: 'Mechanics',
    href: '/docs/mechanics',
    children: [
      { title: 'Pricing', href: '/docs/mechanics/pricing' },
      { title: 'APY Calculation', href: '/docs/mechanics/apy-calculation' },
      { title: 'Redemption', href: '/docs/mechanics/redemption' },
      { title: 'Flash Mint', href: '/docs/mechanics/flash-mint' },
    ],
  },
  {
    title: 'Risks',
    href: '/docs/risks',
  },
  {
    title: 'FAQ',
    href: '/docs/faq',
  },
  {
    title: 'Glossary',
    href: '/docs/glossary',
  },
  {
    title: 'Whitepaper',
    href: '/docs/whitepaper',
  },
];
