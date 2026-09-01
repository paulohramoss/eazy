import { describe, expect, it } from 'vitest'
import { addDays, addMonths, addYears, advance, brDate, isoDate } from './date.js'

describe('isoDate', () => {
  it('usa componentes locais, não UTC', () => {
    // Regressão: toISOString() converte para UTC e, à noite em BRT, devolve o
    // dia seguinte — lançamentos feitos às 23h caíam na data errada.
    const lateNight = new Date(2026, 11, 31, 23, 30, 0)
    expect(isoDate(lateNight)).toBe('2026-12-31')
  })

  it('preenche mês e dia com zero à esquerda', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('atravessa a virada de mês', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('atravessa a virada de ano para trás', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('respeita ano bissexto', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('addMonths', () => {
  it('encolhe o dia quando o mês de destino é mais curto', () => {
    // O overflow nativo do Date daria 2026-03-03; um lançamento marcado para o
    // dia 31 pularia fevereiro inteiro.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('preserva o dia quando cabe', () => {
    expect(addMonths('2026-01-15', 2)).toBe('2026-03-15')
  })

  it('atravessa a virada de ano', () => {
    expect(addMonths('2026-11-30', 2)).toBe('2027-01-30')
  })
})

describe('addYears', () => {
  it('29 de fevereiro vira 28 em ano não bissexto', () => {
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28')
  })

  it('mantém a data quando o ano é bissexto', () => {
    expect(addYears('2028-02-29', 4)).toBe('2032-02-29')
  })
})

describe('advance', () => {
  it('semanal soma sete dias', () => {
    expect(advance('2026-01-01', 'weekly')).toBe('2026-01-08')
  })

  it('mensal é o padrão para frequência desconhecida', () => {
    expect(advance('2026-01-15', 'qualquer-coisa')).toBe('2026-02-15')
  })

  it('multiplica corretamente para N repetições', () => {
    expect(advance('2026-01-15', 'monthly', 11)).toBe('2026-12-15')
    expect(advance('2026-01-01', 'weekly', 4)).toBe('2026-01-29')
  })
})

describe('brDate', () => {
  it('não desloca a data por fuso', () => {
    expect(brDate('2026-03-10')).toBe('10/03/2026')
  })
})
