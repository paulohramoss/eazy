import { describe, expect, it, vi } from 'vitest'
import {
  buildRequest, callClaude, extractToolInput, MAX_ENTRIES, MAX_IMAGE_B64, MAX_TEXT, sanitizeEntries, TOOL, validateInput,
} from './aiParse.js'

const CATS = ['Alimentação', 'Transporte', 'Lazer', 'Salário', 'Outros']
const CTX = {
  today: '2026-11-13',
  categories: CATS,
  wallets: [{ id: 'w1', name: 'Nubank conta' }, { id: 'w2', name: 'Dinheiro' }],
  cards: [{ id: 'c1', name: 'Nubank crédito' }],
}

describe('validateInput', () => {
  const ok = { text: 'uber 20 e mercado 100', today: '2026-11-13', categories: CATS }

  it('aceita o caso comum e normaliza espaços', () => {
    const r = validateInput({ ...ok, text: '  uber   20  ' })
    expect(r.ok).toBe(true)
    expect(r.value.text).toBe('uber 20')
    expect(r.value.wallets).toEqual([])
  })

  it('recusa texto vazio ou longo demais', () => {
    expect(validateInput({ ...ok, text: '   ' }).ok).toBe(false)
    expect(validateInput({ ...ok, text: 'a'.repeat(MAX_TEXT + 1) }).ok).toBe(false)
  })

  it('recusa data de hoje inválida', () => {
    expect(validateInput({ ...ok, today: '2026-02-30' }).ok).toBe(false)
    expect(validateInput({ ...ok, today: 'ontem' }).ok).toBe(false)
  })

  it('recusa sem categorias', () => {
    expect(validateInput({ ...ok, categories: [] }).ok).toBe(false)
  })

  it('descarta carteira sem id ou sem nome', () => {
    const r = validateInput({ ...ok, wallets: [{ id: 'w1', name: 'Conta' }, { id: '', name: 'x' }, { id: 'w3' }] })
    expect(r.value.wallets).toEqual([{ id: 'w1', name: 'Conta' }])
  })
})

describe('validateInput com imagem', () => {
  const ok = { today: '2026-11-13', categories: CATS }
  const image = { mediaType: 'image/jpeg', data: 'aGVsbG8=' }

  it('aceita foto sem texto', () => {
    const r = validateInput({ ...ok, image })
    expect(r.ok).toBe(true)
    expect(r.value).toMatchObject({ text: '', image })
  })

  it('recusa formato, base64 inválido ou imagem grande', () => {
    expect(validateInput({ ...ok, image: { ...image, mediaType: 'image/gif' } }).ok).toBe(false)
    expect(validateInput({ ...ok, image: { ...image, data: 'não é base64!' } }).ok).toBe(false)
    expect(validateInput({ ...ok, image: { ...image, data: 'A'.repeat(MAX_IMAGE_B64 + 4) } }).ok).toBe(false)
  })

  it('sem texto e sem imagem continua recusado', () => {
    expect(validateInput(ok).ok).toBe(false)
  })
})

describe('buildRequest', () => {
  it('com imagem manda o bloco de imagem antes do texto', () => {
    const req = buildRequest({ text: '', image: { mediaType: 'image/png', data: 'aGk=' }, ...CTX })
    const [img, txt] = req.messages[0].content
    expect(img).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGk=' } })
    expect(txt).toEqual({ type: 'text', text: 'Registre o que está nesta imagem.' })
    expect(req.system).toContain('TOTAL pago')
  })

  it('força a ferramenta e leva o contexto no system', () => {
    const req = buildRequest({ text: 'uber 20', ...CTX })
    expect(req.tool_choice).toEqual({ type: 'tool', name: TOOL.name })
    expect(req.temperature).toBe(0)
    expect(req.system).toContain('Hoje é 2026-11-13 (sexta)')
    expect(req.system).toContain('- w1: Nubank conta')
    expect(req.system).toContain('- c1: Nubank crédito')
    expect(req.system).toContain('- Alimentação')
    // O texto da pessoa vai como mensagem, nunca colado no system.
    expect(req.messages).toEqual([{ role: 'user', content: 'uber 20' }])
  })

  it('respeita o modelo configurado', () => {
    expect(buildRequest({ text: 'x', ...CTX }, { model: 'outro' }).model).toBe('outro')
  })
})

