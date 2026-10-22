// pdfStatement — transforma o texto posicionado de um PDF de banco (fatura de
// cartão, extrato de conta ou comprovante de Pix) em lançamentos.
//
// Puro: recebe as linhas já extraídas (pdfRows.js faz a parte do pdf.js) para
// poder ser testado com o layout de um PDF real sem navegador.
//
// Formato de entrada: [{ rows: [{ y, cells: [{ x, w, str }] }] }] por página,
// linhas de cima para baixo. y cresce para cima (sistema do PDF).
//
// O que torna fatura difícil não é achar data e valor, é a descrição quebrada:
//
//   MERCADO*MERCADOLIVRE 02/02          ← meia linha acima
//   26/07                      271,80   ← data e valor centralizados
//   DIADEMA                             ← meia linha abaixo
//
// e a compra internacional, cujo valor só aparece duas linhas depois da data.
// O parser anda linha a linha e usa a distância vertical para decidir se um
// texto solto pertence ao lançamento de cima ou ao de baixo.

import { addDays } from '../date'
import { norm } from '../text'

const MONTHS = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 }

// Data no começo da linha: "26/07", "26/07/2026", "26/07/26" ou "05 SET".
const DATE_START = /^(\d{2})[/.](\d{2})(?:[/.](\d{2,4}))?(?=\s|$)|^(\d{2})\s(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i

// Célula que é só um valor: "271,80", "-3.455,36", "R$ 1.234,56", "12,50 D".
const AMOUNT_CELL = /^(?:-\s*)?(?:R\$\s*)?(?:-\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?:\s*-|\s*[CD])?$/i

const FULL_DATE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g

const rowText = (row) => row.cells.map(c => c.str).join(' ').replace(/\s+/g, ' ').trim()

const center = (cell) => cell.x + (cell.w || 0) / 2

// "-1.234,56", "1.234,56-", "1.234,56 D" → número com sinal pelo que está
// escrito. "D"/"C" só têm sentido em extrato de conta; a decisão final do
// sinal fica com quem chama, que sabe o tipo de documento.
export function cellAmount(str) {
  const s = String(str).trim()
  const digits = s.replace(/[^\d,]/g, '').replace(',', '.')
  const n = Number(digits)
  if (!Number.isFinite(n)) return null
  const negative = /-/.test(s) || /\sD$|\dD$/i.test(s)
  return negative ? -n : n
}

const isoFrom = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// Fatura traz "26/07" sem ano. O ano vem da data mais recente impressa no
// documento (emissão ou vencimento): compra nunca é depois dela, então um
// "15/12" numa fatura de janeiro é do ano anterior.
function resolveDate(match, ref) {
  let day, month, year
  if (match[1]) {
    day = Number(match[1]); month = Number(match[2])
    year = match[3] ? Number(match[3]) : null
    if (year != null && year < 100) year += 2000
  } else {
    day = Number(match[4]); month = MONTHS[match[5].toLowerCase()]
    year = null
  }
  if (!month || month > 12 || !day || day > 31) return null
  if (year != null) return isoFrom(year, month, day)

  const refYear = Number(ref.slice(0, 4))
  const iso = isoFrom(refYear, month, day)
  return iso > addDays(ref, 31) ? isoFrom(refYear - 1, month, day) : iso
}

function detectKind(text) {
  const t = norm(text)
  if (/comprovante/.test(t) && /\bpix\b/.test(t)) return 'pix'
  if (/fatura|cartao de credito|limite disponivel|pagamento minimo/.test(t)) return 'card'
  return 'account'
}

function detectBank(text) {
  const t = norm(text)
  const banks = [
    ['sicoob', 'Sicoob'], ['sicredi', 'Sicredi'], ['nubank', 'Nubank'], ['nu pagamentos', 'Nubank'],
    ['itau', 'Itaú'], ['bradesco', 'Bradesco'], ['santander', 'Santander'], ['caixa economica', 'Caixa'],
    ['banco do brasil', 'Banco do Brasil'], ['banco inter', 'Inter'], ['c6 bank', 'C6 Bank'],
    ['picpay', 'PicPay'], ['mercado pago', 'Mercado Pago'], ['btg', 'BTG'], ['original', 'Original'],
  ]
  return banks.find(([needle]) => t.includes(needle))?.[1] || ''
}

// Cabeçalho de tabela com posições das colunas, para escolher o valor certo
// quando a linha tem mais de um número (valor e saldo, débito e crédito).
function findColumns(rows) {
  for (const row of rows) {
    const cols = {}
    for (const cell of row.cells) {
      const s = norm(cell.str).trim()
      if (/^valor\b/.test(s)) cols.valor = center(cell)
      else if (/^saldo\b/.test(s)) cols.saldo = center(cell)
      else if (/^(debito|debitos|saida|saidas)\b/.test(s)) cols.debito = center(cell)
      else if (/^(credito|creditos|entrada|entradas)\b/.test(s)) cols.credito = center(cell)
    }
    if (Object.keys(cols).length >= 2) return cols
  }
  return null
}

function pickAmount(amountCells, { kind, columns }) {
  if (!amountCells.length) return null

  if (columns) {
    // Cada número vai para a coluna mais próxima; o que cai em "saldo" é o
    // saldo do dia, não lançamento.
    const usable = amountCells
      .map(cell => {
        const nearest = Object.entries(columns)
          .map(([col, x]) => ({ col, dist: Math.abs(center(cell) - x) }))
          .sort((a, b) => a.dist - b.dist)[0]
        return { cell, col: nearest.col }
      })
      .filter(({ col }) => col !== 'saldo')
    if (!usable.length) return null
    const { cell, col } = usable[0]
    const value = cellAmount(cell.str)
    if (value == null) return null
    if (col === 'debito') return -Math.abs(value)
    if (col === 'credito') return Math.abs(value)
    return value
  }

  // Sem cabeçalho: fatura tem um valor por linha (o último); extrato com dois
  // números costuma ser "valor saldo", então vale o primeiro.
  const cell = kind === 'card' || amountCells.length === 1
    ? amountCells[amountCells.length - 1]
    : amountCells[0]
  return cellAmount(cell.str)
}

// Linhas de extrato que não são lançamento, mesmo com data e valor.
const NOT_A_TRANSACTION = /^(saldo|s a l d o|total|subtotal|limite)\b|saldo (anterior|do dia|final|em conta|disponivel|bloqueado)/

function parseTable(pages, { kind, ref }) {
  const entries = []
  let expectedTotal = null
  const section = { holder: '', digits: '' }

  for (const page of pages) {
    const rows = page.rows
    const columns = findColumns(rows)
    let current = null       // lançamento aberto
    let currentOwnsLast = false // a linha anterior foi parte do lançamento aberto
    let pending = []         // linhas de texto solto que podem abrir o próximo

    const close = () => {
      if (current && current.amount != null && current.parts.length) {
        entries.push({
          date: current.date,
          description: current.parts.join(' ').replace(/\s+/g, ' ').trim(),
          amount: current.amount,
          notes: [current.extra.join(' '), current.section].filter(Boolean).join(' · '),
        })
      }
      current = null
    }

    rows.forEach((row, i) => {
      const text = rowText(row)
      const n = norm(text)
      const prevY = i > 0 ? rows[i - 1].y : null
      const nextY = i < rows.length - 1 ? rows[i + 1].y : null

      const totalMatch = /total (da )?fatura|total a pagar|valor total/.test(n)
      if (totalMatch && kind === 'card' && expectedTotal == null) {
        const amt = row.cells.filter(c => AMOUNT_CELL.test(c.str.trim()))
        if (amt.length) expectedTotal = Math.abs(cellAmount(amt[amt.length - 1].str))
      }

      // Seção de titular em fatura com cartão adicional:
      // "GASTOS DE FULANO (9505)" ou o final do cartão na linha seguinte.
      const holder = text.match(/^(?:gastos|despesas|lan[cç]amentos|compras)\s+de\s+(.+?)\s*(?:\((?:final\s*)?(\d{4})\))?$/i)
      if (holder && !DATE_START.test(text)) {
        close()
        section.holder = holder[1].trim()
        section.digits = holder[2] || ''
        pending = []
        currentOwnsLast = false
        return
      }
      const digitsOnly = text.match(/^\((?:final\s*)?(\d{4})\)$|^(?:cart[aã]o\s+)?final\s+(\d{4})$/i)
      if (digitsOnly) {
        section.digits = digitsOnly[1] || digitsOnly[2]
        pending = []
        currentOwnsLast = false
        return
      }

      const amountCells = row.cells.filter(c => AMOUNT_CELL.test(c.str.trim()))
      const textCells = row.cells.filter(c => !AMOUNT_CELL.test(c.str.trim()))
      const dateMatch = text.match(DATE_START)

      if (dateMatch) {
        close()
        const date = resolveDate(dateMatch, ref)
        const ownDesc = textCells.map(c => c.str).join(' ').replace(DATE_START, '').trim()
        if (!date || NOT_A_TRANSACTION.test(norm(ownDesc))) { pending = []; currentOwnsLast = false; return }

        let parts = ownDesc ? [ownDesc] : []
        if (!parts.length && pending.length) {
          // Só as linhas de texto coladas nesta (meia linha acima), não o
          // cabeçalho de seção que veio antes.
          const glued = []
          let below = row.y
          let firstGap = null
          for (let k = pending.length - 1; k >= 0; k--) {
            const gap = pending[k].y - below
            if (firstGap == null) firstGap = gap
            if (gap > firstGap * 1.5) break
            glued.unshift(pending[k].text)
            below = pending[k].y
          }
          parts = glued
        }
        pending = []

        current = {
          date,
          parts,
          amount: pickAmount(amountCells, { kind, columns }),
          extra: [],
          section: [section.holder, section.digits && `final ${section.digits}`].filter(Boolean).join(' · '),
          rowsLeft: 4,
        }
        currentOwnsLast = true
        return
      }

      // Linha sem data.
      if (current && current.amount == null) {
        // Lançamento ainda sem valor (compra internacional): o texto continua
        // a descrição até aparecer o valor.
        current.rowsLeft--
        if (amountCells.length) {
          current.amount = pickAmount(amountCells, { kind, columns })
          const rest = textCells.map(c => c.str).join(' ').trim()
          // Texto ao lado do valor com números é detalhe (cotação, valor em
          // dólar), não nome do estabelecimento.
          if (rest) (/\d/.test(rest) ? current.extra : current.parts).push(rest)
        } else if (text) {
          current.parts.push(text)
        }
        if (current.rowsLeft <= 0 && current.amount == null) current = null
        currentOwnsLast = !!current
        return
      }

      if (amountCells.length || !text) {
        // Totais, saldos e afins — fora de qualquer lançamento.
        close()
        pending = []
        currentOwnsLast = false
        return
      }

      // Texto solto: continua o lançamento de cima ou abre o de baixo,
      // conforme de qual dos dois está mais perto.
      const gapPrev = prevY != null ? prevY - row.y : Infinity
      const gapNext = nextY != null ? row.y - nextY : Infinity
      if (current && currentOwnsLast && gapPrev < gapNext) {
        current.parts.push(text)
        return
      }
      close()
      pending.push({ y: row.y, text })
      currentOwnsLast = false
    })

    close()
  }

  return { entries, expectedTotal }
}

// Comprovante de Pix: um lançamento só, com o nome da outra parte.
function parsePix(pages, { ref }) {
  const rows = pages.flatMap(p => p.rows).filter(r => rowText(r))
  const lines = rows.map(rowText)
  const all = lines.join('\n')
  const n = norm(all)

  const incoming = /pix recebido|recebeu um pix|comprovante de recebimento|voce recebeu/.test(n)

  let amount = null
  const valueLine = lines.find(l => /^valor\b/i.test(norm(l)) && /\d,\d{2}/.test(l))
    || lines.find(l => /R\$\s*[\d.]+,\d{2}/.test(l))
  if (valueLine) {
    const m = valueLine.match(/(\d{1,3}(?:\.\d{3})+|\d+),\d{2}/)
    if (m) amount = Number(m[0].replace(/\./g, '').replace(',', '.'))
  }

  const dates = [...all.matchAll(FULL_DATE)].map(m => isoFrom(m[3], m[2], m[1]))
  const date = dates[0] || ref

  // "Destino" / "Para" abre o bloco de quem recebeu; dentro dele, "Nome".
  const sectionRe = incoming ? /^(origem|pagador|quem pagou|de)\b/ : /^(destino|recebedor|favorecido|quem recebeu|para|destinatario)\b/
  let counterpart = ''
  for (let i = 0; i < lines.length && !counterpart; i++) {
    if (!sectionRe.test(norm(lines[i]))) continue
    // Valor na mesma linha: depois dos dois-pontos ou na célula ao lado.
    const inline = lines[i].includes(':')
      ? lines[i].slice(lines[i].indexOf(':') + 1).trim()
      : rows[i].cells.slice(1).map(c => c.str).join(' ').trim()
    if (inline && !/^\d/.test(inline)) { counterpart = inline; break }
    for (let k = i + 1; k < Math.min(lines.length, i + 5); k++) {
      const l = lines[k]
      const nameLabel = l.match(/^nome\s*:?\s*(.*)$/i)
      if (nameLabel) { counterpart = nameLabel[1].trim() || lines[k + 1] || ''; break }
      if (!/:/.test(l) && !/\d{3}/.test(l)) { counterpart = l.trim(); break }
    }
  }

  if (amount == null) return { entries: [], expectedTotal: null }

  const description = counterpart
    ? `Pix ${incoming ? 'de' : 'para'} ${counterpart}`
    : (incoming ? 'Pix recebido' : 'Pix enviado')
  return {
    entries: [{ date, description, amount: incoming ? amount : -amount, notes: '' }],
    expectedTotal: null,
  }
}

/**
 * @param {Array<{rows:Array}>} pages
 * @param {{today?:string}} [opts]
 * @returns {{kind:'card'|'account'|'pix', bank:string, entries:Array, expectedTotal:number|null}}
 *   amount com sinal: negativo é saída de dinheiro.
 */
export function parsePdfStatement(pages, { today } = {}) {
  const fullText = pages.flatMap(p => p.rows.map(rowText)).join('\n')
  if (!fullText.trim()) {
    throw new Error('O PDF não tem texto (provavelmente é uma imagem escaneada). Exporte o extrato em PDF pelo app ou site do banco.')
  }

  let kind = detectKind(fullText)
  const bank = detectBank(fullText)

  const fullDates = [...fullText.matchAll(FULL_DATE)]
    .map(m => isoFrom(m[3], m[2], m[1]))
    .filter(d => d >= '2000-01-01' && d <= '2099-12-31')
    .sort()
  const ref = fullDates[fullDates.length - 1] || today || new Date().toISOString().slice(0, 10)

  if (kind === 'pix') {
    const pix = parsePix(pages, { ref })
    // Um "extrato de Pix" com vários lançamentos não é comprovante: cai na
    // leitura de tabela, que dá conta de muitas linhas.
    const table = parseTable(pages, { kind: 'account', ref })
    if (table.entries.length > 1) return { kind: 'account', bank, ...table }
    if (pix.entries.length) return { kind, bank, ...pix }
    kind = 'account'
  }

  const table = parseTable(pages, { kind, ref })
  // Fatura lista a compra como valor positivo; aqui todo mundo fala "saída é
  // negativo", então o sinal é invertido uma vez, na saída.
  if (kind === 'card') table.entries.forEach(e => { e.amount = -e.amount })
  return { kind, bank, ...table }
}
