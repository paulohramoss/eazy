#!/usr/bin/env node
// Audita (e opcionalmente corrige) documentos que as regras novas rejeitariam.
//
// As regras passaram a validar tipo e faixa dos campos. Documentos gravados
// antes disso podem ter `amount` como string, `date` fora do ISO ou `limit`
// ausente — nesses casos a LEITURA continua funcionando, mas qualquer update
// futuro é negado, e o sintoma aparece longe da causa ("não consigo editar
// esta transação").
//
//   node scripts/audit-legacy-docs.js          # só relata
//   node scripts/audit-legacy-docs.js --fix    # corrige o que dá para corrigir
//
// Precisa de FIREBASE_SERVICE_ACCOUNT no ambiente (o Admin SDK ignora as
// regras, então roda mesmo sobre documentos que o cliente já não conseguiria
// atualizar).
import { adminDb } from '../api/_lib/firebaseAdmin.js'

const FIX = process.argv.includes('--fix')

const isMoney = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12
const isIso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isText = (v, max) => typeof v === 'string' && v.length <= max
const isDay = (v) => typeof v === 'number' && v >= 1 && v <= 31

// Tenta converter para número o que veio como texto ('1.234,56', 'R$ 99,90').
function coerceMoney(v) {
  if (isMoney(v)) return v
  if (typeof v === 'number') return Math.abs(v) <= 1e12 ? Math.abs(v) : null
  if (typeof v !== 'string') return null
  const cleaned = v.replace(/[^\d.,-]/g, '')
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const normalized = lastComma > lastDot
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : null
}

function coerceDate(v) {
  if (isIso(v)) return v
  if (typeof v !== 'string') return null
  const m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

const coerceDay = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= 31 ? Math.round(n) : null
}

// Cada checagem: [campo, obrigatório, validador, tentativa de conserto].
const SPECS = {
  transactions: [
    ['amount', true, isMoney, coerceMoney],
    ['date', true, isIso, coerceDate],
    ['type', true, v => v === 'income' || v === 'expense', null],
    ['status', false, v => ['completed', 'pending', 'failed'].includes(v), () => 'completed'],
    ['name', false, v => isText(v, 200), v => String(v ?? '').slice(0, 200)],
    ['notes', false, v => isText(v, 2000), v => String(v ?? '').slice(0, 2000)],
  ],
  wallets: [
    ['balance', false, isMoney, coerceMoney],
    ['name', false, v => isText(v, 120), v => String(v ?? '').slice(0, 120)],
  ],
  budgets: [['limit', true, isMoney, coerceMoney]],
  goals: [
    ['target', true, isMoney, coerceMoney],
    ['current', false, isMoney, coerceMoney],
    ['deadline', false, v => isIso(v) || v === '', v => coerceDate(v) ?? ''],
  ],
  investments: [
    ['quantity', false, isMoney, coerceMoney],
    ['avgPrice', false, isMoney, coerceMoney],
    ['currentPrice', false, isMoney, coerceMoney],
  ],
  creditCards: [
    ['limit', true, isMoney, coerceMoney],
    ['closingDay', false, isDay, coerceDay],
    ['dueDay', false, isDay, coerceDay],
  ],
  alerts: [['dueDate', true, isIso, coerceDate]],
  recurrences: [
    ['amount', true, isMoney, coerceMoney],
    ['startDate', true, isIso, coerceDate],
    ['nextDate', true, isIso, coerceDate],
  ],
}

async function auditCollection(name, specs) {
  const snap = await adminDb().collection(name).get()
  const problems = []

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const issues = []
    const patch = {}

    // Propriedade: sem isto o próprio dono perde acesso ao documento.
    if (!Array.isArray(data.allowedUsers) || !data.allowedUsers.length) {
      issues.push({ field: 'allowedUsers', value: data.allowedUsers, fixable: !!data.userId })
      if (data.userId) patch.allowedUsers = [data.userId]
    }
    if (!data.userId) issues.push({ field: 'userId', value: undefined, fixable: false })

    for (const [field, required, valid, coerce] of specs) {
      const present = field in data
      if (!present) {
        if (required) issues.push({ field, value: '(ausente)', fixable: false })
        continue
      }
      if (valid(data[field])) continue

      const fixed = coerce ? coerce(data[field]) : null
      const fixable = fixed !== null && fixed !== undefined
      issues.push({ field, value: JSON.stringify(data[field]), fixable })
      if (fixable) patch[field] = fixed
    }

    if (issues.length) problems.push({ id: docSnap.id, ref: docSnap.ref, issues, patch })
  }

  return { total: snap.size, problems }
}

async function main() {
  console.log(FIX ? 'Modo CORREÇÃO\n' : 'Modo somente-leitura (use --fix para corrigir)\n')

  let totalDocs = 0
  let totalProblems = 0
  let totalFixed = 0
  let totalManual = 0

  for (const [name, specs] of Object.entries(SPECS)) {
    const { total, problems } = await auditCollection(name, specs)
    totalDocs += total

    if (!problems.length) {
      console.log(`${name.padEnd(14)} ${String(total).padStart(5)} docs · ok`)
      continue
    }

    totalProblems += problems.length
    console.log(`\n${name} — ${problems.length} de ${total} documento(s) com problema:`)

    for (const p of problems) {
      const list = p.issues
        .map(i => `${i.field}=${i.value}${i.fixable ? '' : ' (manual)'}`).join(', ')
      console.log(`  ${p.id}: ${list}`)
      if (p.issues.some(i => !i.fixable)) totalManual++

      if (FIX && Object.keys(p.patch).length) {
        await p.ref.update(p.patch)
        totalFixed++
      }
    }
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`documentos verificados: ${totalDocs}`)
  console.log(`com problema:           ${totalProblems}`)
  if (FIX) console.log(`corrigidos:             ${totalFixed}`)
  if (totalManual) {
    console.log(`\n${totalManual} documento(s) precisam de decisão humana (campo obrigatório ausente`)
    console.log('ou valor sem conversão óbvia). Corrija pelo console do Firebase.')
  }
  if (!FIX && totalProblems) console.log('\nRode de novo com --fix para aplicar as correções automáticas.')

  process.exit(totalManual > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Falhou:', err.message)
  process.exit(1)
})
