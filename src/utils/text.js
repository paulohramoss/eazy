// text — normalização para busca.
//
// Sem acento e sem caixa, para "alimentacao" achar "Alimentação" e "ROLE"
// achar "#rolê". Vivia duplicado na paleta; agora a tela de transações usa o
// mesmo, então as duas buscas concordam sobre o que casa.

export const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Casa um termo contra vários campos de uma vez. */
export const matchesAny = (term, ...fields) => {
  const t = norm(term).trim()
  if (!t) return true
  return fields.some(f => norm(f).includes(t))
}
