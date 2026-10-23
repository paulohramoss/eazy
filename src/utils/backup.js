// Backup do app (JSON) e o plano de restauração.
//
// O backup 1.0 tirava o id de cada documento. Como as transações apontam para
// carteira, cartão, meta e recorrência pelo id, restaurar numa conta nova (ou
// depois de apagar uma carteira) deixava tudo apontando para ids que não
// existem mais: saldo e fatura saíam errados sem aviso. O 2.0 guarda os ids e
// a restauração troca cada referência pelo id novo.

export const BACKUP_VERSION = '2.0'

// Coleções na ordem em que são restauradas: quem é referenciado vem antes de
// quem referencia, para o mapa de ids já estar pronto.
export const BACKUP_COLLECTIONS = [
  'wallets', 'creditCards', 'goals', 'recurrences',
  'budgets', 'investments', 'alerts', 'transactions',
]

// Campo → coleção para onde ele aponta.
const REFS = {
  walletId:     'wallets',
  cardId:       'creditCards',
  goalId:       'goals',
  recurrenceId: 'recurrences',
}

// Dono e carimbo são da conta que exportou; quem restaura grava os próprios.
const strip = ({ userId, allowedUsers, createdAt, ...rest }) => rest

export function buildBackup(data, { exportedAt = new Date().toISOString() } = {}) {
  const out = { version: BACKUP_VERSION, exportedAt }
  for (const col of BACKUP_COLLECTIONS) out[col] = (data[col] || []).map(strip)
  out.categories = data.categories || []
  out.prefs = data.prefs || {}
  return out
}

const norm = (s) => String(s ?? '').trim().toLowerCase()
const money = (n) => Number(n || 0).toFixed(2)

// Quando dois documentos são "o mesmo" para não duplicar na restauração.
// Carteira, cartão e meta pelo nome; o resto pela combinação que a pessoa
// enxergaria como repetida na tela.
export const SIGNATURES = {
  wallets:      (w) => norm(w.name),
  creditCards:  (c) => norm(c.name),
  goals:        (g) => norm(g.name),
  budgets:      (b) => norm(b.category),
  investments:  (i) => [norm(i.name), norm(i.ticker)].join('|'),
  recurrences:  (r) => [norm(r.name), r.type, money(r.amount), r.frequency].join('|'),
  alerts:       (a) => [norm(a.name || a.title), money(a.amount), a.dueDate].join('|'),
  transactions: (tx) => [tx.date, tx.type, money(tx.amount), norm(tx.name)].join('|'),
}

export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Arquivo não é um JSON válido')
  }
  if (!data || !data.version || !Array.isArray(data.transactions)) {
    throw new Error('Arquivo inválido ou corrompido')
  }
  return data
}

/**
 * Decide o que gravar. Puro: não toca no Firestore.
 *
 * current: { wallets: [...], ... } com os documentos que já existem (com id).
 * newId:   gera um id de documento novo.
 *
 * Devolve { writes: [{ col, id, data }], categories, stats }. `categories` é a
 * lista mesclada quando o backup traz alguma categoria nova, senão null.
 */
export function planRestore(backup, current, { newId, skipDuplicates = true } = {}) {
  const idMap = Object.fromEntries(Object.values(REFS).map(col => [col, new Map()]))
  const writes = []
  const stats = { imported: 0, skipped: 0 }

  // Id antigo sem correspondência fica como está: num backup 1.0 da mesma
  // conta, a carteira ainda existe com aquele id.
  const remap = (doc) => {
    const out = { ...doc }
    for (const [field, col] of Object.entries(REFS)) {
      if (out[field] && idMap[col].has(out[field])) out[field] = idMap[col].get(out[field])
    }
    return out
  }

  for (const col of BACKUP_COLLECTIONS) {
    const sig = SIGNATURES[col]
    const existing = new Map((current[col] || []).map(d => [sig(d), d.id]))
    // Transação repetida é opcional pular (o usuário escolhe na tela); as
    // demais coleções sempre reaproveitam o que já existe, para a lista não
    // encher de cópias a cada restauração.
    const dedupe = col !== 'transactions' || skipDuplicates

    for (const raw of backup[col] || []) {
      const { id: oldId, ...doc } = strip(raw)
      const key = sig(doc)
      const match = dedupe ? existing.get(key) : undefined

      if (match !== undefined) {
        if (oldId && idMap[col]) idMap[col].set(oldId, match)
        if (col === 'transactions') stats.skipped++
        continue
      }

      const id = newId()
      if (oldId && idMap[col]) idMap[col].set(oldId, id)
      // Marca dentro do próprio lote também: um backup pode trazer duplicatas.
      if (dedupe) existing.set(key, id)
      writes.push({ col, id, data: remap(doc) })
      if (col === 'transactions') stats.imported++
    }
  }

  const have = new Set(current.categories || [])
  const extra = (backup.categories || []).filter(c => typeof c === 'string' && c && !have.has(c))
  const categories = extra.length ? [...(current.categories || []), ...extra] : null

  return { writes, categories, stats }
}
