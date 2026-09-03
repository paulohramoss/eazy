/**
 * Matemática pura dos gráficos.
 *
 * Vive separada dos componentes de propósito: escala, arredondamento de ticks e
 * geometria de arco são exatamente onde nascem NaN, altura negativa e fatia
 * degenerada — e aqui dá para testar isso sem montar o React nem o Firestore.
 */

// Ordem fixa das categóricas, validada para daltonismo nesta sequência. Nunca
// ciclar: a 9ª série vira "Outros", porque uma cor gerada seria indistinguível
// de um slot existente.
export const SERIES = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)',
]
export const OTHER_COLOR = 'var(--chart-other)'

/**
 * Agrupa a cauda em "Outros" preservando a cor por posição de valor.
 * @param items [{ name, value }] ordenados do maior para o menor
 */
export function foldTail(items, limit, otherLabel) {
  if (items.length <= limit) {
    return items.map((it, i) => ({ ...it, color: SERIES[i] }))
  }
  const head = items.slice(0, limit).map((it, i) => ({ ...it, color: SERIES[i] }))
  const rest = items.slice(limit).reduce((s, it) => s + (it.value || 0), 0)
  return rest > 0
    ? [...head, { name: otherLabel, value: rest, color: OTHER_COLOR, isOther: true }]
    : head
}

/**
 * Ticks "redondos" cobrindo o máximo, para o eixo não terminar em 4.837.
 * Devolve o topo da escala (que as marcas usam) e os valores dos ticks.
 */
export function niceScale(max, ticks = 4) {
  if (!Number.isFinite(max) || max <= 0) return { top: 1, values: [0, 1] }

  // Arredondar o passo bruto para cima é a versão ingênua e desperdiça altura:
  // com máximo 4837 e 4 ticks ela escolhia passo 2000, topo 6000 — 24% do
  // gráfico vazio. Aqui os candidatos são avaliados e vence o que fica mais
  // perto da quantidade de ticks pedida, desempatando pelo topo mais justo.
  const raw = max / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))

  const candidates = [1, 2, 2.5, 5, 10].map(m => m * mag).filter(step => step > 0)
  const step = candidates.reduce((best, s) => {
    const score = (c) => {
      const count = Math.ceil(max / c)
      // Erro na contagem de ticks primeiro; folga sobrando como desempate.
      return Math.abs(count - ticks) * 10 + ((Math.ceil(max / c) * c) / max - 1)
    }
    return score(s) < score(best) ? s : best
  }, candidates[0])

  const top = Math.ceil(max / step) * step

  const values = []
  // O +step/2 fecha o erro de ponto flutuante que às vezes some com o último tick.
  for (let v = 0; v <= top + step / 2; v += step) values.push(Number(v.toFixed(6)))
  return { top, values }
}

// Abrevia para o eixo caber: 12.400 → 12,4k. Só no eixo — tooltip e tabela
// mostram o valor cheio, formatado na moeda do usuário.
export function shortNumber(n, locale = 'pt-BR') {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })}k`
  return v.toLocaleString(locale, { maximumFractionDigits: 0 })
}

/**
 * Ângulos de cada fatia do donut, com folga de superfície entre elas.
 * A folga separa sem desenhar contorno — contorno em volta de marca é ruído.
 */
export function donutArcs(slices, gap = 0.018) {
  const total = slices.reduce((s, d) => s + (d.value || 0), 0)
  if (total <= 0) return []

  return slices.reduce((acc, s) => {
    const start = acc.length ? acc[acc.length - 1].rawEnd : 0
    const rawEnd = start + ((s.value || 0) / total) * Math.PI * 2
    acc.push({
      ...s,
      rawEnd,
      start: start + gap / 2,
      // A folga nunca pode inverter a fatia: numa fatia menor que o gap, o fim
      // encosta no início em vez de ficar antes dele.
      end: Math.max(rawEnd - gap / 2, start + gap / 2),
    })
    return acc
  }, [])
}

/** Path SVG de um anel entre dois ângulos (0 = topo, sentido horário). */
export function arcPath(startAngle, endAngle, { cx, cy, rOuter, rInner }) {
  const full = endAngle - startAngle >= Math.PI * 2 - 0.0001
  if (full) {
    // Fatia única: dois círculos completos, senão o arco degenera num ponto.
    return `M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx - 0.01} ${cy - rOuter} `
         + `M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 1 0 ${cx - 0.01} ${cy - rInner} Z`
  }

  const at = (angle, r) => [cx + r * Math.sin(angle), cy - r * Math.cos(angle)]
  const [x1, y1] = at(startAngle, rOuter)
  const [x2, y2] = at(endAngle, rOuter)
  const [x3, y3] = at(endAngle, rInner)
  const [x4, y4] = at(startAngle, rInner)
  const large = endAngle - startAngle > Math.PI ? 1 : 0

  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} `
       + `L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`
}
