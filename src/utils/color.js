// color — paleta padrão e leitura de hexadecimal do seletor de cor
// (ColorPicker.jsx). Fica fora do componente para ser testável e para o
// fast refresh do Vite, que só funciona em arquivo que exporta componente.

// Ordem do espectro, depois neutros. Os dois primeiros são o azul e o lima da
// marca, que eram as opções padrão de antes.
export const COLOR_PALETTE = [
  '#0053EF', '#CFF330',
  '#3370F5', '#0EA5E9', '#06B6D4', '#14B8A6', '#18A058', '#84CC16',
  '#FACC15', '#F59E0B', '#F97316', '#E8382A', '#EC4899', '#D946EF',
  '#8B5CF6', '#6366F1', '#92400E',
  '#BBBBBB', '#555555', '#1E1E1E', '#0A0A0A',
]

/** '#abc', 'abc', '#AABBCC', 'aabbcc' → '#AABBCC'; qualquer outra coisa → null. */
export function normalizeHex(raw) {
  let s = String(raw ?? '').trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map(c => c + c).join('')
  return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toUpperCase()}` : null
}

/** Mesma cor, ignorando caixa e a forma curta ("#fff" === "#FFFFFF"). */
export const sameColor = (a, b) => normalizeHex(a) !== null && normalizeHex(a) === normalizeHex(b)
