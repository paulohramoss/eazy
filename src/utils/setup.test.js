import { describe, expect, it } from 'vitest'
import { anchoredInitialBalance, checklistItems, endOfMonth, monthlyNeeded, monthsUntil, spendableSummary } from './setup.js'

describe('metas: quanto guardar por mês', () => {
  it('conta o mês atual e o do prazo', () => {
    expect(monthsUntil('2026-11-24', '2027-06')).toBe(8)
    expect(monthsUntil('2026-11-24', '2026-11')).toBe(1)
  })

  it('prazo no passado vale um mês, nunca divide por zero', () => {
    expect(monthsUntil('2026-11-24', '2026-05')).toBe(1)
    expect(monthlyNeeded(1000, '2026-11-24', '2026-05')).toBe(1000)
  })

  it('arredonda para cima no centavo', () => {
    expect(monthlyNeeded(10000, '2026-11-24', '2027-06')).toBe(1250)
    expect(monthlyNeeded(1000, '2026-11-24', '2027-01')).toBe(333.34)
  })

  it('sem valor ou sem prazo, zero', () => {
    expect(monthlyNeeded(0, '2026-11-24', '2027-06')).toBe(0)
    expect(monthlyNeeded(500, '2026-11-24', '')).toBe(0)
  })

  it('último dia do mês, inclusive fevereiro bissexto', () => {
    expect(endOfMonth('2027-06')).toBe('2027-06-30')
    expect(endOfMonth('2028-02')).toBe('2028-02-29')
  })
})

describe('checklist dos primeiros passos', () => {
  it('marca o que já existe', () => {
    const items = checklistItems({
      wallets: [{}], creditCards: [], budgets: [{}], goals: [], monthTx: [],
      settings: { profile: { monthlyIncome: 3500 }, setup: { noCards: true } },
    })
    expect(Object.fromEntries(items.map(i => [i.id, i.done]))).toEqual({
      account: true, income: true, expenses: false, cards: true, limits: true, goal: false,
    })
  })

  it('conta nova sem nada: só a conta pendente também', () => {
    expect(checklistItems({}).every(i => !i.done)).toBe(true)
  })
})

describe('quanto ainda pode gastar', () => {
  const base = {
    totalBalance: 2000,
    today: '2026-11-24',
    transactions: [
      { type: 'expense', walletId: 'w1', amount: 300, date: '2026-11-28', status: 'pending' },   // conta a vencer
      { type: 'expense', walletId: 'w1', amount: 50, date: '2026-11-20' },                       // já saiu do saldo
      { type: 'expense', walletId: 'w1', amount: 900, date: '2026-12-05' },                      // mês que vem
      { type: 'expense', walletId: '', cardId: 'c1', amount: 120, date: '2026-11-26' },           // cartão: vai pela fatura
      { type: 'expense', walletId: 'w1', amount: 40, date: '2026-11-25', status: 'failed' },
      { type: 'income', walletId: 'w1', amount: 1000, date: '2026-11-30' },
    ],
    invoices: [400, 0],
    budgets: [{ category: 'Lazer', limit: 300 }, { category: 'Moradia', limit: 100 }],
    spendingByCategory: { Lazer: 120, Moradia: 150 },
  }

  it('desconta contas a vencer no mês e faturas abertas', () => {
    const s = spendableSummary(base)
    expect(s).toMatchObject({ balance: 2000, bills: 300, cardInvoices: 400, available: 1300, limitsLeft: 180, daysLeft: 7 })
    expect(s.perDay).toBe(185.71)
  })

  it('negativo não vira valor por dia', () => {
    expect(spendableSummary({ ...base, totalBalance: 100 })).toMatchObject({ available: -600, perDay: 0 })
  })
})

describe('âncora de saldo', () => {
  it('importar gastos não muda o saldo de hoje informado', () => {
    // informou 2.000; depois importou 500 de gastos → saldo calculado 1.500
    expect(anchoredInitialBalance({ balance: 2000 }, 1500, 2000)).toEqual({ balance: 2500 })
  })

  it('já certo: nada a gravar', () => {
    expect(anchoredInitialBalance({ balance: 2000 }, 2000, 2000)).toBeNull()
  })

  it('saldo inicial negativo não é gravado', () => {
    expect(anchoredInitialBalance({ balance: 100 }, 1000, 200)).toEqual({ negative: true })
  })
})
