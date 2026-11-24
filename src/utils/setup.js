// Contas do onboarding e do assistente de configuração ("comece no meio do
// mês"). Puro, como quickParse: são números que a pessoa vê na primeira hora
// de uso — um "guarde R$ 500 por mês" errado é a primeira impressão do app.

// Último dia de um mês "AAAA-MM": o prazo de uma meta escolhida por mês.
export function endOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

/**
 * Quantos meses de depósito cabem de hoje até o mês escolhido, contando o mês
 * atual e o do prazo: de novembro a junho do ano seguinte são 8 depósitos.
 * Prazo no passado ou no próprio mês vale 1 — a conta nunca divide por zero.
 */
export function monthsUntil(today, ym) {
  const [ty, tm] = today.split('-').map(Number)
  const [y, m] = ym.split('-').map(Number)
  return Math.max(1, (y * 12 + m) - (ty * 12 + tm) + 1)
}

// Quanto guardar por mês para chegar ao valor no prazo. Arredonda para cima
// no centavo: arredondar para baixo deixaria a meta um pouco aquém.
export function monthlyNeeded(target, today, ym) {
  const total = Number(target) || 0
  if (total <= 0 || !ym) return 0
  return Math.ceil((total / monthsUntil(today, ym)) * 100) / 100
}

/**
 * Os passos do cartão "Seus primeiros passos". `step` é o índice do passo no
 * assistente de configuração; `screen`, uma tela do app.
 */
export function checklistItems({ wallets = [], creditCards = [], budgets = [], goals = [], monthTx = [], settings = {} }) {
  const profile = settings.profile || {}
  const setup = settings.setup || {}
  return [
    { id: 'account', done: wallets.length > 0, step: 0 },
    { id: 'income', done: Number(profile.monthlyIncome) > 0, step: 0 },
    { id: 'expenses', done: monthTx.length > 0, step: 1 },
    { id: 'cards', done: creditCards.length > 0 || !!setup.noCards, step: 2 },
    { id: 'limits', done: budgets.length > 0, step: 3 },
    { id: 'goal', done: goals.length > 0, screen: 'goals' },
  ]
}

/**
 * "Você ainda pode gastar": o que está nas contas hoje menos o que já tem
 * destino até o fim do mês.
 *
 * - Contas a vencer: despesas em conta com data entre amanhã e o fim do mês.
 *   As de hoje para trás já saíram do saldo; contar de novo seria descontar
 *   duas vezes.
 * - Faturas: compra no cartão não mexe no saldo da conta até a fatura ser
 *   paga, então a fatura aberta precisa sair daqui.
 * - Limites: só informativo — é o quanto o orçamento por categoria ainda deixa
 *   gastar, não dinheiro reservado.
 */
export function spendableSummary({ totalBalance = 0, transactions = [], today, invoices = [], budgets = [], spendingByCategory = {} }) {
  const monthEnd = endOfMonth(today.slice(0, 7))
  const bills = transactions
    .filter(tx => tx.type === 'expense' && tx.walletId && tx.status !== 'failed'
      && tx.date > today && tx.date <= monthEnd)
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0)
  const cardInvoices = invoices.reduce((s, v) => s + (Number(v) || 0), 0)
  const limitsLeft = budgets.reduce((s, b) =>
    s + Math.max(0, (Number(b.limit) || 0) - (spendingByCategory[b.category] || 0)), 0)

  const available = round2(totalBalance - bills - cardInvoices)
  const [y, m, d] = today.split('-').map(Number)
  const daysLeft = new Date(Date.UTC(y, m, 0)).getUTCDate() - d + 1

  return {
    balance: round2(totalBalance),
    bills: round2(bills),
    cardInvoices: round2(cardInvoices),
    limitsLeft: round2(limitsLeft),
    available,
    daysLeft,
    perDay: available > 0 ? Math.floor((available / daysLeft) * 100) / 100 : 0,
  }
}

/**
 * Âncora de saldo. O saldo de uma conta é saldo inicial + entradas − saídas;
 * quem informa "tenho R$ 2.000 hoje" e depois importa os gastos do mês teria
 * esses gastos descontados de novo. Devolve o saldo inicial que faz o saldo de
 * hoje continuar igual ao informado, ou null se já está certo.
 *
 * Saldo inicial negativo não é aceito pelas regras do Firestore: nesse caso
 * devolve { negative: true } para a tela avisar em vez de gravar.
 */
export function anchoredInitialBalance(wallet, currentBalance, stated) {
  const diff = round2(Number(stated) - Number(currentBalance))
  if (Math.abs(diff) < 0.01) return null
  const next = round2((Number(wallet.balance) || 0) + diff)
  return next < 0 ? { negative: true } : { balance: next }
}

const round2 = (n) => Math.round(n * 100) / 100
