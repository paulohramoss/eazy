import { describe, expect, it } from 'vitest'
import { analysisReportCsv, csvFormat, csvNumber, toCsv, transactionsCsv } from './exportCsv.js'

const LABELS = {
  date: 'Data', description: 'Descrição', type: 'Tipo', category: 'Categoria', amount: 'Valor',
  status: 'Status', wallet: 'Carteira', card: 'Cartão', tags: 'Tags', notes: 'Observações',
  income: 'Receita', expense: 'Despesa', completed: 'Concluído', pending: 'Pendente',
}

describe('csvFormat', () => {
  it('pt-BR usa ponto e vírgula e vírgula decimal', () => {
    expect(csvFormat('pt-BR')).toEqual({ decimal: ',', delimiter: ';' })
  })

  it('en-US usa vírgula e ponto decimal', () => {
    expect(csvFormat('en-US')).toEqual({ decimal: '.', delimiter: ',' })
  })
})

describe('csvNumber', () => {
  it('sem separador de milhar, com o decimal do locale', () => {
    expect(csvNumber(1234.5, { decimal: ',' })).toBe('1234,50')
    expect(csvNumber(undefined, { decimal: '.' })).toBe('0.00')
  })
})

describe('toCsv', () => {
  it('escapa aspas e mantém o separador dentro do campo', () => {
    const out = toCsv([['a;b', 'diz "oi"']], { delimiter: ';' })
    expect(out).toBe('﻿"a;b";"diz ""oi"""')
  })
})

describe('transactionsCsv', () => {
  it('ordena por data e resolve carteira, cartão e tags', () => {
    const out = transactionsCsv([
      { date: '2026-10-05', name: 'Mercado', type: 'expense', category: 'Alimentação', amount: 80.5,
        status: 'completed', cardId: 'c1', tags: ['casa', 'mês'] },
      { date: '2026-10-01', name: 'Salário', type: 'income', category: 'Salário', amount: 5000,
        status: 'pending', walletId: 'w1' },
    ], {
      wallets: [{ id: 'w1', name: 'Nubank' }],
      creditCards: [{ id: 'c1', name: 'Visa' }],
      labels: LABELS,
      format: csvFormat('pt-BR'),
    })
    const lines = out.slice(1).split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('"2026-10-01";"Salário";"Receita";"Salário";"5000,00";"Pendente";"Nubank";"";"";""')
    expect(lines[2]).toBe('"2026-10-05";"Mercado";"Despesa";"Alimentação";"80,50";"Concluído";"";"Visa";"casa, mês";""')
  })
})

describe('analysisReportCsv', () => {
  const L = new Proxy({}, { get: (_, k) => String(k) })
  const report = {
    granularity: 'month',
    months: 2,
    income: 1000,
    expenses: 400,
    series: [
      { key: '2026-09', income: 1000, expenses: 300 },
      { key: '2026-10', income: 0, expenses: 100 },
    ],
    byCategory: { Saúde: { total: 100, count: 1 }, Lazer: { total: 300, count: 3 } },
  }

  it('monta resumo, série e categorias, com médias mensais', () => {
    const out = analysisReportCsv(report, {
      start: '2026-09-01', end: '2026-10-31', periodLabel: 'Últimos 2',
      bucketLabel: (k) => `m${k}`, labels: L, format: csvFormat('pt-BR'),
    })
    const lines = out.slice(1).split('\r\n')
    expect(lines).toContain('"totalIncome";"1000,00"')
    expect(lines).toContain('"net";"600,00"')
    expect(lines).toContain('"avgExpenses";"200,00"')
    expect(lines).toContain('"savingsRate";"60,00%"')
    expect(lines).toContain('"m2026-10";"0,00";"100,00";"-100,00"')
    // Categoria de maior gasto primeiro.
    const lazer = lines.indexOf('"Lazer";"3";"300,00";"100,00";"75,00%"')
    const saude = lines.indexOf('"Saúde";"1";"100,00";"100,00";"25,00%"')
    expect(lazer).toBeGreaterThan(0)
    expect(saude).toBeGreaterThan(lazer)
  })
})
