// aiParse — transforma uma frase livre em lançamentos usando o Claude.
//
// O quickParse local resolve "almoço 32" de graça e na hora. Este módulo é o
// fallback para o que regra nenhuma pega: "paguei 45 de uber e 120 no mercado
// ontem no nubank", "caiu o freela de 800", "metade da pizza 38".
//
// Dividido em duas partes de propósito:
//   - buildRequest / sanitizeEntries são puras e testadas. A resposta do modelo
//     é tratada como entrada não confiável: categoria, carteira e cartão só
//     passam se estiverem na lista que o próprio cliente mandou, e valor e data
//     são conferidos antes de virar transação.
//   - callClaude é o único ponto que fala com a rede.

export const MAX_TEXT = 500
export const MAX_ENTRIES = 10
const MAX_NAME = 80
const MAX_AMOUNT = 1e9
// Uma data a mais de ~13 meses de hoje é quase sempre erro de leitura
// ("1/11" virando 2011), não um lançamento de verdade.
const MAX_DAYS_AWAY = 400

export { callClaude, DEFAULT_MODEL } from './anthropic.js'
import { DEFAULT_MODEL } from './anthropic.js'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

function daysBetween(a, b) {
  const toUtc = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

function isRealDate(iso) {
  if (!ISO_RE.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/**
 * Valida e normaliza o corpo que o cliente manda.
 * @returns {{ok:true, value:object} | {ok:false, error:string}}
 */
export function validateInput(body) {
  const text = clean(body?.text, MAX_TEXT + 1)
  if (!text) return { ok: false, error: 'Texto vazio' }
  if (text.length > MAX_TEXT) return { ok: false, error: `Texto acima de ${MAX_TEXT} caracteres` }

  const today = String(body?.today || '')
  if (!isRealDate(today)) return { ok: false, error: 'Data de hoje inválida' }

  const categories = Array.isArray(body?.categories)
    ? [...new Set(body.categories.map(c => clean(c, 40)).filter(Boolean))].slice(0, 60)
    : []
  if (!categories.length) return { ok: false, error: 'Lista de categorias vazia' }

  const pickList = (list) => (Array.isArray(list) ? list : [])
    .map(x => ({ id: clean(x?.id, 64), name: clean(x?.name, 40) }))
    .filter(x => x.id && x.name)
    .slice(0, 30)

  return {
    ok: true,
    value: {
      text,
      today,
      categories,
      wallets: pickList(body?.wallets),
      cards: pickList(body?.cards),
    },
  }
}

// O formato da resposta. Tool use forçado em vez de "responda em JSON": o
// modelo não tem como devolver prosa, e o schema já filtra metade dos erros.
export const TOOL = {
  name: 'registrar_lancamentos',
  description: 'Registra os lançamentos financeiros encontrados na frase do usuário.',
  input_schema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        description: 'Um item por gasto ou receita mencionado. Vazio se a frase não descreve nenhum.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Descrição curta, como a pessoa diria: "Uber", "Mercado", "Freela site".' },
            amount: { type: 'number', description: 'Valor positivo em reais, ponto como decimal.' },
            type: { type: 'string', enum: ['expense', 'income'] },
            category: { type: 'string', description: 'Exatamente uma das categorias fornecidas.' },
            date: { type: 'string', description: 'AAAA-MM-DD.' },
            walletId: { type: 'string', description: 'id de uma das carteiras fornecidas, ou vazio.' },
            cardId: { type: 'string', description: 'id de um dos cartões fornecidos, ou vazio.' },
          },
          required: ['name', 'amount', 'type', 'category', 'date'],
        },
      },
    },
    required: ['entries'],
  },
}

export function buildRequest({ text, today, categories, wallets, cards }, { model = DEFAULT_MODEL } = {}) {
  const [y, m, d] = today.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const list = (items) => items.length
    ? items.map(i => `- ${i.id}: ${i.name}`).join('\n')
    : '(nenhum)'

  const system = [
    'Você converte frases de controle financeiro pessoal, em português do Brasil, em lançamentos.',
    `Hoje é ${today} (${weekday}). Resolva "ontem", "sexta passada", "dia 5" etc. a partir daí; sem data na frase, use hoje.`,
    'Valores no formato brasileiro: "1.200,50" é 1200.5; "1,2k" é 1200; "50 conto" é 50.',
    'Gastos são expense; "recebi", "caiu", "ganhei", "vendi", salário, freela, reembolso e estorno são income.',
    'Se a frase cita vários gastos, devolva um item para cada. Se cita um gasto dividido ("metade de 80"), registre só a parte da pessoa.',
    'Categoria: use exatamente um nome da lista. Na dúvida, "Outros" se existir.',
    'Carteira e cartão: só preencha se a frase mencionar algo que corresponda claramente a um dos itens. Compra no crédito vai em cardId; débito, pix e dinheiro vão em walletId.',
    'Não invente valores. Sem valor identificável, não crie o item.',
    'Chame sempre a ferramenta registrar_lancamentos.',
    '',
    `Categorias:\n${categories.map(c => `- ${c}`).join('\n')}`,
    `Carteiras:\n${list(wallets)}`,
    `Cartões de crédito:\n${list(cards)}`,
  ].join('\n')

  return {
    model,
    max_tokens: 1024,
    temperature: 0,
    system,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [{ role: 'user', content: text }],
  }
}

/**
 * Confere cada item devolvido pelo modelo contra o que o cliente mandou.
 * Item sem valor válido é descartado; o resto é corrigido para um padrão seguro.
 */
export function sanitizeEntries(raw, { today, categories, wallets = [], cards = [] }) {
  const list = Array.isArray(raw) ? raw : []
  const fallbackCategory = categories.includes('Outros') ? 'Outros' : categories[0]
  const walletIds = new Set(wallets.map(w => w.id))
  const cardIds = new Set(cards.map(c => c.id))

  const out = []
  for (const item of list) {
    if (out.length >= MAX_ENTRIES) break
    if (!item || typeof item !== 'object') continue

    const amount = Math.round(Number(item.amount) * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) continue

    const category = categories.includes(item.category) ? item.category : fallbackCategory
    const type = item.type === 'income' ? 'income' : 'expense'

    let date = String(item.date || '')
    if (!isRealDate(date) || Math.abs(daysBetween(today, date)) > MAX_DAYS_AWAY) date = today

    // Crédito é despesa no cartão: sem carteira, como o modal completo faz.
    const cardId = type === 'expense' && cardIds.has(item.cardId) ? item.cardId : ''
    const walletId = !cardId && walletIds.has(item.walletId) ? item.walletId : ''

    out.push({
      name: clean(item.name, MAX_NAME) || category,
      amount,
      type,
      category,
      date,
      // Data futura entra como pendente, igual ao lançamento rápido local.
      status: date > today ? 'pending' : 'completed',
      walletId,
      cardId,
    })
  }
  return out
}

// Pega o input da chamada de ferramenta na resposta da API.
export function extractToolInput(response) {
  const block = (response?.content || []).find(b => b?.type === 'tool_use' && b.name === TOOL.name)
  return block?.input?.entries ?? []
}
