import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Auth e CORS de verdade dependem do Firebase Admin; aqui só importa o que a
// rota faz com a resposta da IA.
vi.mock('./_lib/http.js', () => ({
  applyCors: () => true,
  requireUser: async () => ({ uid: 'u1' }),
  rateLimit: () => ({ ok: true }),
}))

const { default: handler } = await import('./parse-entry.js')

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.end = () => res
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

const body = {
  text: 'uber 20 e mercado 130 no crédito ontem',
  today: '2026-11-13',
  categories: ['Alimentação', 'Transporte', 'Outros'],
  wallets: [{ id: 'w1', name: 'Conta' }],
  cards: [{ id: 'c1', name: 'Nubank' }],
}

describe('POST /api/parse-entry', () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'sk-test' })
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; vi.unstubAllGlobals() })

  it('devolve os lançamentos validados', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'tool_use', name: 'registrar_lancamentos', input: { entries: [
        { name: 'Uber', amount: 20, type: 'expense', category: 'Transporte', date: '2026-11-12', walletId: 'w1' },
        { name: 'Mercado', amount: 130, type: 'expense', category: 'Mercado', date: '2026-11-12', cardId: 'c1' },
        { name: 'Lixo', amount: 0, type: 'expense', category: 'Outros', date: '2026-11-12' },
      ] } }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const res = mockRes()
    await handler({ method: 'POST', headers: {}, body }, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.entries).toEqual([
      { name: 'Uber', amount: 20, type: 'expense', category: 'Transporte', date: '2026-11-12', status: 'completed', walletId: 'w1', cardId: '' },
      { name: 'Mercado', amount: 130, type: 'expense', category: 'Outros', date: '2026-11-12', status: 'completed', walletId: '', cardId: 'c1' },
    ])
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.messages[0].content).toBe(body.text)
  })

  it('503 sem chave configurada', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = mockRes()
    await handler({ method: 'POST', headers: {}, body }, res)
    expect(res.statusCode).toBe(503)
    expect(res.body.code).toBe('ai/not-configured')
  })

  it('400 com entrada inválida', async () => {
    const res = mockRes()
    await handler({ method: 'POST', headers: {}, body: { ...body, text: '' } }, res)
    expect(res.statusCode).toBe(400)
  })

  it('502 quando a IA falha, sem vazar o texto no log', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = mockRes()
    await handler({ method: 'POST', headers: {}, body }, res)
    expect(res.statusCode).toBe(502)
    expect(JSON.stringify(log.mock.calls)).not.toContain('mercado')
    log.mockRestore()
  })

  it('405 fora de POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(405)
  })
})
