import { describe, expect, it } from 'vitest'
import { computeStreak, reachedMilestone } from './streak.js'

const TODAY = '2026-09-20'
const tx = (date, extra = {}) => ({ date, amount: 10, type: 'expense', ...extra })
const streak = (dates, opts) =>
  computeStreak(dates.map(d => tx(d)), { today: TODAY, ...opts })

describe('computeStreak', () => {
  it('sem transações, tudo zero', () => {
    expect(computeStreak([], { today: TODAY })).toEqual({
      current: 0, longest: 0, lastDate: null, atRisk: false,
    })
  })

  it('só hoje é sequência de 1', () => {
    expect(streak(['2026-09-20']).current).toBe(1)
  })

  it('dias consecutivos somam', () => {
    expect(streak(['2026-09-18', '2026-09-19', '2026-09-20']).current).toBe(3)
  })

  it('vários lançamentos no mesmo dia contam uma vez', () => {
    // O hábito é registrar, não gastar mais.
    const out = computeStreak(
      [tx('2026-09-20'), tx('2026-09-20'), tx('2026-09-19')],
      { today: TODAY })
    expect(out.current).toBe(2)
  })

  it('perdoa um dia pulado', () => {
    // 17, (18 vazio), 19, 20 — a sequência sobrevive, que é o ponto.
    expect(streak(['2026-09-17', '2026-09-19', '2026-09-20']).current).toBe(3)
  })

  it('dois dias pulados quebram', () => {
    expect(streak(['2026-09-16', '2026-09-19', '2026-09-20']).current).toBe(2)
  })

  it('sequência antiga não conta como corrente', () => {
    expect(streak(['2026-09-01', '2026-09-02', '2026-09-03']).current).toBe(0)
  })

  it('a maior sequência sobrevive à quebra da corrente', () => {
    const out = streak([
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
      '2026-09-19', '2026-09-20',
    ])
    expect(out.current).toBe(2)
    expect(out.longest).toBe(4)
  })

  it('lançar ontem mantém a sequência viva, marcada como em risco', () => {
    const out = streak(['2026-09-18', '2026-09-19'])
    expect(out.current).toBe(2)
    expect(out.atRisk).toBe(true)
  })

  it('lançou hoje, não está em risco', () => {
    expect(streak(['2026-09-19', '2026-09-20']).atRisk).toBe(false)
  })

  it('data futura é ignorada', () => {
    // Uma parcela lançada para o mês que vem não constrói hábito hoje.
    expect(streak(['2026-09-20', '2026-12-01']).current).toBe(1)
  })

  it('transação falha não conta como dia registrado', () => {
    // Só a de ontem vale: hoje some da sequência e ela fica em risco, em vez
    // de contar 2 por causa de um lançamento que não existiu de fato.
    const out = computeStreak(
      [tx('2026-09-20', { status: 'failed' }), tx('2026-09-19')],
      { today: TODAY })
    expect(out.current).toBe(1)
    expect(out.lastDate).toBe('2026-09-19')
    expect(out.atRisk).toBe(true)
  })

  it('atravessa a virada do mês', () => {
    const out = computeStreak(
      ['2026-08-30', '2026-08-31', '2026-09-01'].map(d => tx(d)),
      { today: '2026-09-01' })
    expect(out.current).toBe(3)
  })

  it('grace zero exige dias realmente consecutivos', () => {
    expect(streak(['2026-09-17', '2026-09-19', '2026-09-20'], { grace: 0 }).current).toBe(2)
  })

  it('devolve a data do último registro', () => {
    expect(streak(['2026-09-14', '2026-09-19']).lastDate).toBe('2026-09-19')
  })
})

describe('reachedMilestone', () => {
  it('reconhece os marcos', () => {
    expect(reachedMilestone(7)).toBe(7)
    expect(reachedMilestone(30)).toBe(30)
  })

  it('número fora da lista não é marco', () => {
    expect(reachedMilestone(8)).toBeNull()
    expect(reachedMilestone(0)).toBeNull()
  })
})
