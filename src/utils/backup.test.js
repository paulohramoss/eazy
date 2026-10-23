import { describe, expect, it } from 'vitest'
import { BACKUP_VERSION, buildBackup, parseBackup, planRestore } from './backup.js'

const ids = () => {
  let n = 0
  return () => `new${++n}`
}

const sample = () => buildBackup({
  wallets:      [{ id: 'w1', name: 'Nubank', balance: 100, userId: 'u', allowedUsers: ['u'], createdAt: { seconds: 1 } }],
  creditCards:  [{ id: 'c1', name: 'Visa', walletId: 'w1' }],
  goals:        [{ id: 'g1', name: 'Viagem', target: 5000 }],
  recurrences:  [{ id: 'r1', name: 'Aluguel', type: 'expense', amount: 1500, frequency: 'monthly', walletId: 'w1' }],
  budgets:      [{ id: 'b1', category: 'Lazer', limit: 300 }],
  investments:  [{ id: 'i1', name: 'Tesouro', ticker: 'SELIC' }],
  alerts:       [{ id: 'a1', name: 'Luz', amount: 120, dueDate: '2026-11-10' }],
  transactions: [
    { id: 't1', date: '2026-10-01', type: 'expense', amount: 1500, name: 'Aluguel', walletId: 'w1', recurrenceId: 'r1' },
    { id: 't2', date: '2026-10-05', type: 'expense', amount: 80, name: 'Mercado', cardId: 'c1' },
    { id: 't3', date: '2026-10-06', type: 'income', amount: 200, name: 'Pix', goalId: 'g1' },
  ],
  categories: ['Alimentação', 'Pets'],
  prefs: { currency: 'BRL' },
}, { exportedAt: '2026-10-23T00:00:00.000Z' })

describe('buildBackup', () => {
  it('guarda ids, todas as coleções, categorias e preferências', () => {
    const b = sample()
    expect(b.version).toBe(BACKUP_VERSION)
    expect(b.wallets[0]).toEqual({ id: 'w1', name: 'Nubank', balance: 100 })
    expect(b.alerts).toHaveLength(1)
    expect(b.recurrences).toHaveLength(1)
    expect(b.categories).toEqual(['Alimentação', 'Pets'])
    expect(b.prefs).toEqual({ currency: 'BRL' })
  })

  it('sobrevive a ida e volta em JSON', () => {
    expect(parseBackup(JSON.stringify(sample()))).toEqual(sample())
  })
})

describe('parseBackup', () => {
  it('rejeita o que não é JSON', () => {
    expect(() => parseBackup('oi')).toThrow('JSON válido')
  })

  it('rejeita JSON sem transações', () => {
    expect(() => parseBackup('{"version":"2.0"}')).toThrow('inválido')
  })
})

describe('planRestore', () => {
  it('numa conta vazia, recria tudo e refaz os vínculos com os ids novos', () => {
    const { writes, stats } = planRestore(sample(), {}, { newId: ids() })
    const byCol = (col) => writes.filter(w => w.col === col)

    const wallet = byCol('wallets')[0]
    const card   = byCol('creditCards')[0]
    const goal   = byCol('goals')[0]
    const rec    = byCol('recurrences')[0]
    const [t1, t2, t3] = byCol('transactions').map(w => w.data)

    expect(card.data.walletId).toBe(wallet.id)
    expect(rec.data.walletId).toBe(wallet.id)
    expect(t1.walletId).toBe(wallet.id)
    expect(t1.recurrenceId).toBe(rec.id)
    expect(t2.cardId).toBe(card.id)
    expect(t3.goalId).toBe(goal.id)
    expect(writes.every(w => !('id' in w.data))).toBe(true)
    expect(stats).toEqual({ imported: 3, skipped: 0 })
  })

  it('reaproveita carteira de mesmo nome e aponta as transações para ela', () => {
    const current = { wallets: [{ id: 'existing', name: ' nubank ' }] }
    const { writes } = planRestore(sample(), current, { newId: ids() })
    expect(writes.some(w => w.col === 'wallets')).toBe(false)
    expect(writes.find(w => w.col === 'transactions').data.walletId).toBe('existing')
  })

  it('pula transação repetida, a menos que a pessoa desligue a opção', () => {
    const current = { transactions: [{ id: 'x', date: '2026-10-05', type: 'expense', amount: 80, name: 'mercado' }] }
    expect(planRestore(sample(), current, { newId: ids() }).stats).toEqual({ imported: 2, skipped: 1 })
    expect(planRestore(sample(), current, { newId: ids(), skipDuplicates: false }).stats)
      .toEqual({ imported: 3, skipped: 0 })
  })

  it('restaurar duas vezes o mesmo backup não duplica nada', () => {
    const first = planRestore(sample(), {}, { newId: ids() })
    const current = {}
    for (const w of first.writes) (current[w.col] ||= []).push({ id: w.id, ...w.data })
    const second = planRestore(sample(), current, { newId: ids() })
    expect(second.writes).toEqual([])
    expect(second.stats).toEqual({ imported: 0, skipped: 3 })
  })

  it('backup 1.0 sem ids mantém as referências originais', () => {
    const v1 = { version: '1.0', transactions: [{ date: '2026-10-01', type: 'expense', amount: 10, name: 'X', walletId: 'w-old' }] }
    const { writes } = planRestore(v1, {}, { newId: ids() })
    expect(writes[0].data.walletId).toBe('w-old')
  })

  it('mescla só as categorias que faltam', () => {
    const { categories } = planRestore(sample(), { categories: ['Alimentação'] }, { newId: ids() })
    expect(categories).toEqual(['Alimentação', 'Pets'])
    expect(planRestore(sample(), { categories: ['Alimentação', 'Pets'] }, { newId: ids() }).categories).toBeNull()
  })
})
