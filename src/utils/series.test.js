import { describe, expect, it } from 'vitest'
import {
  membersInScope, parseInstallmentName, planRecurrenceEdit, planSeriesEdit, seriesMembers, seriesOf,
} from './series.js'

const salary = (id, date, extra = {}) => ({
  id, date, name: 'Salário', amount: 5500, type: 'income', category: 'Salário',
  walletId: 'w1', cardId: '', status: 'pending', notes: '', tags: ['salario'], recurrenceId: 'r1', ...extra,
})

const parcel = (id, i, date, extra = {}) => ({
  id, date, name: `Notebook (${i}/3)`, amount: 1000, type: 'expense', category: 'Tecnologia',
  walletId: '', cardId: 'c1', status: 'completed', notes: '', tags: [], ...extra,
})

describe('parseInstallmentName', () => {
  it('lê o sufixo de parcela', () => {
    expect(parseInstallmentName('Notebook (3/12)')).toEqual({ base: 'Notebook', index: 3, total: 12 })
  })
  it('ignora o que não é parcela', () => {
    expect(parseInstallmentName('Notebook')).toBeNull()
    expect(parseInstallmentName('Plano (13/12)')).toBeNull()
    expect(parseInstallmentName('Algo (1/1)')).toBeNull()
  })
})

describe('seriesOf / seriesMembers', () => {
  const txs = [
    salary('s1', '2026-11-06'), salary('s2', '2026-12-06'), salary('s3', '2027-01-06'),
    parcel('p1', 1, '2026-09-10'), parcel('p2', 2, '2026-10-10'), parcel('p3', 3, '2026-11-10'),
    parcel('x1', 1, '2026-09-10', { cardId: 'outro' }),
    { id: 'solo', date: '2026-10-01', name: 'Padaria', type: 'expense', amount: 10 },
  ]

  it('recorrência agrupa pelo recurrenceId', () => {
    expect(seriesMembers(txs[1], txs).map(t => t.id)).toEqual(['s1', 's2', 's3'])
  })

  it('parcela antiga agrupa por nome, total, tipo e cartão', () => {
    expect(seriesMembers(txs[4], txs).map(t => t.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('installmentGroup vence o nome', () => {
    const a = parcel('g1', 1, '2026-01-01', { installmentGroup: 'G' })
    const b = parcel('g2', 2, '2026-02-01', { installmentGroup: 'G', name: 'Renomeado (2/3)' })
    expect(seriesMembers(a, [a, b]).map(t => t.id)).toEqual(['g1', 'g2'])
  })

  it('transação avulsa não é série', () => {
    expect(seriesOf(txs[7])).toBeNull()
    expect(seriesMembers(txs[7], txs)).toEqual([txs[7]])
  })

  it('escopos', () => {
    const members = seriesMembers(txs[1], txs)
    expect(membersInScope(txs[1], members, 'one').map(t => t.id)).toEqual(['s2'])
    expect(membersInScope(txs[1], members, 'future').map(t => t.id)).toEqual(['s2', 's3'])
    expect(membersInScope(txs[1], members, 'all').map(t => t.id)).toEqual(['s1', 's2', 's3'])
  })
})

describe('planSeriesEdit', () => {
  const members = [salary('s1', '2026-11-06'), salary('s2', '2026-12-06'), salary('s3', '2027-01-06')]

  it('só este: grava só o editado', () => {
    const plan = planSeriesEdit(members[1], { ...members[1], amount: 6000 }, members, 'one')
    expect(plan).toEqual([{ id: 's2', patch: expect.objectContaining({ amount: 6000 }) }])
  })

  it('daqui pra frente: propaga só o campo que mudou', () => {
    const plan = planSeriesEdit(members[1], { ...members[1], amount: 6000 }, members, 'future')
    expect(plan.map(p => p.id)).toEqual(['s2', 's3'])
    expect(plan[1].patch).toEqual({ amount: 6000 })
  })

  it('mudança de dia vale para o mesmo dia em cada mês', () => {
    const plan = planSeriesEdit(members[0], { ...members[0], date: '2026-11-05' }, members, 'all', { frequency: 'monthly' })
    expect(plan.map(p => p.patch.date)).toEqual(['2026-11-05', '2026-12-05', '2027-01-05'])
  })

  it('dia 31 encolhe nos meses curtos', () => {
    const ms = [salary('a', '2027-01-30'), salary('b', '2027-02-28')]
    const plan = planSeriesEdit(ms[0], { ...ms[0], date: '2027-01-31' }, ms, 'all', { frequency: 'monthly' })
    expect(plan.map(p => p.patch.date)).toEqual(['2027-01-31', '2027-02-28'])
  })

  it('recorrência semanal desloca pelo número de dias', () => {
    const ms = [salary('a', '2026-11-02'), salary('b', '2026-11-09')]
    const plan = planSeriesEdit(ms[0], { ...ms[0], date: '2026-11-04' }, ms, 'all', { frequency: 'weekly' })
    expect(plan.map(p => p.patch.date)).toEqual(['2026-11-04', '2026-11-11'])
  })

  it('renomear parcela mantém o (i/N) de cada uma', () => {
    const ps = [parcel('p1', 1, '2026-09-10'), parcel('p2', 2, '2026-10-10'), parcel('p3', 3, '2026-11-10')]
    const plan = planSeriesEdit(ps[1], { ...ps[1], name: 'Notebook Dell (2/3)' }, ps, 'all')
    expect(plan.map(p => p.patch.name)).toEqual(['Notebook Dell (1/3)', 'Notebook Dell (2/3)', 'Notebook Dell (3/3)'])
  })

  it('sem mudança em comum, os outros não são reescritos', () => {
    const plan = planSeriesEdit(members[0], { ...members[0], split: { participants: [] } }, members, 'all')
    expect(plan.map(p => p.id)).toEqual(['s1'])
  })
})

describe('planRecurrenceEdit', () => {
  it('leva valor, nome e novo dia para a regra', () => {
    const original = salary('s1', '2026-11-06')
    const patch = planRecurrenceEdit(original, { ...original, amount: 6000, name: 'Salário Empresa', date: '2026-11-05' },
      { nextDate: '2026-12-06', frequency: 'monthly' })
    expect(patch).toEqual({ amount: 6000, name: 'Salário Empresa', nextDate: '2026-12-05' })
  })
})
