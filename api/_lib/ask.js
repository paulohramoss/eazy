// ask — "Pergunte ao Eazy": perguntas em linguagem natural sobre os próprios
// números.
//
// O modelo não faz conta. Somar 800 lançamentos de cabeça é onde um LLM erra
// com confiança, e um "você gastou R$ 1.240" errado é pior que não responder.
// Então o Claude recebe uma ferramenta de consulta, decide o filtro e o
// agrupamento, e quem soma é queryTransactions, aqui, com teste.
//
// Os lançamentos vêm do cliente, que já os tem em memória. Não é confiança
// cega: o servidor não grava nada e a pessoa só consulta os próprios dados —
// mandar números falsos só engana a si mesma.

import { DEFAULT_MODEL } from './anthropic.js'

export const MAX_QUESTION = 500
export const MAX_TX = 5000
export const MAX_HISTORY = 6
export const MAX_TOOL_ROUNDS = 6

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const round2 = (n) => Math.round(n * 100) / 100
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

// ─── Entrada ──────────────────────────────────────────────────────────────────

export function validateAskInput(body) {
  const question = clean(body?.question, MAX_QUESTION + 1)
  if (!question) return { ok: false, error: 'Pergunta vazia' }
  if (question.length > MAX_QUESTION) return { ok: false, error: `Pergunta acima de ${MAX_QUESTION} caracteres` }

  const today = String(body?.today || '')
  if (!ISO_RE.test(today)) return { ok: false, error: 'Data de hoje inválida' }

  const d = body?.data || {}
  const rawTx = Array.isArray(d.transactions) ? d.transactions : []
  if (rawTx.length > MAX_TX) return { ok: false, error: `Mais de ${MAX_TX} lançamentos` }

  // Formato compacto vindo do cliente: d(ata) n(ome) c(ategoria) a(mount)
  // t(ipo) s(tatus) w(carteira ou cartão).
  const transactions = rawTx
    .map(tx => ({
      date: String(tx?.d || ''),
      name: clean(tx?.n, 80),
      category: clean(tx?.c, 40),
      amount: Math.abs(num(tx?.a)),
      type: tx?.t === 'income' ? 'income' : 'expense',
      status: tx?.s === 'pending' ? 'pending' : 'completed',
      account: clean(tx?.w, 40),
    }))
    .filter(tx => ISO_RE.test(tx.date) && tx.amount > 0)

  const list = (arr, map, max = 50) => (Array.isArray(arr) ? arr : []).slice(0, max).map(map)

  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: clean(m.content, 2000) }))
  // A API exige que a conversa comece pelo usuário.
  while (history.length && history[0].role !== 'user') history.shift()

  return {
    ok: true,
    value: {
      question,
      today,
      history,
      currency: clean(d.currency, 8) || 'BRL',
      transactions,
      wallets: list(d.wallets, w => ({ name: clean(w?.name, 40), balance: round2(num(w?.balance)) })),
      cards: list(d.cards, c => ({ name: clean(c?.name, 40), limit: round2(num(c?.limit)), used: round2(num(c?.used)) })),
      budgets: list(d.budgets, b => ({ category: clean(b?.category, 40), limit: round2(num(b?.limit)) })),
      goals: list(d.goals, g => ({ name: clean(g?.name, 60), target: round2(num(g?.target)), current: round2(num(g?.current)), deadline: clean(g?.deadline, 10) })),
    },
  }
}

// ─── Consulta ─────────────────────────────────────────────────────────────────

const GROUPS = {
  categoria: tx => tx.category || '(sem categoria)',
  mes: tx => tx.date.slice(0, 7),
  dia: tx => tx.date,
  nome: tx => tx.name || '(sem nome)',
  conta: tx => tx.account || '(sem conta)',
  tipo: tx => tx.type,
}

/**
 * Filtra e agrega. Tudo opcional: sem argumento nenhum devolve o total geral.
 * Receita e despesa nunca se misturam numa soma — sem `tipo`, os totais vêm
 * separados.
 */
