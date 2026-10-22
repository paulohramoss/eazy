import { describe, expect, it } from 'vitest'
import fatura from './__fixtures__/fatura-cartao.json'
import { parsePdfStatement } from './pdfStatement'
import { groupRows } from './pdfRows'
import { parseOFX } from './ofx'
import { categorize, cleanName, finalizeStatement } from './index'
import { parseCSVStatement } from '../csv'
import { CATEGORIES } from '../categories'

// Linhas de PDF montadas à mão: [y, [x, texto], [x, texto]...]
const page = (...rows) => ({
  rows: rows.map(([y, ...cells]) => ({ y, cells: cells.map(([x, str]) => ({ x, w: 30, str })) })),
})

describe('fatura de cartão em PDF (layout real, dados anonimizados)', () => {
  const raw = parsePdfStatement(fatura, { today: '2026-10-22' })
  const { entries, total } = finalizeStatement(raw)
  const kept = entries.filter(e => !e.skip)
  const byName = (s) => entries.find(e => e.name.includes(s))

  it('reconhece fatura e banco', () => {
    expect(raw.kind).toBe('card')
    expect(raw.bank).toBe('Sicoob')
  })

  it('a soma lida bate com o total impresso na fatura', () => {
    expect(total).toEqual({ expected: 2163.51, computed: 2163.51 })
  })

  it('não importa o pagamento da fatura anterior', () => {
    expect(byName('PAGAMENTO').skip).toBe('payment')
  })

  it('anula estorno contra a compra na mesma fatura', () => {
    // Shopee 135,99 com dois créditos (66,00 + 69,99): nada a lançar.
    const shopee = entries.filter(e => e.name.startsWith('Shopee'))
    expect(shopee).toHaveLength(3)
    expect(shopee.every(e => e.skip === 'refunded')).toBe(true)
    // Anuidade com "desconto anuidade por uso" do mesmo valor e dia.
    expect(entries.filter(e => /ANUIDADE/.test(e.name)).every(e => e.skip === 'refunded')).toBe(true)
  })

  it('junta descrição quebrada em várias linhas', () => {
    expect(byName('MERCADOLIVRE').name).toBe('MERCADO*MERCADOLIVRE DIADEMA (2/2)')
    const claude = byName('ANTHROPIC')
    expect(claude.name).toBe('ANTHROPIC* CLAUDE SU SAN FRANCISCO')
    expect(claude.amount).toBe(110)
    // Cotação do dólar vai para observação, não para o nome.
    expect(claude.notes).toContain('U$ 21,49')
  })

  it('lança a parcela no mês em que ela cai, não no da compra', () => {
    const parcela = byName('ESTRATEGIACON')
    expect(parcela.name).toBe('ESTRATEGIACON BRASILIA (6/6)')
    expect(parcela.date).toBe('2026-09-06') // compra em 06/04 + 5 meses
    expect(parcela.notes).toContain('Compra em 06/04/2026')
  })

  it('tira o prefixo do processador e anota o titular do adicional', () => {
    expect(byName('Spotify').name).toBe('Spotify SAO PAULO')
    expect(byName('NETFLIX').notes).toContain('BELTRANA DE TAL · final 9760')
  })

  it('todas as compras restantes são despesas com data e valor', () => {
    expect(kept).toHaveLength(26)
    expect(kept.every(e => e.type === 'expense' && e.amount > 0 && /^2026-\d{2}-\d{2}$/.test(e.date))).toBe(true)
  })
})

