export const DEFAULT_WALLET_ICON = 'fi-rr-bank'

export const WALLET_TYPE_ICONS = {
  checking: 'fi-rr-bank',
  savings: 'fi-rr-piggy-bank',
  credit: 'fi-rr-credit-card',
  investment: 'fi-rr-chart-line-up',
  cash: 'fi-rr-money-bill-wave',
}

export const WALLET_ICON_OPTIONS = [
  { icon: 'fi-rr-bank', label: 'Banco' },
  { icon: 'fi-rr-wallet', label: 'Carteira' },
  { icon: 'fi-rr-piggy-bank', label: 'Poupança' },
  { icon: 'fi-rr-chart-line-up', label: 'Investimentos' },
  { icon: 'fi-rr-credit-card', label: 'Cartão' },
  { icon: 'fi-rr-money-bill-wave', label: 'Dinheiro' },
  { icon: 'fi-rr-coins', label: 'Moedas' },
  { icon: 'fi-rr-briefcase', label: 'Trabalho' },
  { icon: 'fi-rr-home', label: 'Casa' },
  { icon: 'fi-rr-box', label: 'Outros' },
]

const LEGACY_WALLET_ICONS = {
  '\u{1F3E6}': 'fi-rr-bank',
  '\u{1F437}': 'fi-rr-piggy-bank',
  '\u{1F4C8}': 'fi-rr-chart-line-up',
  '\u{1F4B3}': 'fi-rr-credit-card',
  '\u{1F4B5}': 'fi-rr-money-bill-wave',
}

export function resolveWalletIcon(icon, type) {
  if (typeof icon === 'string' && icon.startsWith('fi-')) return icon
  return LEGACY_WALLET_ICONS[icon] || WALLET_TYPE_ICONS[type] || DEFAULT_WALLET_ICON
}
