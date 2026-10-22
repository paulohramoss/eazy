// series — lançamentos que pertencem a uma série (recorrência ou parcelamento)
// e como propagar uma edição para os irmãos.
//
// Puro de propósito: decidir o que muda em cada documento é a parte que dá
// errado (parcela 3/12 virando "Notebook" sem o sufixo, salário que muda de
// dia e pula um mês), então mora aqui, com teste. O AppContext só grava.

import { addDays } from './date'

// "Notebook (3/12)" → { base: 'Notebook', index: 3, total: 12 }
const INSTALLMENT_NAME = /^(.*)\s\((\d{1,3})\/(\d{1,3})\)$/

export function parseInstallmentName(name) {
  const m = String(name || '').match(INSTALLMENT_NAME)
  if (!m) return null
  const index = Number(m[2])
  const total = Number(m[3])
  if (total < 2 || index < 1 || index > total) return null
  return { base: m[1], index, total }
}

/**
 * A qual série a transação pertence, ou null.
 * Parcelas criadas antes do installmentGroup existir são reconhecidas pelo
 * nome "Base (i/N)" junto com tipo, conta e cartão — o mesmo nome com o mesmo
 * N na mesma conta é, na prática, a mesma compra.
 */
export function seriesOf(tx) {
  if (!tx) return null
  if (tx.recurrenceId) return { kind: 'recurrence', key: `rec:${tx.recurrenceId}` }
  if (tx.installmentGroup) return { kind: 'installment', key: `inst:${tx.installmentGroup}` }
  const parsed = parseInstallmentName(tx.name)
  if (!parsed) return null
  const legacy = [tx.type, tx.walletId || '', tx.cardId || '', parsed.base.trim().toLowerCase(), parsed.total].join('|')
  return { kind: 'installment', key: `legacy:${legacy}` }
}

/** Todas as transações da mesma série (incluindo a própria), por data. */
export function seriesMembers(tx, transactions) {
  const own = seriesOf(tx)
  if (!own) return [tx]
  return transactions
    .filter(other => seriesOf(other)?.key === own.key)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.id || '').localeCompare(b.id || ''))
}

/** Quem é atingido em cada escopo: 'one' | 'future' | 'all'. */
export function membersInScope(tx, members, scope) {
  if (scope === 'all') return members
  if (scope === 'future') return members.filter(m => m.id === tx.id || (m.date || '') >= (tx.date || ''))
  return members.filter(m => m.id === tx.id)
}

// Campos que uma edição pode propagar para a série. Data e nome têm regra
// própria; split e comprovantes são de um lançamento só.
const SHARED_FIELDS = ['type', 'amount', 'category', 'walletId', 'cardId', 'status', 'notes', 'tags']

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

const daysBetween = (from, to) => {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

// Mesmo mês, outro dia: "o salário passa a cair dia 5" vale para cada mês da
// série sem empurrar nenhum para o mês seguinte. 31 vira o último dia do mês.
const withDay = (iso, day) => {
  const [y, m] = iso.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

/**
 * Patches a gravar para aplicar `edited` (o formulário salvo) à série.
 *
 * @param {object} original  transação como estava antes da edição
 * @param {object} edited    dados novos do formulário
 * @param {object[]} members seriesMembers(original, ...)
 * @param {'one'|'future'|'all'} scope
 * @param {{frequency?: string}} [opts] frequência da recorrência, se houver
 * @returns {Array<{id: string, patch: object}>}
 */
export function planSeriesEdit(original, edited, members, scope, { frequency } = {}) {
  const targets = membersInScope(original, members, scope)

  // Só o que de fato mudou se propaga: editar a observação da parcela 3 não
  // pode reescrever o valor (com centavos de arredondamento) das outras.
  const changed = SHARED_FIELDS.filter(f => f in edited && !sameValue(edited[f], original[f]))

  const origInst = parseInstallmentName(original.name)
  const editedInst = parseInstallmentName(edited.name)
  // Nome sem o "(i/N)": a pessoa pode ter apagado ou mantido o sufixo.
  const newBase = (editedInst ? editedInst.base : String(edited.name || '')).trim()
  const oldBase = origInst ? origInst.base : String(original.name || '')
  const nameChanged = newBase !== oldBase.trim()

  const dateChanged = edited.date && edited.date !== original.date
  const weekly = frequency === 'weekly'
  const shift = dateChanged ? daysBetween(original.date, edited.date) : 0
  const newDay = dateChanged ? Number(edited.date.slice(8, 10)) : null

  return targets.map(member => {
    // O lançamento editado recebe exatamente o que está no formulário.
    if (member.id === original.id) {
      const { id, ...rest } = edited
      void id
      return { id: member.id, patch: rest }
    }

    const patch = {}
    for (const f of changed) patch[f] = edited[f]

    if (nameChanged) {
      const inst = parseInstallmentName(member.name)
      patch.name = inst ? `${newBase} (${inst.index}/${inst.total})` : newBase
    }

    if (dateChanged && member.date) {
      patch.date = weekly ? addDays(member.date, shift) : withDay(member.date, newDay)
    }

    return { id: member.id, patch }
  }).filter(({ patch }) => Object.keys(patch).length)
}

/**
 * O que muda na regra de recorrência quando a edição vale para a frente, para
 * os lançamentos que o job diário ainda vai criar seguirem a mudança.
 */
export function planRecurrenceEdit(original, edited, rule) {
  const patch = {}
  for (const f of ['type', 'amount', 'category', 'walletId', 'cardId', 'status', 'notes', 'tags']) {
    if (f in edited && !sameValue(edited[f], original[f])) patch[f] = edited[f]
  }
  if (edited.name && edited.name.trim() !== String(original.name || '').trim()) patch.name = edited.name.trim()

  if (rule?.nextDate && edited.date && edited.date !== original.date) {
    patch.nextDate = rule.frequency === 'weekly'
      ? addDays(rule.nextDate, daysBetween(original.date, edited.date))
      : withDay(rule.nextDate, Number(edited.date.slice(8, 10)))
  }
  return patch
}
