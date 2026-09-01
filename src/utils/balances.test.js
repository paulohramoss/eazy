import { describe, expect, it } from 'vitest'
import { dailyBalances, walletStats } from './balances.js'

const wallets = [
  { id: 'w1', balance: 1000 },
  { id: 'w2', balance: 500 },
]

const txs = [
  { walletId: 'w1', type: 'income',  amount: 200, date: '2026-01-10' },
  { walletId: 'w1', type: 'expense', amount: 50,  date: '2026-01-12' },
  { walletId: 'w2', type: 'expense', amount: 100, date: '2026-01-15' },
  // Futura: só entra na projeção, não no saldo de hoje.
  { walletId: 'w1', type: 'expense', amount: 300, date: '2026-02-20' },
]

describe('walletStats', () => {
  it('soma receitas e subtrai despesas a partir do saldo inicial', () => {
    const stats = walletStats(wallets, txs, '2026-01-31')
    expect(stats.w1).toEqual({ balance: 1150, income: 200, expenses: 50 })
    expect(stats.w2).toEqual({ balance: 400, income: 0, expenses: 100 })
  })

  it('o corte exclui transações futuras', () => {
    // O ponto do corte: sem ele, uma parcela lançada para o mês que vem já
    // apareceria descontada do saldo de hoje.
    expect(walletStats(wallets, txs, '2026-01-31').w1.balance).toBe(1150)
    expect(walletStats(wallets, txs, '2026-02-28').w1.balance).toBe(850)
  })

  it('sem corte, projeta tudo', () => {
    expect(walletStats(wallets, txs, undefined).w1.balance).toBe(850)
  })

  it('o corte é inclusivo no próprio dia', () => {
    expect(walletStats(wallets, txs, '2026-01-10').w1.balance).toBe(1200)
    expect(walletStats(wallets, txs, '2026-01-09').w1.balance).toBe(1000)
  })

  it('ignora transação sem data quando há corte', () => {
    const semData = [...txs, { walletId: 'w1', type: 'expense', amount: 999 }]
    expect(walletStats(wallets, semData, '2026-01-31').w1.balance).toBe(1150)
  })

  it('ignora transação de outra carteira', () => {
    const outra = [{ walletId: 'inexistente', type: 'expense', amount: 999, date: '2026-01-05' }]
    expect(walletStats(wallets, outra, '2026-01-31').w1.balance).toBe(1000)
  })

  it('trata amount ausente como zero em vez de gerar NaN', () => {
    const semValor = [{ walletId: 'w1', type: 'expense', date: '2026-01-05' }]
    expect(walletStats(wallets, semValor, '2026-01-31').w1.balance).toBe(1000)
  })

  it('devolve entrada para toda carteira, mesmo sem transações', () => {
    expect(walletStats(wallets, [], '2026-01-31')).toEqual({
      w1: { balance: 1000, income: 0, expenses: 0 },
      w2: { balance: 500,  income: 0, expenses: 0 },
    })
  })
})

describe('dailyBalances', () => {
  it('parte do saldo de abertura e acumula dia a dia', () => {
    const days = dailyBalances(wallets, txs, '2026-01-09', '2026-01-16')
    expect(days['2026-01-09']).toBe(1500)   // 1000 + 500
    expect(days['2026-01-10']).toBe(1700)   // +200
    expect(days['2026-01-11']).toBe(1700)   // dia sem movimento
    expect(days['2026-01-12']).toBe(1650)   // -50
    expect(days['2026-01-15']).toBe(1550)   // -100
    expect(days['2026-01-16']).toBe(1550)
  })

  it('bate com walletStats no último dia do intervalo', () => {
    const to = '2026-01-20'
    const daily = dailyBalances(wallets, txs, '2026-01-01', to)
    const total = Object.values(walletStats(wallets, txs, to))
      .reduce((sum, st) => sum + st.balance, 0)
    expect(daily[to]).toBe(total)
  })

  it('cobre todos os dias do intervalo, inclusive as pontas', () => {
    const days = dailyBalances(wallets, txs, '2026-01-01', '2026-01-31')
    expect(Object.keys(days)).toHaveLength(31)
    expect(days['2026-01-01']).toBeDefined()
    expect(days['2026-01-31']).toBeDefined()
  })

  it('atravessa a virada de mês', () => {
    const days = dailyBalances(wallets, txs, '2026-01-30', '2026-02-02')
    expect(Object.keys(days)).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
  })
})
