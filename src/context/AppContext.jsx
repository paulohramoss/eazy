import { createContext, useContext, useState } from 'react'

// ─── Initial Data ─────────────────────────────────────────────────────────────

export const CATEGORIES = [
  'Salário', 'Freelance', 'Investimentos', 'Outros Rendimentos',
  'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer',
  'Educação', 'Vestuário', 'Tecnologia', 'Outros',
]

export const CATEGORY_ICONS = {
  'Salário':           'fi-rr-briefcase',
  'Freelance':         'fi-rr-laptop',
  'Investimentos':     'fi-rr-chart-line-up',
  'Outros Rendimentos':'fi-rr-coins',
  'Alimentação':       'fi-rr-fork',
  'Moradia':           'fi-rr-home',
  'Transporte':        'fi-rr-car',
  'Saúde':             'fi-rr-heart-rate',
  'Lazer':             'fi-rr-gamepad',
  'Educação':          'fi-rr-book',
  'Vestuário':         'fi-rr-shopping-bag',
  'Tecnologia':        'fi-rr-mobile',
  'Outros':            'fi-rr-box',
}

// Helper para renderizar ícone de categoria
export function CatIcon({ category, style }) {
  const cls = CATEGORY_ICONS[category] || 'fi-rr-box'
  return <i className={`fi ${cls}`} style={style} />
}

const INITIAL_TRANSACTIONS = [
  { id: 't1', type: 'income', name: 'Salário Mensal', category: 'Salário', amount: 8340, date: '2026-04-01', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't2', type: 'expense', name: 'Supermercado Extra', category: 'Alimentação', amount: 187.50, date: '2026-04-07', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't3', type: 'expense', name: 'Conta de Luz', category: 'Moradia', amount: 142.30, date: '2026-04-06', walletId: 'w1', status: 'pending', notes: '' },
  { id: 't4', type: 'expense', name: 'Netflix', category: 'Lazer', amount: 39.90, date: '2026-04-06', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't5', type: 'expense', name: 'Posto de Gasolina', category: 'Transporte', amount: 210, date: '2026-04-05', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't6', type: 'income', name: 'Freelance Design', category: 'Freelance', amount: 1500, date: '2026-04-04', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't7', type: 'expense', name: 'Plano de Saúde', category: 'Saúde', amount: 320, date: '2026-04-03', walletId: 'w1', status: 'failed', notes: '' },
  { id: 't8', type: 'expense', name: 'Aluguel', category: 'Moradia', amount: 1800, date: '2026-04-01', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't9', type: 'expense', name: 'Spotify', category: 'Lazer', amount: 19.90, date: '2026-04-01', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't10', type: 'expense', name: 'Farmácia', category: 'Saúde', amount: 85.60, date: '2026-04-02', walletId: 'w2', status: 'completed', notes: '' },
  { id: 't11', type: 'income', name: 'Dividendos', category: 'Investimentos', amount: 380, date: '2026-03-28', walletId: 'w3', status: 'completed', notes: '' },
  { id: 't12', type: 'expense', name: 'Restaurante', category: 'Alimentação', amount: 145, date: '2026-03-25', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't13', type: 'income', name: 'Salário Mensal', category: 'Salário', amount: 8340, date: '2026-03-01', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't14', type: 'expense', name: 'Internet', category: 'Moradia', amount: 99.90, date: '2026-03-05', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't15', type: 'expense', name: 'Academia', category: 'Saúde', amount: 99.90, date: '2026-03-03', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't16', type: 'expense', name: 'Uber', category: 'Transporte', amount: 67.40, date: '2026-03-20', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't17', type: 'income', name: 'Freelance App', category: 'Freelance', amount: 2200, date: '2026-03-15', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't18', type: 'expense', name: 'Supermercado', category: 'Alimentação', amount: 210.80, date: '2026-03-12', walletId: 'w2', status: 'completed', notes: '' },
  { id: 't19', type: 'income', name: 'Salário Mensal', category: 'Salário', amount: 8340, date: '2026-02-01', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't20', type: 'expense', name: 'Seguro do Carro', category: 'Transporte', amount: 280, date: '2026-02-10', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't21', type: 'expense', name: 'Aluguel', category: 'Moradia', amount: 1800, date: '2026-03-01', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't22', type: 'expense', name: 'Aluguel', category: 'Moradia', amount: 1800, date: '2026-02-01', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't23', type: 'expense', name: 'Alimentação Março', category: 'Alimentação', amount: 320, date: '2026-03-18', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't24', type: 'income', name: 'Salário Mensal', category: 'Salário', amount: 8340, date: '2026-01-01', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't25', type: 'expense', name: 'IPTU', category: 'Moradia', amount: 450, date: '2026-01-10', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't26', type: 'income', name: 'Bônus', category: 'Salário', amount: 2500, date: '2026-01-15', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't27', type: 'income', name: 'Salário Mensal', category: 'Salário', amount: 8340, date: '2025-12-01', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't28', type: 'expense', name: 'Natal / Presentes', category: 'Lazer', amount: 680, date: '2025-12-20', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't29', type: 'income', name: '13º Salário', category: 'Salário', amount: 8340, date: '2025-12-10', walletId: 'w1', status: 'completed', notes: '' },
  { id: 't30', type: 'expense', name: 'Viagem Réveillon', category: 'Lazer', amount: 1200, date: '2025-12-28', walletId: 'w2', status: 'completed', notes: '' },
]

