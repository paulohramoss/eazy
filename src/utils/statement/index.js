// Importação de extrato: um ponto de entrada para PDF (fatura, extrato de conta,
// comprovante de Pix), OFX e CSV. Cada leitor devolve lançamentos crus com
// valor sinalizado (negativo = saída); finalizeStatement faz o que é comum a
// todos — parcelas, pagamento de fatura, estornos — e devolve o que a tela de
// revisão mostra.

import { addMonths } from '../date'
import { norm } from '../text'
import { parseCSVStatement } from '../csv'
import { decodeOFX, parseOFX } from './ofx'
import { parsePdfStatement } from './pdfStatement'

export { categorize } from './categorize'
export { PdfPasswordError } from './pdfRows'

export const ACCEPTED_FILES = '.pdf,.ofx,.qfx,.csv,.txt,application/pdf,text/csv'

// Prefixo do processador de pagamento: "DM*Spotify", "EBN*PLAYSTATI",
// "MP *VIVO", "PG *ESTRATEGIA". Não diz nada sobre o gasto e atrapalha tanto a
// leitura quanto o casamento com o histórico.
const PROCESSOR_PREFIX = /^(?:[a-z]{2,4}|paypal|pagseguro|iugu|ifd)\s?\*\s?/i

// "02/02", "PARC 03/10", "PARCELA 3 DE 10".
const INSTALLMENT = /\s*(?:\bparc(?:ela)?\.?\s*)?\b(\d{1,2})\s*(?:\/|\bde\b)\s*(\d{1,2})\b\s*/i

const PAYMENT = /pagamento|pgto|pag\.? fatura|credito de pagamento|pagto/

