// Divisão de um valor em parcelas.
//
// Vive fora do AppContext porque é a conta mais delicada do app: R$ 100 em 3x
// não dá 33,33 três vezes — sobra um centavo. Sem tratar a sobra, a soma das
// parcelas não bate com o total lançado, e o erro só aparece meses depois na
// conciliação.

/**
 * @param total  valor total em unidades monetárias (ex.: 100.00)
 * @param count  número de parcelas (>= 1)
 * @returns      array de valores cuja soma é exatamente `total`
 */
export function splitInstallments(total, count) {
  const n = Math.max(1, Math.trunc(Number(count) || 1))

  // Trabalha em centavos: 0.1 + 0.2 !== 0.3 em ponto flutuante, e somar valores
  // arredondados a cada passo acumularia o desvio ao longo das parcelas.
  const totalCents = Math.round((Number(total) || 0) * 100)
  const base = Math.trunc(totalCents / n)
  const remainder = totalCents - base * n

  // A sobra vai toda na primeira parcela — é o que as maquininhas e faturas
  // fazem, e mantém as demais idênticas.
  return Array.from({ length: n }, (_, i) =>
    ((base + (i === 0 ? remainder : 0)) / 100))
}
