import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { db } from '../firebase'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch,
} from 'firebase/firestore'

// ─── Static config ────────────────────────────────────────────────────────────

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

export function CatIcon({ category, style }) {
  const cls = CATEGORY_ICONS[category] || 'fi-rr-box'
  return <i className={`fi ${cls}`} style={style} />
}

// ─── Firestore collection map ─────────────────────────────────────────────────
// transactions → 'transactions'
// wallets      → 'accounts'
// budgets      → 'userRules'
// goals        → 'goals'
// investments  → 'challenges'

const COL = {
  transactions: 'transactions',
  wallets:      'accounts',
  budgets:      'userRules',
  goals:        'goals',
  investments:  'challenges',
}

// ─── Default wallets (seed on first login) ────────────────────────────────────

const DEFAULT_WALLETS = [
  { name: 'Conta Corrente', type: 'checking',   balance: 0, color: '#0F4D3F', icon: '🏦' },
  { name: 'Poupança',       type: 'savings',    balance: 0, color: '#B9E66A', icon: '🐷' },
  { name: 'Investimentos',  type: 'investment', balance: 0, color: '#F5C842', icon: '📈' },
]

// ─── Settings helpers ─────────────────────────────────────────────────────────

const PREF_DEFAULTS = { currency: 'BRL', notifications: true, weeklyReport: true, language: 'pt-BR', theme: 'light' }

const loadPrefs = (uid) =>
  JSON.parse(localStorage.getItem(`prefs_${uid}`) || 'null') || PREF_DEFAULTS

