// Ilustrações do onboarding em SVG inline: herdam as cores do tema (claro e
// escuro) pelas variáveis CSS, e não pesam um PNG por tela.

export function WalletPlantArt({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 240 200" aria-hidden="true">
      <ellipse cx="120" cy="184" rx="96" ry="10" fill="var(--onb-art-shadow)" />
      {/* Plantinha crescendo da carteira: dinheiro que rende */}
      <path d="M150 92 C150 62 150 48 150 34" stroke="var(--onb-art-leaf)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M150 58 C128 56 116 40 118 24 C138 24 150 40 150 58Z" fill="var(--onb-art-leaf)" />
      <path d="M150 46 C168 40 182 24 178 8 C160 10 148 26 150 46Z" fill="var(--onb-art-leaf-2)" />
      {/* Cédula saindo da carteira */}
      <rect x="62" y="70" width="96" height="44" rx="6" fill="var(--onb-art-note)" transform="rotate(-8 110 92)" />
      {/* Carteira */}
      <rect x="40" y="92" width="150" height="88" rx="18" fill="var(--accent)" />
      <rect x="40" y="92" width="150" height="26" rx="13" fill="var(--onb-art-wallet-top)" />
      <rect x="146" y="122" width="56" height="34" rx="12" fill="var(--onb-art-wallet-flap)" />
      <circle cx="164" cy="139" r="6" fill="var(--onb-art-note)" />
      <path d="M52 168 h126" stroke="rgba(255,255,255,.28)" strokeWidth="3" strokeDasharray="6 7" strokeLinecap="round" />
      {/* Moedas */}
      <g fill="var(--onb-art-coin)" stroke="var(--onb-art-coin-edge)" strokeWidth="2">
        <ellipse cx="206" cy="176" rx="20" ry="7" />
        <ellipse cx="206" cy="168" rx="20" ry="7" />
        <ellipse cx="206" cy="160" rx="20" ry="7" />
      </g>
    </svg>
  )
}

export function SummitArt({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 160 110" aria-hidden="true">
      <path d="M8 104 L64 40 L84 62 L104 38 L152 104Z" fill="var(--accent)" />
      <path d="M64 40 L76 54 L68 58 L60 50Z" fill="rgba(255,255,255,.35)" />
      <path d="M104 38 V8" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
      <path d="M104 8 L128 15 L104 22Z" fill="var(--onb-art-leaf)" />
      <g stroke="var(--onb-art-leaf)" strokeWidth="3" strokeLinecap="round">
        <path d="M78 18 l6 6" /><path d="M72 30 h8" /><path d="M88 10 v8" />
      </g>
    </svg>
  )
}
