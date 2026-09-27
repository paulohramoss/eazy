import { describe, expect, it } from 'vitest'
import { buildInsights, categoryAverages, daysLeftInMonth } from './insights.js'

describe('daysLeftInMonth', () => {
  it('conta o dia de hoje', () => {
    // Dia 20 de um mês de 30: restam 20, 21...30 = 11 dias.
    expect(daysLeftInMonth('2026-09-20')).toBe(11)
  })

  it('último dia do mês devolve 1', () => {
    expect(daysLeftInMonth('2026-09-30')).toBe(1)
  })

  it('primeiro dia devolve o mês inteiro', () => {
    expect(daysLeftInMonth('2026-01-01')).toBe(31)
  })

  it('fevereiro bissexto', () => {
    expect(daysLeftInMonth('2028-02-01')).toBe(29)
  })

  it('fevereiro comum', () => {
    expect(daysLeftInMonth('2026-02-01')).toBe(28)
  })

  it('data inválida não quebra', () => {
    expect(daysLeftInMonth('')).toBe(0)
  })
})

describe('categoryAverages', () => {
  const tx = (category, date, amount) =>
    ({ category, date, amount, type: 'expense' })

  it('média por mês em que a categoria apareceu', () => {
    const avg = categoryAverages([
      tx('Alimentação', '2026-07-05', 300),
      tx('Alimentação', '2026-08-05', 500),
    ], { today: '2026-09-20' })
    expect(avg['Alimentação']).toBe(400)
  })

  it('ignora o mês corrente, que está pela metade', () => {
    const avg = categoryAverages([
      tx('Alimentação', '2026-07-05', 300),
      tx('Alimentação', '2026-08-05', 300),
      tx('Alimentação', '2026-09-02', 10),
    ], { today: '2026-09-20' })
    expect(avg['Alimentação']).toBe(300)
  })

  it('exige dois meses: um gasto isolado não é média', () => {
    const avg = categoryAverages([tx('Saúde', '2026-08-05', 900)], { today: '2026-09-20' })
    expect(avg['Saúde']).toBeUndefined()
  })

  it('soma vários lançamentos do mesmo mês', () => {
    const avg = categoryAverages([
      tx('Transporte', '2026-07-05', 100),
      tx('Transporte', '2026-07-15', 100),
      tx('Transporte', '2026-08-05', 200),
    ], { today: '2026-09-20' })
    expect(avg['Transporte']).toBe(200)
  })

  it('ignora receitas e transações falhas', () => {
    const avg = categoryAverages([
      { category: 'Salário', date: '2026-07-05', amount: 3000, type: 'income' },
      { category: 'Salário', date: '2026-08-05', amount: 3000, type: 'income' },
      { category: 'Lazer', date: '2026-07-05', amount: 100, type: 'expense', status: 'failed' },
      { category: 'Lazer', date: '2026-08-05', amount: 100, type: 'expense', status: 'failed' },
    ], { today: '2026-09-20' })
    expect(avg).toEqual({})
  })

  it('não olha além da janela', () => {
    const avg = categoryAverages([
      tx('Lazer', '2025-01-05', 100),
      tx('Lazer', '2025-02-05', 100),
    ], { today: '2026-09-20', months: 6 })
    expect(avg['Lazer']).toBeUndefined()
  })

  it('atravessa a virada do ano', () => {
    const avg = categoryAverages([
      tx('Lazer', '2025-11-05', 100),
      tx('Lazer', '2025-12-05', 300),
    ], { today: '2026-01-15' })
    expect(avg['Lazer']).toBe(200)
  })
})

describe('buildInsights', () => {
  const base = { today: '2026-09-20', monthlyIncome: 0, monthlyExpenses: 0 }

  it('sem movimento nenhum, não inventa frase', () => {
    expect(buildInsights(base)).toEqual([])
  })

  it('sobra vira valor por dia', () => {
    const [first] = buildInsights({ ...base, monthlyIncome: 1000, monthlyExpenses: 820 })
    expect(first.key).toBe('insight.perDay')
    expect(first.params.amount).toBe(180)
    expect(first.params.days).toBe(11)
    expect(first.params.perDay).toBeCloseTo(180 / 11)
    expect(first.tone).toBe('good')
  })

  it('gasto acima da receita vira aviso, não divisão', () => {
    const [first] = buildInsights({ ...base, monthlyIncome: 1000, monthlyExpenses: 1200 })
    expect(first.key).toBe('insight.over')
    expect(first.params.amount).toBe(200)
    expect(first.tone).toBe('bad')
  })

  it('empate entre receita e gasto não gera frase de sobra', () => {
    const out = buildInsights({ ...base, monthlyIncome: 1000, monthlyExpenses: 1000 })
    expect(out.map(i => i.key)).not.toContain('insight.perDay')
  })

  it('aponta a categoria acima da média', () => {
    const out = buildInsights({
      ...base,
      monthlyIncome: 2000, monthlyExpenses: 700,
      spendingByCategory: { 'Alimentação': 420 },
      averages: { 'Alimentação': 300 },
    })
    const cat = out.find(i => i.key === 'insight.categoryUp')
    expect(cat.params.category).toBe('Alimentação')
    expect(cat.params.pct).toBe(40)
  })

  it('variação pequena não vira frase', () => {
    const out = buildInsights({
      ...base,
      monthlyIncome: 2000, monthlyExpenses: 700,
      spendingByCategory: { 'Alimentação': 310 },
      averages: { 'Alimentação': 300 },
    })
    expect(out.find(i => i.key === 'insight.categoryUp')).toBeUndefined()
  })

  it('escolhe a categoria que mais destoou, e só ela', () => {
    const out = buildInsights({
      ...base,
      monthlyIncome: 3000, monthlyExpenses: 1000,
      spendingByCategory: { 'Alimentação': 400, 'Lazer': 500 },
      averages: { 'Alimentação': 300, 'Lazer': 250 },
    })
    const cats = out.filter(i => i.key === 'insight.categoryUp')
    expect(cats).toHaveLength(1)
    expect(cats[0].params.category).toBe('Lazer')
  })

  it('categoria sem média anterior é ignorada', () => {
    const out = buildInsights({
      ...base,
      monthlyIncome: 2000, monthlyExpenses: 900,
      spendingByCategory: { 'Saúde': 900 },
      averages: {},
    })
    expect(out.find(i => i.key === 'insight.categoryUp')).toBeUndefined()
  })
})