const INITIAL_WALLETS = [
  { id: 'w1', name: 'Conta Corrente', type: 'checking', balance: 15240, color: '#6c63ff', icon: '🏦' },
  { id: 'w2', name: 'Poupança', type: 'savings', balance: 8950, color: '#22c55e', icon: '🐷' },
  { id: 'w3', name: 'Investimentos', type: 'investment', balance: 32400, color: '#f59e0b', icon: '📈' },
]

const INITIAL_BUDGETS = [
  { id: 'b1', category: 'Alimentação', limit: 1200, color: '#f59e0b' },
  { id: 'b2', category: 'Moradia', limit: 2500, color: '#6c63ff' },
  { id: 'b3', category: 'Transporte', limit: 600, color: '#3b82f6' },
  { id: 'b4', category: 'Lazer', limit: 400, color: '#ec4899' },
  { id: 'b5', category: 'Saúde', limit: 500, color: '#22c55e' },
]

const INITIAL_GOALS = [
  { id: 'g1', name: 'Reserva de Emergência', emoji: '🏦', target: 20000, current: 12400, deadline: '2026-12-31', color: '#6c63ff' },
  { id: 'g2', name: 'Viagem Europa', emoji: '✈️', target: 15000, current: 4800, deadline: '2027-07-01', color: '#3b82f6' },
  { id: 'g3', name: 'MacBook Pro', emoji: '💻', target: 4000, current: 3200, deadline: '2026-06-30', color: '#22c55e' },
  { id: 'g4', name: 'Fundo de Investimento', emoji: '📈', target: 10000, current: 8750, deadline: '2026-12-31', color: '#f59e0b' },
]

const INITIAL_INVESTMENTS = [
  { id: 'i1', name: 'Vale S.A.', ticker: 'VALE3', type: 'Ação', quantity: 50, avgPrice: 68.50, currentPrice: 72.30, color: '#6c63ff' },
  { id: 'i2', name: 'Petrobras', ticker: 'PETR4', type: 'Ação', quantity: 100, avgPrice: 34.20, currentPrice: 36.80, color: '#22c55e' },
  { id: 'i3', name: 'Bitcoin', ticker: 'BTC', type: 'Cripto', quantity: 0.15, avgPrice: 280000, currentPrice: 310000, color: '#f59e0b' },
  { id: 'i4', name: 'Tesouro Selic 2028', ticker: 'SELIC', type: 'Renda F.', quantity: 5, avgPrice: 14200, currentPrice: 14890, color: '#3b82f6' },
  { id: 'i5', name: 'IVVB11', ticker: 'IVVB11', type: 'FII/ETF', quantity: 30, avgPrice: 280, currentPrice: 295, color: '#ec4899' },
]

const INITIAL_SETTINGS = {
  name: 'Paulo Ramos',
  email: 'paulo@eazyfinance.com',
  initials: 'PR',
  currency: 'BRL',
  notifications: true,
  weeklyReport: true,
  language: 'pt-BR',
  theme: 'light',
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null)

let _nextId = 200
const uid = () => `id_${++_nextId}_${Date.now()}`