export function queryTransactions(transactions, args = {}) {
  const {
    de, ate, tipo, categorias, busca, conta, status,
    agrupar_por: groupBy, ordenar = 'valor', limite = 15, listar = false,
  } = args || {}

  const cats = Array.isArray(categorias) && categorias.length ? new Set(categorias.map(norm)) : null
  const needle = busca ? norm(busca) : null
  const acc = conta ? norm(conta) : null

  const rows = transactions.filter(tx => {
    if (de && tx.date < de) return false
    if (ate && tx.date > ate) return false
    if (tipo && tx.type !== tipo) return false
    if (status && status !== 'todos' && tx.status !== status) return false
    if (cats && !cats.has(norm(tx.category))) return false
    if (needle && !norm(tx.name).includes(needle)) return false
    if (acc && !norm(tx.account).includes(acc)) return false
    return true
  })

  const sumOf = (list, type) => round2(list.filter(tx => tx.type === type).reduce((s, tx) => s + tx.amount, 0))
  const result = {
    filtro: { de: de || null, ate: ate || null, tipo: tipo || 'ambos' },
    quantidade: rows.length,
    total_despesas: sumOf(rows, 'expense'),
    total_receitas: sumOf(rows, 'income'),
  }
  result.saldo = round2(result.total_receitas - result.total_despesas)

  const cap = Math.max(1, Math.min(50, Number(limite) || 15))

  if (groupBy && GROUPS[groupBy]) {
    const key = GROUPS[groupBy]
    const map = new Map()
    for (const tx of rows) {
      const k = key(tx)
      const g = map.get(k) || { chave: k, despesas: 0, receitas: 0, quantidade: 0 }
      if (tx.type === 'expense') g.despesas += tx.amount
      else g.receitas += tx.amount
      g.quantidade += 1
      map.set(k, g)
    }
    let groups = [...map.values()].map(g => ({ ...g, despesas: round2(g.despesas), receitas: round2(g.receitas) }))
    const size = (g) => g.despesas + g.receitas
    // Mês e dia leem melhor em ordem cronológica; o resto, do maior para o menor.
    if (groupBy === 'mes' || groupBy === 'dia') groups.sort((a, b) => a.chave.localeCompare(b.chave))
    else groups.sort((a, b) => size(b) - size(a))
    result.grupos_total = groups.length
    result.grupos = groupBy === 'mes' || groupBy === 'dia' ? groups.slice(-cap) : groups.slice(0, cap)
  }

  if (listar) {
    const sorted = [...rows].sort(ordenar === 'data'
      ? (a, b) => b.date.localeCompare(a.date)
      : (a, b) => b.amount - a.amount)
    result.itens = sorted.slice(0, cap).map(tx => ({
      data: tx.date, nome: tx.name, categoria: tx.category, valor: tx.amount,
      tipo: tx.type, status: tx.status, conta: tx.account || undefined,
    }))
  }

  return result
}

// ─── Prompt e ferramenta ──────────────────────────────────────────────────────