describe('extrato de conta em PDF', () => {
  it('usa a coluna de valor e ignora a de saldo', () => {
    const raw = parsePdfStatement([page(
      [700, [50, 'EXTRATO CONTA CORRENTE 01/10/2026']],
      [680, [50, 'Data'], [120, 'Histórico'], [400, 'Valor'], [480, 'Saldo']],
      [660, [50, '01/10/2026'], [120, 'SALDO ANTERIOR'], [480, '1.000,00']],
      [648, [50, '02/10/2026'], [120, 'PIX ENVIADO FULANO'], [400, '-50,00'], [480, '950,00']],
      [636, [50, '03/10/2026'], [120, 'PIX RECEBIDO BELTRANA'], [400, '200,00'], [480, '1.150,00']],
      [624, [50, '04/10/2026'], [120, 'PAGTO BOLETO ENERGIA'], [400, '120,30 D'], [480, '1.029,70']],
    )])
    expect(raw.kind).toBe('account')
    expect(raw.entries.map(e => [e.date, e.description, e.amount])).toEqual([
      ['2026-10-02', 'PIX ENVIADO FULANO', -50],
      ['2026-10-03', 'PIX RECEBIDO BELTRANA', 200],
      ['2026-10-04', 'PAGTO BOLETO ENERGIA', -120.3],
    ])
  })

  it('separa débito e crédito por coluna quando não há sinal', () => {
    const raw = parsePdfStatement([page(
      [700, [50, 'Data'], [120, 'Descrição'], [380, 'Débito'], [440, 'Crédito'], [500, 'Saldo']],
      [680, [50, '10/09/2026'], [120, 'MERCADO'], [380, '80,00'], [500, '920,00']],
      [668, [50, '11/09/2026'], [120, 'SALARIO'], [440, '3.000,00'], [500, '3.920,00']],
    )])
    expect(raw.entries.map(e => e.amount)).toEqual([-80, 3000])
  })
})

describe('comprovante de Pix em PDF', () => {
  it('lê valor, data e quem recebeu', () => {
    const raw = parsePdfStatement([page(
      [700, [50, 'Comprovante de Pix']],
      [680, [50, 'Valor'], [300, 'R$ 45,90']],
      [668, [50, 'Data'], [300, '15/10/2026 às 14:32']],
      [640, [50, 'Destino']],
      [628, [50, 'Nome'], [300, 'PADARIA PAO QUENTE LTDA']],
      [616, [50, 'CNPJ'], [300, '12.345.678/0001-90']],
      [590, [50, 'Origem']],
      [578, [50, 'Nome'], [300, 'FULANO DE TAL']],
    )])
    expect(raw.kind).toBe('pix')
    expect(raw.entries).toEqual([
      { date: '2026-10-15', description: 'Pix para PADARIA PAO QUENTE LTDA', amount: -45.9, notes: '' },
    ])
  })

  it('pix recebido vira entrada', () => {
    const raw = parsePdfStatement([page(
      [700, [50, 'Comprovante - Pix recebido']],
      [680, [50, 'Valor: R$ 1.200,00']],
      [668, [50, '05/10/2026']],
      [650, [50, 'Pagador'], [300, 'EMPRESA X']],
    )])
    expect(raw.entries[0]).toMatchObject({ amount: 1200, description: 'Pix de EMPRESA X' })
  })

  it('PDF sem texto avisa que é imagem', () => {
    expect(() => parsePdfStatement([{ rows: [] }])).toThrow(/escaneada/)
  })
})

describe('groupRows', () => {
  it('agrupa por y e ordena por x, sem juntar a meia linha', () => {
    const rows = groupRows([
      { x: 400, y: 456.2, str: '271,80' },
      { x: 115, y: 456.2, str: '26/07' },
      { x: 220, y: 461.4, str: 'MERCADO' },
      { x: 220, y: 451.0, str: 'DIADEMA' },
    ])
    expect(rows.map(r => r.cells.map(c => c.str).join(' '))).toEqual(['MERCADO', '26/07 271,80', 'DIADEMA'])
  })
})

