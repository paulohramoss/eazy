import { describe, expect, it } from 'vitest'
import { analyzePeriod, bucketKeys, periodRange } from './analysis.js'

const TODAY = '2026-10-23'

describe('periodRange', () => {
  it('este mês cobre o mês inteiro', () => {
    expect(periodRange('thisMonth', TODAY)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
  })

  it('mês passado', () => {
    expect(periodRange('lastMonth', TODAY)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('mês passado em janeiro volta para dezembro do ano anterior', () => {
    expect(periodRange('lastMonth', '2026-01-15')).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })

  it('últimos 6 meses inclui o atual', () => {
    expect(periodRange('last6', TODAY)).toEqual({ start: '2026-05-01', end: '2026-10-31' })
  })

  it('últimos 12 meses atravessa o ano', () => {
    expect(periodRange('last12', TODAY)).toEqual({ start: '2025-11-01', end: '2026-10-31' })
  })

  it('este ano', () => {
    expect(periodRange('thisYear', TODAY)).toEqual({ start: '2026-01-01', end: '2026-12-31' })
  })

  it('tudo vai da primeira à última transação', () => {
    const transactions = [{ date: '2026-03-10' }, { date: '2025-07-02' }, { date: '2027-01-05' }]
    expect(periodRange('all', TODAY, { transactions })).toEqual({ start: '2025-07-02', end: '2027-01-05' })
  })

  it('tudo sem transações cai no mês atual', () => {
    expect(periodRange('all', TODAY)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
  })

  it('personalizado com datas invertidas não fica vazio', () => {
    expect(periodRange('custom', TODAY, { from: '2026-08-10', to: '2026-08-01' }))
      .toEqual({ start: '2026-08-01', end: '2026-08-10' })
  })

  it('personalizado com uma data só vira um dia', () => {
    expect(periodRange('custom', TODAY, { from: '2026-08-10' }))
      .toEqual({ start: '2026-08-10', end: '2026-08-10' })
  })
})

describe('bucketKeys', () => {
  it('até 31 dias agrupa por dia', () => {
    const { granularity, keys } = bucketKeys('2026-02-27', '2026-03-02')
    expect(granularity).toBe('day')
    expect(keys).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
  })

  it('acima disso agrupa por mês, virando o ano', () => {
    const { granularity, keys } = bucketKeys('2025-11-15', '2026-02-03')
    expect(granularity).toBe('month')
    expect(keys).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('analyzePeriod', () => {
  const txs = [
    { date: '2026-09-05', type: 'income',  amount: 1000, category: 'Salário' },
    { date: '2026-09-10', type: 'expense', amount: 200,  category: 'Lazer' },
    { date: '2026-10-02', type: 'expense', amount: 100,  category: 'Lazer' },
    { date: '2026-10-03', type: 'expense', amount: 50,   category: 'Saúde' },
    { date: '2026-10-04', type: 'expense', amount: 999,  category: 'Saúde', status: 'failed' },
    { date: '2026-08-01', type: 'expense', amount: 70,   category: 'Lazer' },
  ]

  it('só conta o recorte e ignora falhas', () => {
    const r = analyzePeriod(txs, '2026-09-01', '2026-10-31')
    expect(r.income).toBe(1000)
    expect(r.expenses).toBe(350)
    expect(r.months).toBe(2)
    expect(r.byCategory).toEqual({
      Lazer: { total: 300, count: 2 },
      Saúde: { total: 50, count: 1 },
    })
  })

  it('série mensal tem um ponto por mês, inclusive os vazios', () => {
    const r = analyzePeriod(txs, '2026-07-01', '2026-10-31')
    expect(r.granularity).toBe('month')
    expect(r.series.map(s => [s.key, s.expenses])).toEqual([
      ['2026-07', 0], ['2026-08', 70], ['2026-09', 200], ['2026-10', 150],
    ])
  })

  it('recorte curto vira série diária e conta como um mês na média', () => {
    const r = analyzePeriod(txs, '2026-10-01', '2026-10-05')
    expect(r.granularity).toBe('day')
    expect(r.series).toHaveLength(5)
    expect(r.series[1]).toEqual({ key: '2026-10-02', income: 0, expenses: 100 })
    expect(r.months).toBe(1)
  })
})
