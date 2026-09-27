// streak — dias seguidos registrando gasto.
//
// Registrar é hábito, e hábito responde a constância visível. Mas streak que
// pune afasta: quem viaja no fim de semana, volta, vê "0" e desinstala. Este
// perdoa uma falha — um dia pulado não zera nada.
//
// A contagem usa a data da transação, não a de gravação: lançar o almoço de
// ontem hoje de manhã é exatamente o comportamento que se quer premiar.

const MS_PER_DAY = 86400000

const toUTC = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  return Date.UTC(y, m - 1, d)
}

const diffDays = (a, b) => Math.round((a - b) / MS_PER_DAY)

/**
 * @param {object[]} transactions
 * @param {object}   [opts]
 * @param {string}   [opts.today]  data ISO de hoje
 * @param {number}   [opts.grace]  dias de folga tolerados dentro da sequência
 * @returns {{current:number, longest:number, lastDate:string|null, atRisk:boolean}}
 *   current  — dias distintos na sequência que chega até hoje (ou ontem)
 *   longest  — a maior sequência já feita
 *   atRisk   — a sequência está viva mas hoje ainda não teve lançamento
 */
export function computeStreak(transactions = [], opts = {}) {
  const { today = new Date().toISOString().slice(0, 10), grace = 1 } = opts
  const todayMs = toUTC(today)
  if (todayMs === null) return { current: 0, longest: 0, lastDate: null, atRisk: false }

  // Dias distintos, do mais recente para o mais antigo. Cinco lançamentos num
  // dia valem o mesmo que um: o hábito é abrir o app, não gastar mais.
  const days = [...new Set(
    transactions
      .filter(tx => tx?.date && tx.status !== 'failed')
      .map(tx => tx.date)
  )]
    .map(toUTC)
    .filter(ms => ms !== null && ms <= todayMs)
    .sort((a, b) => b - a)

  if (!days.length) return { current: 0, longest: 0, lastDate: null, atRisk: false }

  // Uma sequência quebra quando o buraco passa da folga. Com grace=1, dois dias
  // de distância ainda são a mesma sequência; três já não.
  const maxGap = grace + 1

  let longest = 1
  let run = 1
  let currentRun = null

  // A sequência corrente só existe se o último registro ainda está ao alcance
  // de hoje.
  const sinceLast = diffDays(todayMs, days[0])
  const currentAlive = sinceLast <= maxGap

  for (let i = 1; i < days.length; i++) {
    if (diffDays(days[i - 1], days[i]) <= maxGap) {
      run += 1
    } else {
      if (currentRun === null) currentRun = run
      longest = Math.max(longest, run)
      run = 1
    }
  }
  longest = Math.max(longest, run)
  if (currentRun === null) currentRun = run

  return {
    current: currentAlive ? currentRun : 0,
    longest,
    lastDate: days.length ? new Date(days[0]).toISOString().slice(0, 10) : null,
    // Vivo, mas hoje ainda está em branco: é o empurrãozinho, não a ameaça.
    atRisk: currentAlive && sinceLast > 0,
  }
}

// Marcos que valem confete. Passar de 3 dias já é hábito nascendo; 100 é raro
// o bastante para merecer festa.
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365]

/** O marco atingido exatamente agora, ou null. */
export function reachedMilestone(current) {
  return STREAK_MILESTONES.includes(current) ? current : null
}