export function AppProvider({ children }) {
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
  const [wallets, setWallets] = useState(INITIAL_WALLETS)
  const [budgets, setBudgets] = useState(INITIAL_BUDGETS)
  const [goals, setGoals] = useState(INITIAL_GOALS)
  const [investments, setInvestments] = useState(INITIAL_INVESTMENTS)
  const [settings, setSettings] = useState(INITIAL_SETTINGS)

  // ── Computed ───────────────────────────────────────────────────────────────

  const now = new Date()
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const thisMonth = fmt(now)
  const lastMonth = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  const validTx = transactions.filter(t => t.status !== 'failed')
  const txThis = validTx.filter(t => t.date.startsWith(thisMonth))
  const txLast = validTx.filter(t => t.date.startsWith(lastMonth))

  const sumIncome = (txs) => txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const sumExpenses = (txs) => txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const monthlyIncome = sumIncome(txThis)
  const monthlyExpenses = sumExpenses(txThis)
  const monthlySavings = monthlyIncome - monthlyExpenses
  const lastIncome = sumIncome(txLast)
  const lastExpenses = sumExpenses(txLast)
  const lastSavings = lastIncome - lastExpenses
  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0)
  const pendingCount = transactions.filter(t => t.status === 'pending').length

  const pctChange = (curr, prev) =>
    prev === 0 ? 0 : +(((curr - prev) / prev) * 100).toFixed(1)

  const spendingByCategory = txThis
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc }, {})

  // Monthly data for charts (last 6 months)
  const monthlyChartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = fmt(d)
    const label = d.toLocaleString('pt-BR', { month: 'short' })
    const txs = validTx.filter(t => t.date.startsWith(key))
    return { key, label, income: sumIncome(txs), expenses: sumExpenses(txs) }
  })

  // ── Transactions ───────────────────────────────────────────────────────────

  const addTransaction = (data) =>
    setTransactions(prev => [{ ...data, id: uid() }, ...prev])

  const updateTransaction = (id, data) =>
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))

  const deleteTransaction = (id) =>
    setTransactions(prev => prev.filter(t => t.id !== id))

  const bulkDeleteTransactions = (ids) =>
    setTransactions(prev => prev.filter(t => !ids.includes(t.id)))

  // ── Wallets ────────────────────────────────────────────────────────────────

  const addWallet = (data) =>
    setWallets(prev => [...prev, { ...data, id: uid() }])

  const updateWallet = (id, data) =>
    setWallets(prev => prev.map(w => w.id === id ? { ...w, ...data } : w))

  const deleteWallet = (id) =>
    setWallets(prev => prev.filter(w => w.id !== id))

  // ── Budgets ────────────────────────────────────────────────────────────────

  const addBudget = (data) =>
    setBudgets(prev => [...prev, { ...data, id: uid() }])

  const updateBudget = (id, data) =>
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...data } : b))

  const deleteBudget = (id) =>
    setBudgets(prev => prev.filter(b => b.id !== id))

  // ── Goals ──────────────────────────────────────────────────────────────────

  const addGoal = (data) =>
    setGoals(prev => [...prev, { ...data, id: uid(), current: Number(data.current) || 0 }])

  const updateGoal = (id, data) =>
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...data } : g))

  const deleteGoal = (id) =>
    setGoals(prev => prev.filter(g => g.id !== id))

  const contributeGoal = (id, amount) =>
    setGoals(prev => prev.map(g =>
      g.id === id ? { ...g, current: Math.min(g.current + Number(amount), g.target) } : g
    ))

  // ── Investments ────────────────────────────────────────────────────────────

  const addInvestment = (data) =>
    setInvestments(prev => [...prev, { ...data, id: uid() }])

  const updateInvestment = (id, data) =>
    setInvestments(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))

  const deleteInvestment = (id) =>
    setInvestments(prev => prev.filter(i => i.id !== id))

  // ── Settings ───────────────────────────────────────────────────────────────

  const updateSettings = (data) =>
    setSettings(prev => ({ ...prev, ...data }))

  const toggleTheme = () =>
    setSettings(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))

  // ── Value ──────────────────────────────────────────────────────────────────

  return (
    <AppContext.Provider value={{
      transactions, wallets, budgets, goals, investments, settings,
      totalBalance, monthlyIncome, monthlyExpenses, monthlySavings,
      lastIncome, lastExpenses, lastSavings, pendingCount,
      spendingByCategory, monthlyChartData, thisMonth,
      pctChange,
      addTransaction, updateTransaction, deleteTransaction, bulkDeleteTransactions,
      addWallet, updateWallet, deleteWallet,
      addBudget, updateBudget, deleteBudget,
      addGoal, updateGoal, deleteGoal, contributeGoal,
      addInvestment, updateInvestment, deleteInvestment,
      updateSettings, toggleTheme,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
