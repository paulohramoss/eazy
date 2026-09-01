import { describe, expect, it } from 'vitest'
import { splitInstallments } from './installments.js'

const sum = (arr) => Math.round(arr.reduce((s, v) => s + v, 0) * 100) / 100

describe('splitInstallments', () => {
  it('divide exato quando não há sobra', () => {
    expect(splitInstallments(100, 4)).toEqual([25, 25, 25, 25])
  })

  it('coloca a sobra na primeira parcela', () => {
    // 100/3 = 33,3333... — a sobra de 1 centavo tem que ir para algum lugar.
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33])
  })

  it('a soma das parcelas é sempre igual ao total', () => {
    // A invariante que importa: se isto quebrar, o extrato não fecha.
    for (const total of [100, 99.99, 0.03, 1234.56, 0.01, 7]) {
      for (const count of [1, 2, 3, 5, 7, 12, 24]) {
        expect(sum(splitInstallments(total, count))).toBe(Math.round(total * 100) / 100)
      }
    }
  })

  it('não sofre com erro de ponto flutuante', () => {
    // 0.1 + 0.2 !== 0.3 em float; trabalhar em centavos evita o desvio.
    expect(splitInstallments(0.3, 3)).toEqual([0.1, 0.1, 0.1])
    expect(sum(splitInstallments(0.3, 3))).toBe(0.3)
  })

  it('uma parcela devolve o total', () => {
    expect(splitInstallments(99.99, 1)).toEqual([99.99])
  })

  it('trata valores centavos-a-centavos sem zerar parcelas', () => {
    expect(splitInstallments(0.03, 3)).toEqual([0.01, 0.01, 0.01])
  })

  it('protege contra count inválido', () => {
    expect(splitInstallments(50, 0)).toEqual([50])
    expect(splitInstallments(50, -3)).toEqual([50])
    expect(splitInstallments(50, undefined)).toEqual([50])
  })

  it('total zero ou inválido não gera NaN', () => {
    expect(splitInstallments(0, 3)).toEqual([0, 0, 0])
    expect(splitInstallments(undefined, 2)).toEqual([0, 0])
  })
})
