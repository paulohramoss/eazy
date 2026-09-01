import { describe, expect, it } from 'vitest'
import {
  addDaysISO, addMonthsISO, addYearsISO, advanceISO, cardCycleStartISO, partsInTz, todayISO,
} from './dates.js'

describe('todayISO', () => {
  it('usa o fuso do app, não o UTC do servidor', () => {
    // O cron roda em UTC. Às 23h de Brasília já é o dia seguinte em UTC, então
    // calcular "hoje" sem fuso dispararia os lembretes de fatura um dia adiantado.
    const lateNightBRT = new Date('2026-03-10T02:30:00Z') // 23h30 do dia 9 em BRT
    expect(todayISO('America/Sao_Paulo', lateNightBRT)).toBe('2026-03-09')
    expect(todayISO('UTC', lateNightBRT)).toBe('2026-03-10')
  })
})

describe('partsInTz', () => {
  it('devolve componentes coerentes com a data local', () => {
    const p = partsInTz('America/Sao_Paulo', new Date('2026-03-10T02:30:00Z'))
    expect(p).toMatchObject({ iso: '2026-03-09', year: 2026, month: 3, day: 9 })
  })

  it('calcula o dia da semana sem deslocar por fuso', () => {
    // 2026-03-09 é uma segunda-feira.
    expect(partsInTz('America/Sao_Paulo', new Date('2026-03-10T02:30:00Z')).weekday).toBe(1)
    // 2026-03-08 é domingo — o gatilho do relatório semanal.
    expect(partsInTz('UTC', new Date('2026-03-08T12:00:00Z')).weekday).toBe(0)
  })
})

describe('addDaysISO', () => {
  it('atravessa mês e ano', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('addMonthsISO', () => {
  it('encolhe o dia quando o mês de destino é mais curto', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsISO('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsISO('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('preserva o dia quando cabe', () => {
    expect(addMonthsISO('2026-01-15', 1)).toBe('2026-02-15')
  })
})

describe('addYearsISO', () => {
  it('29 de fevereiro cai para 28 em ano comum', () => {
    expect(addYearsISO('2028-02-29', 1)).toBe('2029-02-28')
  })
})

describe('advanceISO', () => {
  it('cobre as três frequências', () => {
    expect(advanceISO('2026-01-01', 'weekly')).toBe('2026-01-08')
    expect(advanceISO('2026-01-15', 'monthly')).toBe('2026-02-15')
    expect(advanceISO('2026-01-15', 'yearly')).toBe('2027-01-15')
  })

  it('cai em mensal para frequência desconhecida', () => {
    expect(advanceISO('2026-01-15', undefined)).toBe('2026-02-15')
  })

  it('espelha o advance do cliente', async () => {
    // As duas implementações precisam concordar: o cliente prevê a próxima
    // ocorrência na tela e o cron é quem de fato a gera. Divergir aqui faria a
    // data mostrada não bater com a lançada.
    const { advance } = await import('../../src/utils/date.js')
    for (const iso of ['2026-01-31', '2026-02-28', '2028-02-29', '2026-12-31']) {
      for (const freq of ['weekly', 'monthly', 'yearly']) {
        expect(advanceISO(iso, freq)).toBe(advance(iso, freq))
      }
    }
  })
})

describe('cardCycleStartISO', () => {
  it('antes do fechamento, o ciclo começou no mês anterior', () => {
    expect(cardCycleStartISO(10, '2026-03-05')).toBe('2026-02-10')
  })

  it('no dia do fechamento, o ciclo é o deste mês', () => {
    expect(cardCycleStartISO(10, '2026-03-10')).toBe('2026-03-10')
  })

  it('depois do fechamento, o ciclo é o deste mês', () => {
    expect(cardCycleStartISO(10, '2026-03-20')).toBe('2026-03-10')
  })

  it('encolhe o dia de fechamento em meses curtos', () => {
    // Um cartão que fecha dia 31: em março, o ciclo anterior começou em 28/fev.
    expect(cardCycleStartISO(31, '2026-03-15')).toBe('2026-02-28')
  })

  it('atravessa a virada de ano', () => {
    expect(cardCycleStartISO(15, '2026-01-05')).toBe('2025-12-15')
  })
})
