// quickParse — interpreta uma linha digitada ("almoço 32", "uber 12,50 ontem")
// e devolve os campos de uma transação.
//
// Puro de propósito: nada de React, nada de Firestore. O lançamento rápido é o
// caminho que 90% dos gastos vão percorrer, então a inferência precisa de teste
// — é aqui que "1.200" vira 1,20 e o mês inteiro sai errado.

import { CATEGORIES, GOAL_CATEGORY } from './categories'

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Categorias de entrada: se o texto cai numa delas, é receita sem precisar de
// verbo ("freela 800" não tem "recebi", mas ninguém *gasta* num freela).
export const INCOME_CATEGORIES = new Set([
  'Salário', 'Freelance', 'Investimentos', 'Outros Rendimentos',
])

// Verbos e expressões que marcam entrada de dinheiro explicitamente. Ficam
// separados das categorias porque "recebi 50 do rolê" é receita em Lazer.
const INCOME_MARKERS = [
  'recebi', 'receber', 'ganhei', 'vendi', 'caiu', 'entrou', 'me pagaram',
  'pagaram', 'reembolso', 'estorno', 'cashback', 'devolveram',
]

// Palavra → categoria. Uma palavra só aparece uma vez: empate resolvido na
// fonte é mais previsível que empate resolvido por ordem de iteração.
const CATEGORY_KEYWORDS = {
  'Alimentação': [
    'almoco', 'janta', 'jantar', 'cafe', 'lanche', 'ifood', 'rappi', 'mercado',
    'supermercado', 'padaria', 'pizza', 'burger', 'hamburguer', 'lanchonete',
    'restaurante', 'feira', 'acai', 'sorvete', 'comida', 'delivery', 'marmita',
    'pastel', 'coxinha', 'sushi', 'doce', 'salgado', 'churrasco', 'mc', 'bk',
  ],
  'Transporte': [
    'uber', 'taxi', 'onibus', 'metro', 'gasolina', 'combustivel', 'alcool',
    'estacionamento', 'pedagio', 'passagem', 'bilhete', 'posto', 'ipva',
    'mecanico', 'oficina', 'patinete', 'brt', 'trem', 'corrida', 'recarga',
  ],
  'Moradia': [
    'aluguel', 'condominio', 'luz', 'energia', 'agua', 'gas', 'internet',
    'wifi', 'iptu', 'faxina', 'moveis', 'reforma', 'enxoval',
  ],
  'Saúde': [
    'farmacia', 'remedio', 'medico', 'dentista', 'consulta', 'exame',
    'psicologo', 'terapia', 'academia', 'gym', 'vacina', 'oculos', 'plano',
  ],
  'Lazer': [
    'cinema', 'show', 'netflix', 'spotify', 'jogo', 'game', 'steam', 'festa',
    'role', 'balada', 'viagem', 'hotel', 'airbnb', 'bar', 'cerveja', 'ingresso',
    'parque', 'hbo', 'prime', 'twitch', 'disney', 'passeio', 'praia',
  ],
  'Educação': [
    'faculdade', 'curso', 'mensalidade', 'livro', 'apostila', 'material',
    'escola', 'udemy', 'alura', 'ingles', 'matricula', 'pos', 'graduacao',
  ],
  'Vestuário': [
    'roupa', 'camiseta', 'tenis', 'calca', 'sapato', 'shein', 'zara', 'renner',
    'riachuelo', 'bolsa', 'blusa', 'moletom', 'bone',
  ],
  'Tecnologia': [
    'celular', 'notebook', 'fone', 'mouse', 'teclado', 'cabo', 'carregador',
    'monitor', 'computador', 'ssd', 'icloud', 'apple', 'chip', 'headset',
  ],
  'Salário': ['salario', 'holerite', 'contracheque', 'pagamento'],
  'Freelance': ['freela', 'freelance', 'bico', 'job'],
  'Investimentos': ['dividendo', 'rendimento', 'tesouro', 'cdb', 'fii', 'cripto', 'bitcoin'],
  'Outros Rendimentos': ['presente', 'premio', 'vaquinha', 'mesada', 'pensao'],
}