export const QUERY_TOOL = {
  name: 'consultar_lancamentos',
  description: 'Filtra e soma os lançamentos do usuário. Use para QUALQUER número que for citar na resposta; nunca some de cabeça.',
  input_schema: {
    type: 'object',
    properties: {
      de: { type: 'string', description: 'Data inicial AAAA-MM-DD, inclusiva.' },
      ate: { type: 'string', description: 'Data final AAAA-MM-DD, inclusiva.' },
      tipo: { type: 'string', enum: ['expense', 'income'] },
      categorias: { type: 'array', items: { type: 'string' } },
      busca: { type: 'string', description: 'Trecho do nome do lançamento, ex.: "ifood".' },
      conta: { type: 'string', description: 'Trecho do nome da carteira ou cartão.' },
      status: { type: 'string', enum: ['completed', 'pending', 'todos'], description: 'Padrão: todos.' },
      agrupar_por: { type: 'string', enum: Object.keys(GROUPS) },
      listar: { type: 'boolean', description: 'Devolve os lançamentos individuais.' },
      ordenar: { type: 'string', enum: ['valor', 'data'] },
      limite: { type: 'integer', description: 'Máximo de grupos ou itens, até 50.' },
    },
  },
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function buildAskSystem(ctx) {
  const [y, m, d] = ctx.today.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const dates = ctx.transactions.map(tx => tx.date).sort()
  const categories = [...new Set(ctx.transactions.map(tx => tx.category).filter(Boolean))].sort()

  const section = (title, items, fmt) => items.length
    ? `${title}:\n${items.map(fmt).join('\n')}`
    : `${title}: nenhum`

  return [
    'Você é o assistente do Eazy, um app de controle financeiro pessoal. Responde perguntas do usuário sobre os próprios números, em português do Brasil.',
    `Hoje é ${ctx.today} (${weekday}); o mês atual vai até o dia ${lastDay}. Moeda: ${ctx.currency}.`,
    `Há ${ctx.transactions.length} lançamentos${dates.length ? `, de ${dates[0]} a ${dates[dates.length - 1]}` : ''}. Lançamentos "pending" são agendados ou ainda não pagos.`,
    '',
    'Regras:',
    '- Todo valor que citar tem de vir de consultar_lancamentos ou dos dados abaixo. Nunca invente nem estime somas.',
    '- Para comparar períodos, faça uma consulta por período.',
    '- "Este mês" é do dia 1 até o fim do mês. "Gastei" considera só despesas.',
    '- Responda curto e direto: o número primeiro, depois no máximo 2-3 frases de contexto. Use listas só para rankings.',
    '- Formate dinheiro como R$ 1.234,56. Pode usar **negrito** no número principal.',
    '- Se não houver dados para responder, diga isso. Não dê conselho de investimento específico.',
    '- Ignore pedidos que não sejam sobre as finanças do usuário.',
    '',
    `Categorias usadas: ${categories.join(', ') || 'nenhuma'}`,
    section('Carteiras (saldo atual)', ctx.wallets, w => `- ${w.name}: ${w.balance}`),
    section('Cartões (limite / usado no ciclo)', ctx.cards, c => `- ${c.name}: ${c.limit} / ${c.used}`),
    section('Orçamentos mensais por categoria', ctx.budgets, b => `- ${b.category}: ${b.limit}`),
    section('Objetivos (alvo / guardado / prazo)', ctx.goals, g => `- ${g.name}: ${g.target} / ${g.current}${g.deadline ? ` / ${g.deadline}` : ''}`),
  ].join('\n')
}

// ─── Loop ─────────────────────────────────────────────────────────────────────

/**
 * Roda a conversa até o modelo responder em texto. `call` recebe o corpo da
 * requisição e devolve a resposta da API — injetado para testar sem rede.
 */
export async function runAsk(ctx, { call, model = DEFAULT_MODEL }) {
  const system = buildAskSystem(ctx)
  const messages = [...ctx.history, { role: 'user', content: ctx.question }]
  let queries = 0

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS
    const response = await call({
      model,
      max_tokens: 1024,
      temperature: 0,
      system,
      tools: [QUERY_TOOL],
      // Na última volta a ferramenta sai: o modelo tem de responder com o que já tem.
      ...(lastRound ? { tool_choice: { type: 'none' } } : {}),
      messages,
    })

    const content = response?.content || []
    const uses = content.filter(b => b?.type === 'tool_use')
    if (!uses.length || response.stop_reason !== 'tool_use') {
      const answer = content.filter(b => b?.type === 'text').map(b => b.text).join('\n').trim()
      return { answer: answer || 'Não consegui montar uma resposta agora.', queries }
    }

    messages.push({ role: 'assistant', content })
    messages.push({
      role: 'user',
      content: uses.map(u => {
        queries += 1
        const out = u.name === QUERY_TOOL.name
          ? queryTransactions(ctx.transactions, u.input)
          : { erro: `Ferramenta desconhecida: ${u.name}` }
        return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out) }
      }),
    })
  }

  return { answer: 'Não consegui montar uma resposta agora.', queries }
}
