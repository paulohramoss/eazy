// split — divisão de conta entre amigos.
//
// Modelo, e é a decisão que sustenta o resto: `amount` continua sendo o valor
// CHEIO que saiu da carteira. Quem pagou a conta de R$ 120 perdeu R$ 120 de
// verdade — guardar só a própria parte mentiria sobre o saldo, que é o número
// que o app existe para acertar.
//
// O que os outros devem é um recebível derivado daqui. Quando alguém paga de
// volta, nasce uma receita normal: o dinheiro voltando é um evento tão real
// quanto a saída, e assim ele aparece no extrato como qualquer outro.
//
// Consequência assumida: enquanto não há acerto, a categoria mostra os R$ 120.
// É o que de fato foi gasto naquele mês. `ownShare` existe para quem quer ver
// o próprio custo.

/**
 * Divide um total em N partes iguais cuja soma bate exatamente com o total.
 *
 * Mesma disciplina de installments.js e pelo mesmo motivo: R$ 100 entre 3 não
 * dá 33,33 três vezes, e uma sobra de centavo não conciliada vira discussão
 * com amigo — que é pior que erro de planilha.
 *
 * @param {number} total
 * @param {number} people  número de pessoas, incluindo quem pagou
 * @returns {number[]}     `people` valores, a sobra na primeira parte
 */
export function splitEqually(total, people) {
  const n = Math.max(1, Math.trunc(Number(people) || 1))
  const totalCents = Math.round((Number(total) || 0) * 100)
  const base = Math.trunc(totalCents / n)
  const remainder = totalCents - base * n

  // A sobra fica com quem pagou (a primeira parte): cobrar um centavo a mais
  // de um amigo é exatamente o tipo de detalhe que ninguém quer explicar.
  return Array.from({ length: n }, (_, i) =>
    ((base + (i === 0 ? remainder : 0)) / 100))
}

const participantsOf = (split) => Array.isArray(split?.participants) ? split.participants : []

/** Soma do que foi atribuído a outras pessoas. */
export function othersTotal(split) {
  return participantsOf(split)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
}

/** O custo que é de fato seu: o total menos a parte dos outros. */
export function ownShare(amount, split) {
  const own = (Number(amount) || 0) - othersTotal(split)
  return Math.round(own * 100) / 100
}

/** O que ainda não voltou para o seu bolso nesta transação. */
export function pendingTotal(split) {
  return participantsOf(split)
    .filter(p => !p.settled)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
}

/**
 * Monta a divisão igual entre você e `names`, pronta para gravar.
 * Você não entra em `participants` — sua parte é o resto.
 */
export function buildEqualSplit(total, names = []) {
  const clean = names.map(n => String(n).trim()).filter(Boolean)
  if (!clean.length) return null

  // +1 porque quem paga também come.
  const shares = splitEqually(total, clean.length + 1)
  return {
    participants: clean.map((name, i) => ({
      name,
      amount: shares[i + 1],
      settled: false,
    })),
  }
}

/**
 * Tudo que ainda está para receber, somado por pessoa.
 *
 * @returns {{total:number, people:{name:string, amount:number, count:number}[]}}
 */
export function receivables(transactions = []) {
  const byPerson = new Map()
  let total = 0

  for (const tx of transactions) {
    if (tx?.status === 'failed') continue
    for (const p of participantsOf(tx.split)) {
      if (p.settled) continue
      const amount = Number(p.amount) || 0
      if (amount <= 0) continue

      const name = String(p.name || '').trim()
      if (!name) continue

      total += amount
      const entry = byPerson.get(name)
      if (entry) { entry.amount += amount; entry.count += 1 }
      else byPerson.set(name, { name, amount, count: 1 })
    }
  }

  return {
    total: Math.round(total * 100) / 100,
    people: [...byPerson.values()]
      .map(p => ({ ...p, amount: Math.round(p.amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
  }
}

/** Marca um participante como acertado, sem mutar o original. */
export function settleParticipant(split, name) {
  return {
    ...split,
    participants: participantsOf(split).map(p =>
      p.name === name ? { ...p, settled: true } : p),
  }
}
