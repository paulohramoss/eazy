// Datas do lado do servidor.
//
// O cron da Vercel roda em UTC, mas o app é de uso brasileiro: às 21h de
// Brasília já é o dia seguinte em UTC. Calcular "hoje" com new Date() no
// servidor dispararia os lembretes de fatura no dia errado.

export const APP_TZ = process.env.APP_TIMEZONE || 'America/Sao_Paulo'

// 'YYYY-MM-DD' no fuso do app. en-CA porque é o locale cujo formato curto já é
// ISO, evitando remontar a string a partir das partes.
export function todayISO(tz = APP_TZ, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function partsInTz(tz = APP_TZ, now = new Date()) {
  const iso = todayISO(tz, now)
  const [year, month, day] = iso.split('-').map(Number)
  // getUTCDay sobre a data local já normalizada dá o dia da semana correto
  // (0 = domingo) sem reintroduzir o deslocamento de fuso.
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return { iso, year, month, day, weekday }
}

export const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Avança preservando o dia do mês, encolhendo quando o mês de destino é mais
// curto: 31/jan + 1 mês = 28/fev, não 03/mar.
export function addMonthsISO(iso, months) {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

export function addYearsISO(iso, years) {
  const [y, m, d] = iso.split('-').map(Number)
  // 29/fev num ano não bissexto vira 28/fev.
  const lastDay = new Date(Date.UTC(y + years, m, 0)).getUTCDate()
  return `${y + years}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

// Próxima ocorrência de uma recorrência a partir de uma data.
export function advanceISO(iso, frequency) {
  if (frequency === 'weekly') return addDaysISO(iso, 7)
  if (frequency === 'yearly') return addYearsISO(iso, 1)
  return addMonthsISO(iso, 1)
}

// Início do ciclo de fatura vigente, dado o dia de fechamento.
export function cardCycleStartISO(closingDay, todayIso) {
  const [y, m, d] = todayIso.split('-').map(Number)
  const clamp = (year, month) => {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return Math.min(closingDay, last)
  }
  return d >= closingDay
    ? `${y}-${String(m).padStart(2, '0')}-${String(clamp(y, m)).padStart(2, '0')}`
    : (() => {
        const prev = new Date(Date.UTC(y, m - 2, 1))
        const py = prev.getUTCFullYear(), pm = prev.getUTCMonth() + 1
        return `${py}-${String(pm).padStart(2, '0')}-${String(clamp(py, pm)).padStart(2, '0')}`
      })()
}
