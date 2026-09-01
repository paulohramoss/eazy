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