// Palavras que são só ruído no nome depois de já terem cumprido seu papel.
const NOISE_WORDS = new Set([
  'r$', 'rs', 'reais', 'real', 'conto', 'contos', 'pila', 'pilas', 'de', 'do',
  'da', 'no', 'na', 'em', 'por', 'com', 'gastei', 'paguei', 'comprei', 'pix',
])

const DAY_OFFSETS = {
  hoje: 0,
  ontem: -1,
  anteontem: -2,
  amanha: 1,
}

const isoDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const shiftDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number)
  // UTC para o deslocamento não cair num dia a menos quando o fuso local tem
  // horário de verão no meio do caminho.
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().split('T')[0]
}

/**
 * "1.200,50" → 1200.5 · "32,50" → 32.5 · "1.200" → 1200 · "32.50" → 32.5
 *
 * Convenção brasileira: ponto separa milhar, vírgula separa decimal. O caso
 * ambíguo é um ponto sozinho — resolvido pelo tamanho do grupo à direita, já
 * que milhar sempre tem exatamente três dígitos.
 */
export function parseAmount(raw) {
  let s = String(raw ?? '').trim().replace(/^r?\$\s*/i, '').replace(/\s/g, '')
  if (!s) return null

  let multiplier = 1
  if (/k$/i.test(s)) {
    multiplier = 1000
    s = s.slice(0, -1)
  }

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    // O último separador que aparece é o decimal.
    const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
    const thousandSep = decimalSep === ',' ? '.' : ','
    s = s.split(thousandSep).join('').replace(decimalSep, '.')
  } else if (hasComma) {
    s = s.replace(',', '.')
  } else if (hasDot) {
    const tail = s.slice(s.lastIndexOf('.') + 1)
    // Três dígitos depois do ponto é milhar ("1.200"); o resto é decimal.
    if (tail.length === 3) s = s.split('.').join('')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round(n * multiplier * 100) / 100
}

// Todos os candidatos a valor no texto, com onde começam e terminam.
const AMOUNT_RE = /(?:r\$\s*)?\d+(?:[.,]\d+)*\s*k?/gi

function findAmount(text) {
  const matches = [...text.matchAll(AMOUNT_RE)]
  if (!matches.length) return null

  // Um token com "R$" é declaração de intenção: ganha de qualquer outro número
  // solto ("2 cafés R$ 18" é 18, não 2).
  const explicit = matches.filter(m => /r\$/i.test(m[0]))
  const pool = explicit.length ? explicit : matches
  // Sem marcador, o último número é o valor — "2 cafés 18" e "almoço 32" caem
  // os dois nessa forma.
  const chosen = pool[pool.length - 1]

  const value = parseAmount(chosen[0])
  if (value === null || value <= 0) return null
  return { value, start: chosen.index, end: chosen.index + chosen[0].length }
}

function matchCategory(words, available) {
  let best = null
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!available.includes(category)) continue
    for (const kw of keywords) {
      if (!words.includes(kw)) continue
      // Palavra mais longa vence: "cartao de credito" é mais específico que
      // "cartao", e o desempate por tamanho não depende da ordem do objeto.
      if (!best || kw.length > best.length) best = { category, length: kw.length }
    }
  }
  return best?.category || null
}

// Procura um lançamento passado com a mesma descrição. É o que faz o app
// aprender: quem categorizou "Ifood" como Lazer uma vez não quer ver
// Alimentação na próxima.
function matchHistory(cleanName, history) {
  if (!cleanName || !history?.length) return null
  const target = norm(cleanName)
  if (!target) return null

  let exact = null
  let partial = null
  for (const tx of history) {
    const name = norm(tx.name)
    if (!name) continue
    if (name === target) { exact = tx; break }
    if (!partial && (name.includes(target) || target.includes(name))) partial = tx
  }
  return exact || partial
}

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/**
 * Interpreta uma linha de lançamento rápido.
 *
 * @param {string} input   o que a pessoa digitou
 * @param {object} [opts]
 * @param {string[]} [opts.categories]  categorias disponíveis (padrão: CATEGORIES)
 * @param {string}  [opts.today]        data ISO de hoje, para testar sem relógio
 * @param {object[]} [opts.history]     transações anteriores, mais recentes primeiro
 * @returns {{amount:number|null, name:string, category:string, type:string,
 *            date:string, status:string, source:'history'|'keyword'|'default'}}
 */
