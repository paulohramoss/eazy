import { describe, expect, it } from 'vitest'
import { normalizeDate, parseAmount, parseCSV } from './csv.js'

describe('parseCSV', () => {
  it('não quebra em vírgula dentro de aspas', () => {
    // O motivo do parser existir: split(',') deslocaria todas as colunas
    // seguintes numa descrição como "SUPERMERCADO XYZ, LTDA".
    const rows = parseCSV('Data,Descrição,Valor\n2026-01-05,"SUPERMERCADO XYZ, LTDA",99.90')
    expect(rows[1]).toEqual(['2026-01-05', 'SUPERMERCADO XYZ, LTDA', '99.90'])
  })

  it('entende aspas escapadas', () => {
    const rows = parseCSV('a,b\n1,"diz ""oi"" aqui"')
    expect(rows[1][1]).toBe('diz "oi" aqui')
  })

  it('aceita quebra de linha dentro do campo', () => {
    const rows = parseCSV('a,b\n1,"linha um\nlinha dois"')
    expect(rows).toHaveLength(2)
    expect(rows[1][1]).toBe('linha um\nlinha dois')
  })

  it('detecta ponto e vírgula como separador', () => {
    // Formato comum de banco brasileiro, onde a vírgula já é o decimal.
    const rows = parseCSV('Data;Descrição;Valor\n05/01/2026;Mercado;1.234,56')
    expect(rows[1]).toEqual(['05/01/2026', 'Mercado', '1.234,56'])
  })

  it('detecta tabulação', () => {
    const rows = parseCSV('Data\tValor\n2026-01-05\t10')
    expect(rows[1]).toEqual(['2026-01-05', '10'])
  })

  it('lida com CRLF e com a última linha sem quebra', () => {
    const rows = parseCSV('a,b\r\n1,2\r\n3,4')
    expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('descarta linhas totalmente vazias', () => {
    const rows = parseCSV('a,b\n1,2\n\n,\n3,4')
    expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })
})

describe('normalizeDate', () => {
  it('mantém ISO', () => {
    expect(normalizeDate('2026-01-05')).toBe('2026-01-05')
  })

  it('converte o formato brasileiro', () => {
    expect(normalizeDate('05/01/2026')).toBe('2026-01-05')
    expect(normalizeDate('5/1/2026')).toBe('2026-01-05')
    expect(normalizeDate('05-01-2026')).toBe('2026-01-05')
    expect(normalizeDate('05.01.2026')).toBe('2026-01-05')
  })

  it('expande ano de dois dígitos', () => {
    expect(normalizeDate('05/01/26')).toBe('2026-01-05')
    expect(normalizeDate('05/01/99')).toBe('1999-01-05')
  })

  it('rejeita entradas inválidas em vez de inventar uma data', () => {
    expect(normalizeDate('32/01/2026')).toBeNull()
    expect(normalizeDate('05/13/2026')).toBeNull()
    expect(normalizeDate('não é data')).toBeNull()
    expect(normalizeDate('')).toBeNull()
    expect(normalizeDate(null)).toBeNull()
  })
})

describe('parseAmount', () => {
  it('entende o formato brasileiro', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('R$ 1.234,56')).toBe(1234.56)
    expect(parseAmount('0,99')).toBe(0.99)
  })

  it('entende o formato americano', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('$1,234.56')).toBe(1234.56)
  })

  it('entende valores sem separador de milhar', () => {
    expect(parseAmount('99.90')).toBe(99.9)
    expect(parseAmount('99,90')).toBe(99.9)
    expect(parseAmount('1500')).toBe(1500)
  })

  it('reconhece negativo por sinal e por parênteses', () => {
    // Parênteses são a convenção contábil de vários extratos: (150,00) é -150.
    expect(parseAmount('-150,00')).toBe(-150)
    expect(parseAmount('(150,00)')).toBe(-150)
    expect(parseAmount('R$ -1.500,00')).toBe(-1500)
  })

  it('devolve null para o que não é número', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount(null)).toBeNull()
  })
})