describe('sanitizeEntries', () => {
  const base = { name: 'Uber', amount: 20, type: 'expense', category: 'Transporte', date: '2026-11-13' }

  it('passa um item válido e marca como concluído', () => {
    expect(sanitizeEntries([base], CTX)).toEqual([{
      ...base, status: 'completed', walletId: '', cardId: '',
    }])
  })

  it('descarta item sem valor positivo', () => {
    const out = sanitizeEntries([
      { ...base, amount: 0 }, { ...base, amount: -5 }, { ...base, amount: 'abc' }, { ...base, amount: 1e12 }, null,
    ], CTX)
    expect(out).toEqual([])
  })

  it('arredonda centavos', () => {
    expect(sanitizeEntries([{ ...base, amount: 12.345 }], CTX)[0].amount).toBe(12.35)
  })

  it('categoria fora da lista cai em Outros', () => {
    expect(sanitizeEntries([{ ...base, category: 'Objetivos' }], CTX)[0].category).toBe('Outros')
    const semOutros = { ...CTX, categories: ['Lazer', 'Transporte'] }
    expect(sanitizeEntries([{ ...base, category: 'Inventada' }], semOutros)[0].category).toBe('Lazer')
  })

  it('tipo desconhecido vira despesa', () => {
    expect(sanitizeEntries([{ ...base, type: 'transfer' }], CTX)[0].type).toBe('expense')
  })

  it('data inválida ou absurda vira hoje; futura fica pendente', () => {
    expect(sanitizeEntries([{ ...base, date: '2011-11-01' }], CTX)[0].date).toBe('2026-11-13')
    expect(sanitizeEntries([{ ...base, date: '13/11' }], CTX)[0].date).toBe('2026-11-13')
    const future = sanitizeEntries([{ ...base, date: '2026-11-20' }], CTX)[0]
    expect(future).toMatchObject({ date: '2026-11-20', status: 'pending' })
  })

  it('só aceita carteira e cartão da lista', () => {
    expect(sanitizeEntries([{ ...base, walletId: 'w2' }], CTX)[0].walletId).toBe('w2')
    expect(sanitizeEntries([{ ...base, walletId: 'hackeado' }], CTX)[0].walletId).toBe('')
    expect(sanitizeEntries([{ ...base, cardId: 'c9' }], CTX)[0].cardId).toBe('')
  })

  it('cartão ganha da carteira e não vale para receita', () => {
    const credit = sanitizeEntries([{ ...base, walletId: 'w1', cardId: 'c1' }], CTX)[0]
    expect(credit).toMatchObject({ cardId: 'c1', walletId: '' })
    const income = sanitizeEntries([{ ...base, type: 'income', category: 'Salário', cardId: 'c1', walletId: 'w1' }], CTX)[0]
    expect(income).toMatchObject({ cardId: '', walletId: 'w1' })
  })

  it('nome vazio vira a categoria; nome longo é cortado', () => {
    expect(sanitizeEntries([{ ...base, name: '  ' }], CTX)[0].name).toBe('Transporte')
    expect(sanitizeEntries([{ ...base, name: 'x'.repeat(200) }], CTX)[0].name).toHaveLength(80)
  })

  it('limita a quantidade de itens', () => {
    const many = Array.from({ length: MAX_ENTRIES + 5 }, () => base)
    expect(sanitizeEntries(many, CTX)).toHaveLength(MAX_ENTRIES)
  })

  it('aguenta resposta que não é lista', () => {
    expect(sanitizeEntries(undefined, CTX)).toEqual([])
    expect(sanitizeEntries({ entries: [] }, CTX)).toEqual([])
  })
})

describe('extractToolInput', () => {
  it('lê o bloco da ferramenta certa', () => {
    const response = { content: [
      { type: 'text', text: 'ok' },
      { type: 'tool_use', name: TOOL.name, input: { entries: [{ name: 'a' }] } },
    ] }
    expect(extractToolInput(response)).toEqual([{ name: 'a' }])
  })

  it('devolve lista vazia sem bloco', () => {
    expect(extractToolInput({ content: [{ type: 'text', text: 'oi' }] })).toEqual([])
    expect(extractToolInput(null)).toEqual([])
  })
})

describe('callClaude', () => {
  it('manda a chave no header e devolve o JSON', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ content: [] }) }))
    const out = await callClaude({ model: 'm' }, { apiKey: 'sk-test', fetchImpl })
    expect(out).toEqual({ content: [] })
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers['x-api-key']).toBe('sk-test')
    expect(init.headers['anthropic-version']).toBe('2023-06-01')
  })

  it('propaga o erro da API com status', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false, status: 529, json: async () => ({ error: { message: 'overloaded' } }),
    }))
    await expect(callClaude({}, { apiKey: 'k', fetchImpl })).rejects.toMatchObject({ status: 529, message: 'overloaded' })
  })
})
