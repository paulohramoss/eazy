import { describe, expect, it } from 'vitest'
import {
  arcPath, donutArcs, foldTail, niceScale, OTHER_COLOR, SERIES, shortNumber,
} from './geometry.js'

const finite = (path) => !/NaN|Infinity|undefined/.test(path)

describe('niceScale', () => {
  it('arredonda o topo para um valor legível', () => {
    // O ponto do arredondamento: um eixo que termina em 4.837 não ajuda ninguém.
    expect(niceScale(4837).top).toBe(5000)
    expect(niceScale(87).top).toBe(100)
    expect(niceScale(123456).top).toBe(125000)
  })

  it('não desperdiça altura do gráfico', () => {
    // A versão ingênua (arredondar o passo bruto para cima) topava 4837 em
    // 6000: um quarto do gráfico vazio. O topo deve ficar perto do máximo.
    for (const max of [4837, 87, 1.4, 7, 123456, 0.42, 5000]) {
      expect(niceScale(max).top / max).toBeLessThanOrEqual(1.3)
    }
  })

  it('produz uma quantidade de ticks utilizável', () => {
    for (const max of [4837, 87, 1.4, 7, 123456, 0.42]) {
      const n = niceScale(max).values.length
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(8)
    }
  })

  it('o topo sempre cobre o máximo', () => {
    for (const max of [1, 7, 99, 100, 101, 4837, 123456, 0.42]) {
      expect(niceScale(max).top).toBeGreaterThanOrEqual(max)
    }
  })

  it('os ticks começam em zero e chegam ao topo', () => {
    const { top, values } = niceScale(4837)
    expect(values[0]).toBe(0)
    expect(values[values.length - 1]).toBe(top)
  })

  it('os ticks são igualmente espaçados', () => {
    const { values } = niceScale(87)
    const steps = values.slice(1).map((v, i) => v - values[i])
    expect(new Set(steps.map(s => s.toFixed(6))).size).toBe(1)
  })

  it('não gera NaN para entradas degeneradas', () => {
    // Carteira zerada, primeiro mês do usuário: max = 0.
    for (const bad of [0, -5, NaN, Infinity, undefined, null]) {
      const { top, values } = niceScale(bad)
      expect(Number.isFinite(top)).toBe(true)
      expect(top).toBeGreaterThan(0)
      expect(values.every(Number.isFinite)).toBe(true)
    }
  })
})

describe('shortNumber', () => {
  it('abrevia milhares e milhões', () => {
    expect(shortNumber(12400, 'pt-BR')).toBe('12,4k')
    expect(shortNumber(2_500_000, 'pt-BR')).toBe('2,5M')
  })

  it('mantém valores pequenos inteiros', () => {
    expect(shortNumber(0, 'pt-BR')).toBe('0')
    expect(shortNumber(842, 'pt-BR')).toBe('842')
  })

  it('respeita o locale', () => {
    expect(shortNumber(12400, 'en-US')).toBe('12.4k')
  })

  it('trata negativo e lixo', () => {
    expect(shortNumber(-3200, 'en-US')).toBe('-3.2k')
    expect(shortNumber(undefined, 'pt-BR')).toBe('0')
  })
})

describe('foldTail', () => {
  const items = Array.from({ length: 9 }, (_, i) => ({ name: `c${i}`, value: 10 - i }))

  it('não agrupa quando cabe no limite', () => {
    const out = foldTail(items.slice(0, 4), 5, 'Outros')
    expect(out).toHaveLength(4)
    expect(out.some(s => s.isOther)).toBe(false)
  })

  it('agrupa a cauda numa fatia "Outros"', () => {
    const out = foldTail(items, 5, 'Outros')
    expect(out).toHaveLength(6)
    expect(out[5]).toMatchObject({ name: 'Outros', isOther: true, color: OTHER_COLOR })
  })

  it('o total é preservado ao agrupar', () => {
    // Se a soma mudar, o número do centro do donut deixa de bater com o mês.
    const before = items.reduce((s, i) => s + i.value, 0)
    const after = foldTail(items, 5, 'Outros').reduce((s, i) => s + i.value, 0)
    expect(after).toBe(before)
  })

  it('atribui cor por posição, na ordem fixa', () => {
    // A cor segue a entidade pela ordem de valor; nunca é ciclada.
    const out = foldTail(items, 5, 'Outros')
    expect(out.slice(0, 5).map(s => s.color)).toEqual(SERIES.slice(0, 5))
  })

  it('não cria "Outros" vazio', () => {
    const zeros = [...items.slice(0, 5), { name: 'z', value: 0 }]
    expect(foldTail(zeros, 5, 'Outros').some(s => s.isOther)).toBe(false)
  })
})

describe('donutArcs', () => {
  it('as fatias cobrem a volta inteira', () => {
    const arcs = donutArcs([{ value: 1 }, { value: 2 }, { value: 3 }])
    expect(arcs[arcs.length - 1].rawEnd).toBeCloseTo(Math.PI * 2, 6)
  })

  it('cada fatia começa onde a anterior terminou', () => {
    const arcs = donutArcs([{ value: 5 }, { value: 3 }, { value: 2 }])
    arcs.slice(1).forEach((a, i) => {
      expect(a.start).toBeGreaterThanOrEqual(arcs[i].end)
    })
  })

  it('a folga nunca inverte uma fatia minúscula', () => {
    // Uma fatia menor que o gap não pode terminar antes de começar.
    const arcs = donutArcs([{ value: 1000 }, { value: 0.0001 }])
    arcs.forEach(a => expect(a.end).toBeGreaterThanOrEqual(a.start))
  })

  it('devolve vazio quando não há valor', () => {
    expect(donutArcs([])).toEqual([])
    expect(donutArcs([{ value: 0 }, { value: 0 }])).toEqual([])
  })
})

describe('arcPath', () => {
  const GEO = { cx: 75, cy: 75, rOuter: 62, rInner: 42 }

  it('gera coordenadas finitas', () => {
    const arcs = donutArcs([{ value: 3 }, { value: 2 }, { value: 1 }])
    arcs.forEach(a => expect(finite(arcPath(a.start, a.end, GEO))).toBe(true))
  })

  it('fatia única vira dois círculos completos, não um ponto', () => {
    // Com uma categoria só, um arco normal degenera: início e fim coincidem.
    const [only] = donutArcs([{ value: 1 }], 0)
    const path = arcPath(only.start, only.end, GEO)
    expect(finite(path)).toBe(true)
    expect((path.match(/A /g) || []).length).toBe(2)
  })

  it('marca o arco maior quando a fatia passa de meia volta', () => {
    const big = arcPath(0, Math.PI * 1.5, GEO)
    const small = arcPath(0, Math.PI * 0.5, GEO)
    expect(big).toMatch(/0 1 1/)
    expect(small).toMatch(/0 0 1/)
  })

  it('começa no topo do círculo', () => {
    // Ângulo 0 = meio-dia; um donut que começa às 3h desorienta a leitura.
    const path = arcPath(0, Math.PI / 2, GEO)
    expect(path.startsWith(`M ${GEO.cx} ${GEO.cy - GEO.rOuter}`)).toBe(true)
  })
})