const savePrefs = (uid, prefs) =>
  localStorage.setItem(`prefs_${uid}`, JSON.stringify(prefs))

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { user } = useAuth()

  const [transactions, setTransactions] = useState([])
  const [wallets,      setWallets]      = useState([])
  const [budgets,      setBudgets]      = useState([])
  const [goals,        setGoals]        = useState([])
  const [investments,  setInvestments]  = useState([])
  const [settings,     setSettings]     = useState(PREF_DEFAULTS)
  const [dbLoading,    setDbLoading]    = useState(true)

  // ── Load settings from localStorage ───────────────────────────────────────

  useEffect(() => {
    if (!user) return
    const prefs = loadPrefs(user.uid)
    setSettings({
      ...prefs,
      name:     user.displayName || user.email?.split('@')[0] || 'Usuário',
      email:    user.email || '',
      initials: (user.displayName || user.email || 'U').slice(0, 2).toUpperCase(),
    })
  }, [user?.uid])

  // ── Subscribe to Firestore collections ────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setTransactions([]); setWallets([]); setBudgets([])
      setGoals([]); setInvestments([]); setDbLoading(false)
      return
    }

    setDbLoading(true)
    const uid = user.uid
    const userQuery = (col) => query(collection(db, col), where('allowedUsers', 'array-contains', uid))

    let walletsReady = false
    const readyCb = () => { if (walletsReady) setDbLoading(false) }

    const unsubs = [
      onSnapshot(userQuery(COL.transactions), snap =>
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(userQuery(COL.wallets), async snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setWallets(data)
        // Seed default wallets for brand-new users
        if (data.length === 0 && !localStorage.getItem(`seeded_${uid}`)) {
          localStorage.setItem(`seeded_${uid}`, '1')
          const batch = writeBatch(db)
          DEFAULT_WALLETS.forEach(w =>
            batch.set(doc(collection(db, COL.wallets)), {
              ...w, userId: uid, allowedUsers: [uid], createdAt: serverTimestamp(),
            })
          )
          await batch.commit()
        }
        walletsReady = true; readyCb()
      }),
      onSnapshot(userQuery(COL.budgets),      snap => setBudgets(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(userQuery(COL.goals),        snap => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(userQuery(COL.investments),  snap => setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ]

    return () => unsubs.forEach(u => u())
  }, [user?.uid])

  // ── Base doc fields ────────────────────────────────────────────────────────

  const base = (data) => ({
    ...data,
    userId:       user.uid,
    allowedUsers: [user.uid],
    createdAt:    serverTimestamp(),
  })

  // ── Computed ───────────────────────────────────────────────────────────────

  const now   = new Date()
  const fmt   = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const thisMonth = fmt(now)
  const lastMonth = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  const validTx   = transactions.filter(t => t.status !== 'failed')
  const txThis    = validTx.filter(t => t.date?.startsWith(thisMonth))
  const txLast    = validTx.filter(t => t.date?.startsWith(lastMonth))

  const sumIncome   = (txs) => txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const sumExpenses = (txs) => txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const monthlyIncome   = sumIncome(txThis)
  const monthlyExpenses = sumExpenses(txThis)
  const monthlySavings  = monthlyIncome - monthlyExpenses
  const lastIncome      = sumIncome(txLast)
  const lastExpenses    = sumExpenses(txLast)
  const lastSavings     = lastIncome - lastExpenses
  const totalBalance    = wallets.reduce((s, w) => s + (w.balance || 0), 0)
  const pendingCount    = transactions.filter(t => t.status === 'pending').length

  const pctChange = (curr, prev) =>
    prev === 0 ? 0 : +(((curr - prev) / prev) * 100).toFixed(1)

  const spendingByCategory = txThis
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc }, {})

  const monthlyChartData = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = fmt(d)
    const txs = validTx.filter(t => t.date?.startsWith(key))
    return { key, label: d.toLocaleString('pt-BR', { month: 'short' }), income: sumIncome(txs), expenses: sumExpenses(txs) }
  })

  // ── Transactions ───────────────────────────────────────────────────────────

  const addTransaction = (data) =>
    addDoc(collection(db, COL.transactions), base(data))

  const updateTransaction = (id, data) =>
    updateDoc(doc(db, COL.transactions, id), data)

  const deleteTransaction = (id) =>
    deleteDoc(doc(db, COL.transactions, id))

  const bulkDeleteTransactions = async (ids) => {
    const batch = writeBatch(db)
    ids.forEach(id => batch.delete(doc(db, COL.transactions, id)))
    await batch.commit()
  }

  // ── Wallets ────────────────────────────────────────────────────────────────

  const addWallet = (data) =>
    addDoc(collection(db, COL.wallets), base(data))

  const updateWallet = (id, data) =>
    updateDoc(doc(db, COL.wallets, id), data)

  const deleteWallet = (id) =>
    deleteDoc(doc(db, COL.wallets, id))

  // ── Budgets ────────────────────────────────────────────────────────────────

  const addBudget = (data) =>
    addDoc(collection(db, COL.budgets), base(data))

  const updateBudget = (id, data) =>
    updateDoc(doc(db, COL.budgets, id), data)

  const deleteBudget = (id) =>
    deleteDoc(doc(db, COL.budgets, id))

  // ── Goals ──────────────────────────────────────────────────────────────────

  const addGoal = (data) =>
    addDoc(collection(db, COL.goals), base({ ...data, current: Number(data.current) || 0 }))

  const updateGoal = (id, data) =>
    updateDoc(doc(db, COL.goals, id), data)

  const deleteGoal = (id) =>
    deleteDoc(doc(db, COL.goals, id))

  const contributeGoal = async (id, amount) => {
    const goal = goals.find(g => g.id === id)
    if (!goal) return
    await updateDoc(doc(db, COL.goals, id), {
      current: Math.min(goal.current + Number(amount), goal.target),
    })
  }

  // ── Investments ────────────────────────────────────────────────────────────

  const addInvestment = (data) =>
    addDoc(collection(db, COL.investments), base(data))

  const updateInvestment = (id, data) =>
    updateDoc(doc(db, COL.investments, id), data)

  const deleteInvestment = (id) =>
    deleteDoc(doc(db, COL.investments, id))

  // ── Settings ───────────────────────────────────────────────────────────────

  const updateSettings = (data) => {
    setSettings(prev => {
      const next = { ...prev, ...data }
      const { name, email, initials, ...prefs } = next
      savePrefs(user.uid, prefs)
      return next
    })
  }

  const toggleTheme = () =>
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })

  // ── Value ──────────────────────────────────────────────────────────────────

  return (
    <AppContext.Provider value={{
      transactions, wallets, budgets, goals, investments, settings, dbLoading,
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