export function cleanName(description) {
  return description
    .replace(PROCESSOR_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function readInstallment(description) {
  const all = [...description.matchAll(new RegExp(INSTALLMENT.source, 'gi'))]
  for (let i = all.length - 1; i >= 0; i--) {
    const n = Number(all[i][1])
    const m = Number(all[i][2])
    if (n >= 1 && m >= 2 && n <= m && m <= 72) {
      return { n, m, rest: (description.slice(0, all[i].index) + ' ' + description.slice(all[i].index + all[i][0].length)).trim() }
    }
  }
  return null
}

const merchantKey = (name) => norm(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).find(w => w.length >= 3) || ''

/**
 * @param {{kind:string, entries:Array<{date,description,amount,notes,category?}>, expectedTotal?:number}} raw
 * @returns {{entries:Array<{id,date,name,amount,type,notes,skip,installment,category?}>,
 *            total:{expected:number, computed:number}|null}}
 */
export function finalizeStatement(raw) {
  const isCard = raw.kind === 'card'

  const entries = raw.entries.map((e, id) => {
    let description = e.description
    let date = e.date
    let installment = null
    let notes = e.notes || ''

    if (isCard) {
      const inst = readInstallment(description)
      if (inst) {
        installment = { n: inst.n, m: inst.m }
        description = inst.rest
        // A fatura imprime a data da compra; a parcela N cai N-1 meses depois.
        // Lançar com a data original jogaria a parcela 6/6 de abril no mês
        // errado e bagunçaria o orçamento.
        if (inst.n > 1) {
          notes = [`Compra em ${date.split('-').reverse().join('/')}`, notes].filter(Boolean).join(' · ')
          date = addMonths(date, inst.n - 1)
        }
      }
    }

    const base = cleanName(description) || 'Lançamento'
    const name = installment ? `${base} (${installment.n}/${installment.m})` : base
    const type = e.amount < 0 ? 'expense' : 'income'

    // Pagamento da fatura dentro da própria fatura é dinheiro saindo da conta,
    // não gasto do cartão — o gasto já são as compras. Importar duplicaria.
    const skip = isCard && type === 'income' && PAYMENT.test(norm(description)) ? 'payment' : null

    return {
      id: id,
      date,
      name,
      amount: Math.round(Math.abs(e.amount) * 100) / 100,
      type,
      notes,
      skip,
      installment,
      category: e.category || '',
      key: merchantKey(base),
      originalDate: e.date,
    }
  })

  if (isCard) netRefunds(entries)

  let total = null
  if (isCard && raw.expectedTotal != null) {
    const computed = entries
      .filter(e => e.skip !== 'payment')
      .reduce((s, e) => s + (e.type === 'expense' ? e.amount : -e.amount), 0)
    total = { expected: raw.expectedTotal, computed: Math.round(computed * 100) / 100 }
  }

  return { entries: entries.map(({ key, originalDate, ...e }) => { void key; void originalDate; return e }), total }
}

// Estorno na mesma fatura anula a compra: "Shopee 135,99" seguido de dois
// créditos que somam 135,99 não é gasto nenhum, e a anuidade com "desconto
// anuidade por uso" do mesmo valor também não. As duas pontas ficam fora da
// importação (marcadas, para a pessoa ver e poder reverter).
function netRefunds(entries) {
  const credits = entries.filter(e => e.type === 'income' && !e.skip)
  const remaining = new Map(entries.map(e => [e.id, e.amount]))

  for (const credit of credits) {
    const candidates = entries.filter(d =>
      d.type === 'expense' && !d.skip && remaining.get(d.id) > 0.004 &&
      d.originalDate <= credit.originalDate &&
      ((credit.key && d.key === credit.key) ||
       (d.originalDate === credit.originalDate && Math.abs(d.amount - credit.amount) < 0.005)))
    // Mesmo valor primeiro, depois o mais recente.
    candidates.sort((a, b) =>
      (Math.abs(a.amount - credit.amount) < 0.005 ? 0 : 1) - (Math.abs(b.amount - credit.amount) < 0.005 ? 0 : 1)
      || b.originalDate.localeCompare(a.originalDate))

    let left = credit.amount
    for (const debit of candidates) {
      if (left <= 0.004) break
      const take = Math.min(left, remaining.get(debit.id))
      remaining.set(debit.id, remaining.get(debit.id) - take)
      left -= take
    }
    remaining.set(credit.id, left)
  }

  for (const e of entries) {
    if (e.skip) continue
    const left = Math.round(remaining.get(e.id) * 100) / 100
    if (left <= 0) {
      e.skip = 'refunded'
    } else if (left < e.amount) {
      e.notes = [`Valor líquido de estorno (original ${e.amount.toFixed(2).replace('.', ',')})`, e.notes].filter(Boolean).join(' · ')
      e.amount = left
    }
  }
}

const sniff = async (file) => {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const text = new TextDecoder('latin1').decode(head)
  if (text.startsWith('%PDF')) return 'pdf'
  if (/OFXHEADER|<OFX>/i.test(text)) return 'ofx'
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'ofx' || ext === 'qfx') return 'ofx'
  return 'csv'
}

/**
 * Lê um arquivo de banco e devolve os lançamentos prontos para revisão.
 * Lança PdfPasswordError quando o PDF pede senha (comum: CPF do titular).
 */
export async function parseStatementFile(file, { password, today } = {}) {
  const format = await sniff(file)
  let raw

  if (format === 'pdf') {
    const { extractPdfRows } = await import('./pdfRows')
    const pages = await extractPdfRows(await file.arrayBuffer(), { password })
    raw = parsePdfStatement(pages, { today })
  } else if (format === 'ofx') {
    raw = parseOFX(decodeOFX(await file.arrayBuffer()))
  } else {
    raw = parseCSVStatement(await file.text())
  }

  if (!raw.entries.length) {
    throw new Error('Não encontrei lançamentos neste arquivo. Se for PDF, confira se é o extrato ou a fatura exportada pelo banco.')
  }

  return { format, kind: raw.kind, bank: raw.bank || '', invalid: raw.invalid || 0, ...finalizeStatement(raw) }
}