export function parseQuickEntry(input, opts = {}) {
  const {
    categories = CATEGORIES,
    today = isoDate(new Date()),
    history = [],
  } = opts

  const text = String(input ?? '')
  const lower = norm(text)

  const found = findAmount(text)
  const amount = found?.value ?? null

  // Tira o valor do texto para ele não virar parte da descrição.
  const withoutAmount = found
    ? `${text.slice(0, found.start)} ${text.slice(found.end)}`
    : text

  // Data por palavra ("ontem"), removida do nome em seguida.
  let date = today
  let dateWord = null
  for (const [word, offset] of Object.entries(DAY_OFFSETS)) {
    const re = new RegExp(`\\b${word}\\b`)
    if (re.test(norm(withoutAmount))) {
      date = offset === 0 ? today : shiftDays(today, offset)
      dateWord = word
      break
    }
  }

  const rawWords = withoutAmount.split(/\s+/).filter(Boolean)
  const keptWords = rawWords.filter(w => {
    const n = norm(w).replace(/[^\p{L}\p{N}$]/gu, '')
    if (!n) return false
    if (n === dateWord) return false
    if (NOISE_WORDS.has(n)) return false
    return true
  })

  const cleanName = capitalize(keptWords.join(' ').trim())
  const searchWords = rawWords.map(w => norm(w).replace(/[^\p{L}\p{N}]/gu, ''))

  // Histórico primeiro, palavra-chave depois: o hábito da pessoa vence a
  // tabela genérica.
  const past = matchHistory(cleanName, history)
  const byKeyword = matchCategory(searchWords, categories)

  let category
  let source
  if (past && categories.includes(past.category)) {
    category = past.category
    source = 'history'
  } else if (byKeyword) {
    category = byKeyword
    source = 'keyword'
  } else {
    category = categories.includes('Outros') ? 'Outros' : categories[0]
    source = 'default'
  }

  // Objetivos tem fluxo próprio (aporte na tela de Objetivos); cair nela por
  // acidente criaria transação órfã de objetivo.
  if (category === GOAL_CATEGORY) {
    category = categories.includes('Outros') ? 'Outros' : categories[0]
    source = 'default'
  }

  const hasIncomeMarker = INCOME_MARKERS.some(m => lower.includes(m))
  let type
  if (hasIncomeMarker) type = 'income'
  else if (source === 'history') type = past.type || 'expense'
  else if (INCOME_CATEGORIES.has(category)) type = 'income'
  else type = 'expense'

  return {
    amount,
    name: cleanName || category,
    category,
    type,
    date,
    // Data futura entra como pendente: ainda não saiu do bolso.
    status: date > today ? 'pending' : 'completed',
    source,
  }
}

/**
 * Os lançamentos que mais se repetem numa janela recente, para virarem chips
 * de um toque. Deriva do que já está em memória — nenhuma leitura nova.
 *
 * Agrupa por nome normalizado: "Ifood" e "ifood" são o mesmo hábito.
 */
export function frequentEntries(transactions = [], opts = {}) {
  const { days = 60, limit = 3, today = isoDate(new Date()), minCount = 2 } = opts
  const since = shiftDays(today, -days)

  const groups = new Map()
  for (const tx of transactions) {
    if (!tx?.name || !tx.date) continue
    if (tx.date < since || tx.date > today) continue
    if (tx.status === 'failed') continue

    const key = norm(tx.name)
    if (!key) continue

    const entry = groups.get(key)
    if (!entry) {
      groups.set(key, { count: 1, latest: tx })
      continue
    }
    entry.count += 1
    // O último lançamento define valor e categoria: o preço do almoço sobe.
    if ((tx.date || '') > (entry.latest.date || '')) entry.latest = tx
  }

  return [...groups.values()]
    .filter(g => g.count >= minCount)
    .sort((a, b) => b.count - a.count
      || (b.latest.date || '').localeCompare(a.latest.date || ''))
    .slice(0, limit)
    .map(({ count, latest }) => ({
      count,
      name: latest.name,
      amount: latest.amount,
      category: latest.category,
      type: latest.type,
      walletId: latest.walletId || '',
      cardId: latest.cardId || '',
    }))
}