describe('OFX', () => {
  const sgml = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260905120000[-3:BRT]
<TRNAMT>-32.50
<FITID>A1
<MEMO>COMPRA CARTAO DEB IFOOD
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260906
<TRNAMT>1500,00
<FITID>A2
<NAME>PIX RECEBIDO
<MEMO>PIX RECEBIDO FULANO DE TAL
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
<FI><ORG>Banco Teste</ORG></FI>
</OFX>`

  it('lê OFX 1.x (SGML, tags sem fechamento)', () => {
    const { kind, entries } = parseOFX(sgml)
    expect(kind).toBe('account')
    expect(entries).toEqual([
      { date: '2026-09-05', description: 'COMPRA CARTAO DEB IFOOD', amount: -32.5, fitId: 'A1', notes: '' },
      { date: '2026-09-06', description: 'PIX RECEBIDO FULANO DE TAL', amount: 1500, fitId: 'A2', notes: '' },
    ])
  })

  it('lê OFX 2.x (XML) de cartão', () => {
    const xml = `<?xml version="1.0"?><OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260910</DTPOSTED><TRNAMT>-59.90</TRNAMT><FITID>X</FITID><NAME>NETFLIX.COM</NAME></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`
    const { kind, entries } = parseOFX(xml)
    expect(kind).toBe('card')
    expect(entries[0]).toMatchObject({ date: '2026-09-10', description: 'NETFLIX.COM', amount: -59.9 })
  })

  it('recusa o que não é OFX', () => {
    expect(() => parseOFX('data,valor')).toThrow(/OFX/)
  })
})

describe('CSV de extrato', () => {
  it('converte para valor com sinal', () => {
    const { entries } = parseCSVStatement('Data;Descrição;Valor\n05/09/2026;Mercado;-1.234,56\n06/09/2026;Salário;5.000,00')
    expect(entries.map(e => e.amount)).toEqual([-1234.56, 5000])
  })
})

describe('finalizeStatement', () => {
  it('em extrato de conta não mexe em "pagamento" nem em barra no nome', () => {
    const { entries } = finalizeStatement({
      kind: 'account',
      entries: [{ date: '2026-09-05', description: 'PAGAMENTO BOLETO 01/02', amount: -100 }],
    })
    expect(entries[0]).toMatchObject({ name: 'PAGAMENTO BOLETO 01/02', skip: null, type: 'expense', date: '2026-09-05' })
  })

  it('estorno sem compra correspondente fica como entrada', () => {
    const { entries } = finalizeStatement({
      kind: 'card',
      entries: [
        { date: '2026-09-05', description: 'LOJA A', amount: -50 },
        { date: '2026-09-06', description: 'ESTORNO LOJA B', amount: 30 },
      ],
    })
    expect(entries.map(e => e.skip)).toEqual([null, null])
    expect(entries[1].type).toBe('income')
  })

  it('estorno parcial reduz a compra', () => {
    const { entries } = finalizeStatement({
      kind: 'card',
      entries: [
        { date: '2026-09-05', description: 'LOJA X SAO PAULO', amount: -100 },
        { date: '2026-09-07', description: 'LOJA X SAO PAULO', amount: 40 },
      ],
    })
    expect(entries[0]).toMatchObject({ amount: 60, skip: null })
    expect(entries[1].skip).toBe('refunded')
  })

  it('cleanName tira prefixo de processador', () => {
    expect(cleanName('DM*Spotify SAO PAULO')).toBe('Spotify SAO PAULO')
    expect(cleanName('MP *VIVO Osasco')).toBe('VIVO Osasco')
    expect(cleanName('Shopee*LH MODAS')).toBe('Shopee*LH MODAS')
  })
})

describe('categorize', () => {
  const cat = (name, type = 'expense', history = []) =>
    categorize({ name, type }, { categories: CATEGORIES, history }).category

  it('reconhece estabelecimentos pelo trecho do nome', () => {
    expect(cat('Spotify SAO PAULO')).toBe('Lazer')
    expect(cat('PLAYSTATI CURITIBA')).toBe('Lazer')
    expect(cat('Petrobras Premmia RIO DE JANEIR')).toBe('Transporte')
    expect(cat('UNINTER CURITIBA (1/2)')).toBe('Educação')
    expect(cat('APPLE.COM/BILL SAO PAULO')).toBe('Tecnologia')
    expect(cat('COMPRA CARTAO DEB IFOOD')).toBe('Alimentação')
  })

  it('marketplace não vira supermercado por causa de "mercado"', () => {
    expect(cat('MERCADO*MERCADOLIVRE DIADEMA')).toBe('Outros')
  })

  it('o histórico da pessoa vence a tabela', () => {
    const history = [{ name: 'Spotify SAO PAULO', category: 'Educação', type: 'expense' }]
    expect(cat('Spotify SAO PAULO', 'expense', history)).toBe('Educação')
  })

  it('entrada sem pista cai em Outros Rendimentos', () => {
    expect(cat('PIX RECEBIDO FULANO', 'income')).toBe('Outros Rendimentos')
  })
})
