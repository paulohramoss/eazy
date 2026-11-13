import { describe, expect, it } from 'vitest'
import { ASK_MAX_TX, buildAskData } from './askPayload.js'

const today = '2026-11-13'
const wallets = [{ id: 'w1', name: 'Conta', balance: 10 }]
const creditCards = [{ id: 'c1', name: 'Nubank', limit: 3000 }]

describe('buildAskData', () => {
  it('compacta, nomeia a conta e marca pendente', () => {
    const out = buildAskData({
      today, wallets, creditCards,
      walletBalances: { w1: 1500.555 },
      cardUsed: () => 420,
      transactions: [
        { date: '2026-11-02', name: 'Mercado', category: 'Alimentação', amount: 180, type: 'expense', cardId: 'c1', status: 'completed' },
        { date: '2026-11-20', name: 'Aluguel', category: 'Moradia', amount: 1200, type: 'expense', walletId: 'w1', status: 'pending' },
      ],
      budgets: [{ category: 'Alimentação', limit: 800 }],
      goals: [{ name: 'Viagem', target: 5000, current: 1200 }],
    })
    expect(out.transactions).toEqual([
      { d: '2026-11-20', n: 'Aluguel', c: 'Moradia', a: 1200, t: 'expense', s: 'pending', w: 'Conta' },
      { d: '2026-11-02', n: 'Mercado', c: 'Alimentação', a: 180, t: 'expense', w: 'Nubank' },
    ])
    expect(out.wallets).toEqual([{ name: 'Conta', balance: 1500.56 }])
    expect(out.cards).toEqual([{ name: 'Nubank', limit: 3000, used: 420 }])
    expect(out.goals[0]).toEqual({ name: 'Viagem', target: 5000, current: 1200, deadline: '' })
  })

  it('tira falhas, valores zerados e o que passou de 24 meses', () => {
    const out = buildAskData({ today, transactions: [
      { date: '2026-11-01', amount: 10, status: 'failed' },
      { date: '2026-11-01', amount: 0 },
      { date: '2024-11-30', amount: 10 },
      { date: '2024-12-01', amount: 10 },
    ] })
    expect(out.transactions.map(t => t.d)).toEqual(['2024-12-01'])
  })

  it('corta no teto ficando com os mais recentes', () => {
    const many = Array.from({ length: ASK_MAX_TX + 10 }, (_, i) => ({
      date: `2026-${String((i % 10) + 1).padStart(2, '0')}-01`, amount: 1,
    }))
    const out = buildAskData({ today, transactions: many })
    expect(out.transactions).toHaveLength(ASK_MAX_TX)
    expect(out.transactions[0].d).toBe('2026-10-01')
  })
})
