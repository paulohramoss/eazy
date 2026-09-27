import { describe, expect, it } from 'vitest'
import { frequentEntries, parseAmount, parseQuickEntry } from './quickParse.js'

const TODAY = '2026-09-20'
const p = (input, opts) => parseQuickEntry(input, { today: TODAY, ...opts })

describe('parseAmount', () => {
  it('lê inteiro simples', () => {
    expect(parseAmount('32')).toBe(32)
  })

  it('vírgula é decimal', () => {
    expect(parseAmount('12,50')).toBe(12.5)
  })

  it('ponto seguido de três dígitos é milhar', () => {
    // O erro que custa caro: 1.200 virar 1,20 e o mês fechar errado.
    expect(parseAmount('1.200')).toBe(1200)
  })

  it('ponto seguido de dois dígitos é decimal', () => {
    expect(parseAmount('32.50')).toBe(32.5)
  })

  it('ponto e vírgula juntos: o último separador é o decimal', () => {
    expect(parseAmount('1.200,50')).toBe(1200.5)
    expect(parseAmount('1,200.50')).toBe(1200.5)
  })

  it('aceita prefixo R$ e espaços', () => {
    expect(parseAmount('R$ 45,90')).toBe(45.9)
    expect(parseAmount('r$45')).toBe(45)
  })

  it('sufixo k multiplica por mil', () => {
    expect(parseAmount('1,2k')).toBe(1200)
    expect(parseAmount('3k')).toBe(3000)
  })

  it('texto sem número devolve null', () => {
    expect(parseAmount('almoço')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })
})

describe('parseQuickEntry — valor e descrição', () => {
  it('valor depois da descrição', () => {
    const r = p('almoço 32')
    expect(r.amount).toBe(32)
    expect(r.name).toBe('Almoço')
  })

  it('valor antes da descrição', () => {
    const r = p('32 ifood')
    expect(r.amount).toBe(32)
    expect(r.name).toBe('Ifood')
  })

  it('R$ explícito vence um número solto na frente', () => {
    // "2 cafés R$ 18" custa 18, não 2.
    const r = p('2 cafés R$ 18')
    expect(r.amount).toBe(18)
  })

  it('sem marcador, o último número é o valor', () => {
    const r = p('2 cafés 18')
    expect(r.amount).toBe(18)
  })

  it('descrição sem valor devolve amount null', () => {
    const r = p('almoço')
    expect(r.amount).toBeNull()
    expect(r.name).toBe('Almoço')
  })

  it('descarta palavras de ruído', () => {
    expect(p('gastei 40 no mercado').name).toBe('Mercado')
    expect(p('paguei 25 reais de uber').name).toBe('Uber')
  })

  it('sem descrição, o nome vira a categoria', () => {
    expect(p('32').name).toBe('Outros')
  })
})

describe('parseQuickEntry — categoria', () => {
  it('infere por palavra-chave', () => {
    expect(p('almoço 32').category).toBe('Alimentação')
    expect(p('uber 12,50').category).toBe('Transporte')
    expect(p('netflix 55').category).toBe('Lazer')
    expect(p('farmácia 80').category).toBe('Saúde')
  })

  it('acento não atrapalha', () => {
    expect(p('cafe 8').category).toBe('Alimentação')
    expect(p('café 8').category).toBe('Alimentação')
  })

  it('sem palavra conhecida cai em Outros', () => {
    const r = p('xyzabc 15')
    expect(r.category).toBe('Outros')
    expect(r.source).toBe('default')
  })

  it('respeita a lista de categorias disponíveis', () => {
    const r = p('almoço 32', { categories: ['Outros', 'Transporte'] })
    expect(r.category).toBe('Outros')
  })

  it('nunca cai em Objetivos, que tem fluxo próprio', () => {
    // Um aporte precisa nascer na tela de Objetivos para ter goalId; vindo por
    // aqui viraria uma transação órfã que não soma em objetivo nenhum.
    const r = p('objetivos 100')
    expect(r.category).not.toBe('Objetivos')
  })
})

describe('parseQuickEntry — histórico', () => {
  const history = [
    { name: 'Ifood', category: 'Lazer', type: 'expense', date: '2026-09-10' },
  ]

  it('o hábito da pessoa vence a tabela de palavras-chave', () => {
    // "ifood" é Alimentação na tabela, mas quem já classificou como Lazer
    // quer Lazer de novo.
    const r = p('ifood 32', { history })
    expect(r.category).toBe('Lazer')
    expect(r.source).toBe('history')
  })

  it('casa por correspondência parcial', () => {
    const r = p('ifood sushi 40', { history })
    expect(r.category).toBe('Lazer')
  })

  it('histórico com categoria desconhecida não é usado', () => {
    const r = p('ifood 32', {
      history: [{ name: 'Ifood', category: 'Inexistente', type: 'expense' }],
    })
    expect(r.category).toBe('Alimentação')
    expect(r.source).toBe('keyword')
  })
})

describe('parseQuickEntry — tipo', () => {
  it('despesa é o padrão', () => {
    expect(p('almoço 32').type).toBe('expense')
  })

  it('categoria de entrada implica receita', () => {
    expect(p('salário 3000').type).toBe('income')
    expect(p('freela 800').type).toBe('income')
  })

  it('verbo de recebimento implica receita mesmo fora das categorias de entrada', () => {
    const r = p('recebi 50 do rolê')
    expect(r.type).toBe('income')
    expect(r.category).toBe('Lazer')
  })

  it('herda o tipo do histórico', () => {
    const r = p('vaquinha 20', {
      history: [{ name: 'Vaquinha', category: 'Lazer', type: 'expense' }],
    })
    expect(r.type).toBe('expense')
  })
})

describe('parseQuickEntry — data', () => {
  it('sem palavra de data, é hoje', () => {
    expect(p('almoço 32').date).toBe(TODAY)
  })

  it('ontem volta um dia', () => {
    expect(p('almoço 32 ontem').date).toBe('2026-09-19')
  })

  it('anteontem volta dois dias', () => {
    expect(p('uber 20 anteontem').date).toBe('2026-09-18')
  })

  it('atravessa a virada do mês', () => {
    expect(parseQuickEntry('café 8 ontem', { today: '2026-03-01' }).date).toBe('2026-02-28')
  })

  it('a palavra de data sai da descrição', () => {
    expect(p('almoço 32 ontem').name).toBe('Almoço')
  })

  it('data futura entra como pendente', () => {
    const r = p('aluguel 1200 amanhã')
    expect(r.date).toBe('2026-09-21')
    expect(r.status).toBe('pending')
  })

  it('data de hoje entra como concluída', () => {
    expect(p('almoço 32').status).toBe('completed')
  })
})

describe('frequentEntries', () => {
  const tx = (name, date, amount, extra = {}) =>
    ({ name, date, amount, category: 'Alimentação', type: 'expense', ...extra })

  it('agrupa por nome, ignorando caixa e acento', () => {
    const out = frequentEntries([
      tx('Ifood', '2026-09-10', 30),
      tx('ifood', '2026-09-15', 35),
    ], { today: TODAY })
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(2)
  })

  it('o lançamento mais recente define valor e categoria', () => {
    const out = frequentEntries([
      tx('Almoço', '2026-09-01', 25),
      tx('Almoço', '2026-09-18', 32, { category: 'Lazer' }),
    ], { today: TODAY })
    expect(out[0].amount).toBe(32)
    expect(out[0].category).toBe('Lazer')
  })

  it('ordena pelos mais repetidos', () => {
    const out = frequentEntries([
      tx('Uber', '2026-09-10', 12),
      tx('Uber', '2026-09-11', 14),
      tx('Uber', '2026-09-12', 11),
      tx('Café', '2026-09-13', 8),
      tx('Café', '2026-09-14', 8),
    ], { today: TODAY })
    expect(out.map(e => e.name)).toEqual(['Uber', 'Café'])
  })

  it('exige repetição: acontecido uma vez não é hábito', () => {
    const out = frequentEntries([tx('Dentista', '2026-09-10', 200)], { today: TODAY })
    expect(out).toEqual([])
  })

  it('ignora o que está fora da janela', () => {
    const out = frequentEntries([
      tx('Antigo', '2026-01-01', 10),
      tx('Antigo', '2026-01-02', 10),
    ], { today: TODAY, days: 60 })
    expect(out).toEqual([])
  })

  it('ignora transações falhas', () => {
    const out = frequentEntries([
      tx('Falha', '2026-09-10', 10, { status: 'failed' }),
      tx('Falha', '2026-09-11', 10, { status: 'failed' }),
    ], { today: TODAY })
    expect(out).toEqual([])
  })

  it('respeita o limite', () => {
    const many = ['A', 'B', 'C', 'D'].flatMap(n => [
      tx(n, '2026-09-10', 10), tx(n, '2026-09-11', 10),
    ])
    expect(frequentEntries(many, { today: TODAY, limit: 3 })).toHaveLength(3)
  })
})
