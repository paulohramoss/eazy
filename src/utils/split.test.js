import { describe, expect, it } from 'vitest'
import {
  buildEqualSplit, othersTotal, ownShare, pendingTotal,
  receivables, settleParticipant, splitEqually,
} from './split.js'

const sum = (arr) => Math.round(arr.reduce((s, n) => s + n, 0) * 100) / 100

describe('splitEqually', () => {
  it('divisão exata', () => {
    expect(splitEqually(120, 4)).toEqual([30, 30, 30, 30])
  })

  it('a soma bate com o total mesmo com sobra de centavo', () => {
    // O caso que justifica o arquivo: 100/3 não é 33,33 três vezes.
    const parts = splitEqually(100, 3)
    expect(sum(parts)).toBe(100)
    expect(parts).toEqual([33.34, 33.33, 33.33])
  })

  it('a sobra fica com quem pagou', () => {
    const [payer, ...rest] = splitEqually(10, 3)
    expect(payer).toBeGreaterThanOrEqual(rest[0])
  })

  it('uma pessoa recebe tudo', () => {
    expect(splitEqually(75.5, 1)).toEqual([75.5])
  })

  it('centavos não derretem em ponto flutuante', () => {
    expect(sum(splitEqually(0.1, 3))).toBe(0.1)
    expect(sum(splitEqually(19.99, 7))).toBe(19.99)
  })

  it('contagem inválida não quebra', () => {
    expect(splitEqually(50, 0)).toEqual([50])
  })
})

describe('buildEqualSplit', () => {
  it('quem paga não entra na lista, mas conta na divisão', () => {
    const split = buildEqualSplit(120, ['Ana', 'Bia', 'Caio'])
    expect(split.participants).toHaveLength(3)
    // 120 entre 4 pessoas: 30 para cada um dos três, 30 sobra para quem pagou.
    expect(split.participants.map(p => p.amount)).toEqual([30, 30, 30])
  })

  it('nasce tudo em aberto', () => {
    const split = buildEqualSplit(60, ['Ana'])
    expect(split.participants.every(p => !p.settled)).toBe(true)
  })

  it('ignora nomes em branco', () => {
    const split = buildEqualSplit(100, ['Ana', '  ', ''])
    expect(split.participants.map(p => p.name)).toEqual(['Ana'])
  })

  it('sem ninguém, não há divisão', () => {
    expect(buildEqualSplit(100, [])).toBeNull()
  })
})

describe('ownShare e othersTotal', () => {
  const split = buildEqualSplit(120, ['Ana', 'Bia', 'Caio'])

  it('a parte dos outros', () => {
    expect(othersTotal(split)).toBe(90)
  })

  it('a sua parte é o resto', () => {
    expect(ownShare(120, split)).toBe(30)
  })

  it('sem divisão, a conta toda é sua', () => {
    expect(ownShare(120, null)).toBe(120)
  })

  it('acertar não muda a sua parte — só quem já pagou de volta', () => {
    // O custo real do jantar continua 30; o que mudou foi o recebível.
    const settled = settleParticipant(split, 'Ana')
    expect(ownShare(120, settled)).toBe(30)
  })
})

describe('pendingTotal', () => {
  const split = buildEqualSplit(120, ['Ana', 'Bia', 'Caio'])

  it('tudo em aberto', () => {
    expect(pendingTotal(split)).toBe(90)
  })

  it('quem acertou sai da conta', () => {
    expect(pendingTotal(settleParticipant(split, 'Ana'))).toBe(60)
  })

  it('sem divisão, nada a receber', () => {
    expect(pendingTotal(null)).toBe(0)
  })
})

describe('settleParticipant', () => {
  it('não muta o original', () => {
    const split = buildEqualSplit(60, ['Ana'])
    const next = settleParticipant(split, 'Ana')
    expect(split.participants[0].settled).toBe(false)
    expect(next.participants[0].settled).toBe(true)
  })

  it('nome desconhecido não altera nada', () => {
    const split = buildEqualSplit(60, ['Ana'])
    expect(settleParticipant(split, 'Zé').participants[0].settled).toBe(false)
  })
})

describe('receivables', () => {
  const txWith = (names, total, extra = {}) =>
    ({ amount: total, split: buildEqualSplit(total, names), ...extra })

  it('soma o que está em aberto', () => {
    const out = receivables([txWith(['Ana', 'Bia'], 90)])
    expect(out.total).toBe(60)
  })

  it('agrupa a mesma pessoa em várias contas', () => {
    const out = receivables([
      txWith(['Ana'], 60),   // Ana deve 30
      txWith(['Ana'], 100),  // Ana deve 50
    ])
    expect(out.people).toHaveLength(1)
    expect(out.people[0]).toMatchObject({ name: 'Ana', amount: 80, count: 2 })
  })

  it('ordena pelo maior devedor', () => {
    const out = receivables([txWith(['Ana'], 200), txWith(['Bia'], 20)])
    expect(out.people.map(p => p.name)).toEqual(['Ana', 'Bia'])
  })

  it('quem acertou sai da lista', () => {
    const tx = txWith(['Ana', 'Bia'], 90)
    tx.split = settleParticipant(tx.split, 'Ana')
    const out = receivables([tx])
    expect(out.total).toBe(30)
    expect(out.people.map(p => p.name)).toEqual(['Bia'])
  })

  it('transações sem divisão são ignoradas', () => {
    expect(receivables([{ amount: 50 }])).toEqual({ total: 0, people: [] })
  })

  it('transação falha não gera recebível', () => {
    expect(receivables([txWith(['Ana'], 90, { status: 'failed' })]).total).toBe(0)
  })

  it('lista vazia', () => {
    expect(receivables([])).toEqual({ total: 0, people: [] })
  })
})
