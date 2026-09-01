// As transações guardam a data como string ISO 'YYYY-MM-DD', então comparação
// lexicográfica já ordena corretamente — não precisa converter para Date.

// Data local em ISO. Não usar toISOString(): ele converte para UTC e, no fim da
// noite, devolve o dia seguinte (31/12 23:30 em BRT vira 2027-01-01).
export const isoDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Meio-dia evita que o fuso empurre a data para o dia anterior na exibição.
export const brDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')

// Soma (ou subtrai) dias. O construtor Date normaliza o overflow de mês e ano,
// e usar componentes locais mantém o resultado no mesmo fuso que isoDate.
export const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDate(new Date(y, m - 1, d + n))
}

// Soma meses preservando o dia, encolhendo quando o mês de destino é mais curto:
// 31/jan + 1 mês = 28/fev (e não 03/mar, que é o que o overflow do Date daria).
export const addMonths = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  const lastDay = new Date(y, m - 1 + n + 1, 0).getDate()
  return isoDate(new Date(y, m - 1 + n, Math.min(d, lastDay)))
}

// 29/fev num ano não bissexto vira 28/fev.
export const addYears = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  const lastDay = new Date(y + n, m, 0).getDate()
  return isoDate(new Date(y + n, m - 1, Math.min(d, lastDay)))
}

export const FREQUENCIES = [
  { value: 'weekly',  labelKey: 'freq.weekly' },
  { value: 'monthly', labelKey: 'freq.monthly' },
  { value: 'yearly',  labelKey: 'freq.yearly' },
]

// Próxima ocorrência de uma recorrência. Espelha advanceISO em api/_lib/dates.js
// — o cron usa a versão do servidor, a UI usa esta para prever a próxima data.
export const advance = (iso, frequency, times = 1) => {
  if (frequency === 'weekly') return addDays(iso, 7 * times)
  if (frequency === 'yearly') return addYears(iso, times)
  return addMonths(iso, times)
}
