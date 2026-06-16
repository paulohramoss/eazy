import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { db } from '../firebase'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { notify } from '../notifications'
import { WALLET_TYPE_ICONS } from '../utils/walletIcons'

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
  wallets:      'wallets',
  budgets:      'budgets',
  goals:        'goals',
  investments:  'investments',
  creditCards:  'creditCards',
  alerts:       'alerts',
  users:        'users',
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

const PREF_DEFAULTS = {
  currency: 'BRL', language: 'pt-BR', theme: 'light',
  // canais
  pushEnabled: false,
  emailEnabled: false, emailAddress: '',
  smsEnabled: false,   smsPhone: '',
  // transações
  notifNewTransaction: true,
  notifPendingTransaction: true,
  notifLargeExpense: false, notifLargeExpenseThreshold: '500',
  // cartão de crédito
  notifCardNearLimit: true,
  notifCardLimitReached: true,
  notifCardClosingDay: false,
  notifCardDueDay: true,
  // planejamento
  notifBudgetNearLimit: true,
  notifBudgetExceeded: true,
  notifGoalReached: true,
  notifGoalReminder: false,
  // relatórios
  notifWeeklyReport: false,
  notifMonthlyReport: true,
  // legado (mantido para compatibilidade)
  notifications: true, weeklyReport: false,
}

// biometricEnabled stays device-local (credential registered per-device)
const loadBiometric = (uid) => !!(JSON.parse(localStorage.getItem(`bio_${uid}`) || 'false'))
const saveBiometric = (uid, val) => localStorage.setItem(`bio_${uid}`, JSON.stringify(!!val))

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { user } = useAuth()

  const [transactions, setTransactions] = useState([])
  const [wallets,      setWallets]      = useState([])
  const [budgets,      setBudgets]      = useState([])
  const [goals,        setGoals]        = useState([])
  const [investments,  setInvestments]  = useState([])
  const [creditCards,  setCreditCards]  = useState([])
  const [alerts,       setAlerts]       = useState([])
  const [settings,     setSettings]     = useState(PREF_DEFAULTS)
  const [categories,   setCategories]   = useState(CATEGORIES)
  const [dbLoading,    setDbLoading]    = useState(true)

  // ── Subscribe to Firestore collections ────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setTransactions([]); setWallets([]); setBudgets([])
      setGoals([]); setInvestments([]); setCreditCards([]); setAlerts([])
      setSettings(PREF_DEFAULTS); setCategories(CATEGORIES)
      setDbLoading(false)
      return
    }

    setDbLoading(true)
    const uid = user.uid
    const userQuery = (col) => query(collection(db, col), where('allowedUsers', 'array-contains', uid))
    const authDisplay = {
      name:     user.displayName || user.email?.split('@')[0] || 'Usuário',
      email:    user.email || '',
      initials: (user.displayName || user.email || 'U').slice(0, 2).toUpperCase(),
    }

    let walletsReady = false
    let userDocReady = false
    const readyCb = () => { if (walletsReady && userDocReady) setDbLoading(false) }

    const userDocRef = doc(db, COL.users, uid)

    const unsubs = [
      // User preferences & categories — source of truth in Firestore
      onSnapshot(userDocRef, snap => {
        if (snap.exists()) {
          const { prefs = {}, categories: cats } = snap.data()
          setSettings({
            ...PREF_DEFAULTS,
            ...prefs,
            ...authDisplay,
            biometricEnabled: loadBiometric(uid),
          })
          setCategories(Array.isArray(cats) && cats.length ? cats : CATEGORIES)
        } else {
          // Migrate from localStorage if coming from an older session, then delete local copies
          const localPrefs = JSON.parse(localStorage.getItem(`prefs_${uid}`) || 'null') || {}
          const localCats  = JSON.parse(localStorage.getItem(`categories_${uid}`) || 'null') || CATEGORIES
          const { biometricEnabled, name, email, initials, ...serializablePrefs } = localPrefs
          if (biometricEnabled) saveBiometric(uid, true)
          setDoc(userDocRef, {
            prefs: { ...PREF_DEFAULTS, ...serializablePrefs },
            categories: localCats,
            createdAt: serverTimestamp(),
          }).then(() => {
            localStorage.removeItem(`prefs_${uid}`)
            localStorage.removeItem(`categories_${uid}`)
          }).catch(console.error)
          // onSnapshot fires again once the doc is written, hydrating state then
        }
        userDocReady = true; readyCb()
      }),

      onSnapshot(userQuery(COL.transactions), snap =>
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(userQuery(COL.wallets), snap => {
        setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        walletsReady = true; readyCb()
      }),
      onSnapshot(userQuery(COL.budgets),      snap => setBudgets(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(userQuery(COL.goals),        snap => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(userQuery(COL.investments),  snap => setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(userQuery(COL.creditCards),  snap => setCreditCards(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(userQuery(COL.alerts),       snap => setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ]

    return () => unsubs.forEach(u => u())
  }, [user?.uid])

  // ── Auto-complete pending transactions ─────────────────────────────────────
  useEffect(() => {
    if (!transactions || transactions.length === 0) return
    const todayStr = new Date().toISOString().split('T')[0]
    const toComplete = transactions.filter(t => t.status === 'pending' && t.date && t.date <= todayStr)

    if (toComplete.length > 0) {
      const batch = writeBatch(db)
      toComplete.forEach(t => {
        batch.update(doc(db, COL.transactions, t.id), { status: 'completed' })
      })
      batch.commit().catch(console.error)
    }
  }, [transactions])

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

  // Retorna a data de início do ciclo de faturamento atual do cartão
  const getCardCycleStart = (closingDay) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const day = today.getDate()
    const y = today.getFullYear()
    const m = today.getMonth()
    return day >= closingDay
      ? new Date(y, m, closingDay)
      : new Date(y, m - 1, closingDay)
  }

  // Retorna o total gasto no ciclo atual de um cartão
  const getCardCurrentUsed = (cardId) => {
    const card = creditCards.find(c => c.id === cardId)
    if (!card) return 0
    const cycleStart = getCardCycleStart(card.closingDay || 1)
    return validTx
      .filter(t => t.cardId === cardId && t.type === 'expense')
      .filter(t => {
        if (!t.date) return false
        return new Date(t.date + 'T00:00:00') >= cycleStart
      })
      .reduce((s, t) => s + (t.amount || 0), 0)
  }
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
  const pendingCount    = transactions.filter(t => t.status === 'pending').length

  // Saldo real = saldo inicial + receitas − despesas de cada carteira
  const walletBalances = wallets.reduce((acc, w) => {
    const income   = validTx.filter(t => t.walletId === w.id && t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = validTx.filter(t => t.walletId === w.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    acc[w.id] = (w.balance || 0) + income - expenses
    return acc
  }, {})

  const totalBalance = Object.values(walletBalances).reduce((s, b) => s + b, 0)

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

  // ── Notification helpers ───────────────────────────────────────────────────

  const checkBudgetNotify = (category, addedAmount, status) => {
    if (status === 'failed') return
    const budget = budgets.find(b => b.category === category)
    if (!budget) return
    const currentSpend = validTx
      .filter(t => t.type === 'expense' && t.category === category && t.date?.startsWith(thisMonth))
      .reduce((s, t) => s + t.amount, 0)
    const projected = currentSpend + addedAmount
    const pct = budget.limit > 0 ? Math.round((projected / budget.limit) * 100) : 0
    if (projected > budget.limit) {
      notify({ type: 'budget_over', data: { category, pct }, settings })
    } else if (pct >= 80) {
      notify({ type: 'budget_near', data: { category, pct }, settings })
    }
  }

  const checkCardNotify = (cardId, addedAmount, type, status) => {
    if (type !== 'expense' || status === 'failed' || !cardId) return
    const card = creditCards.find(c => c.id === cardId)
    if (!card?.limit) return
    const projected = getCardCurrentUsed(cardId) + addedAmount
    const pct = Math.round((projected / card.limit) * 100)
    if (projected >= card.limit) {
      notify({ type: 'card_limit', data: { cardName: card.name, limit: card.limit }, settings })
    } else if (pct >= 80) {
      notify({ type: 'card_near', data: { cardName: card.name, pct, available: card.limit - projected }, settings })
    }
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  const addMultipleTransactions = async (data, mode, count) => {
    const batch = writeBatch(db)
    const baseDate = new Date(data.date + 'T12:00:00')
    const totalAmount = data.amount
    const perInstallment = mode === 'installment' ? Number((totalAmount / count).toFixed(2)) : totalAmount

    let remainder = 0
    if (mode === 'installment') {
      const sum = perInstallment * count
      remainder = totalAmount - sum
    }

    for (let i = 0; i < count; i++) {
      const txDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate(), 12, 0, 0)
      if (txDate.getMonth() !== (baseDate.getMonth() + i) % 12) {
        txDate.setDate(0)
      }
      
      const dateStr = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-${String(txDate.getDate()).padStart(2, '0')}`
      
      let amount = perInstallment
      if (i === 0 && mode === 'installment') amount += remainder

      let name = data.name
      if (mode === 'installment' || mode === 'recurring') name = `${data.name} (${i + 1}/${count})`

      const txData = {
        ...data,
        amount: Number(amount.toFixed(2)),
        date: dateStr,
        name
      }
      
      const docRef = doc(collection(db, COL.transactions))
      batch.set(docRef, base(txData))
    }

    await batch.commit()

    notify({ type: 'transaction', data: { name: data.name, amount: data.amount, txType: data.type, category: data.category }, settings })

    if (data.type === 'expense') {
      // Para parceladas/recorrentes verifica só o impacto da 1ª parcela no mês atual
      const firstAmount = mode === 'installment' ? perInstallment : data.amount
      checkBudgetNotify(data.category, firstAmount, data.status)
      checkCardNotify(data.cardId, firstAmount, data.type, data.status)
    }
  }

  const addTransaction = async (data) => {
    const ref = await addDoc(collection(db, COL.transactions), base(data))

    // Notificação: nova transação
    notify({ type: 'transaction', data: { name: data.name, amount: data.amount, txType: data.type, category: data.category }, settings })

    // Notificação: transação pendente
    if (data.status === 'pending') {
      notify({ type: 'transaction_pending', data: { name: data.name, amount: data.amount }, settings })
    }

    // Notificação: despesa acima do threshold
    if (data.type === 'expense' && settings.notifLargeExpense) {
      const threshold = Number(settings.notifLargeExpenseThreshold) || 500
      if (Number(data.amount) >= threshold) {
        notify({ type: 'large_expense', data: { name: data.name, amount: data.amount }, settings })
      }
    }

    if (data.type === 'expense') {
      checkBudgetNotify(data.category, data.amount, data.status)
      checkCardNotify(data.cardId, data.amount, data.type, data.status)
    }

    return ref
  }

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
    const newCurrent = Math.min(goal.current + Number(amount), goal.target)
    await updateDoc(doc(db, COL.goals, id), { current: newCurrent })
    if (newCurrent >= goal.target) {
      notify({ type: 'goal_reached', data: { goalName: goal.name, amount: goal.target }, settings })
    }
  }

  // ── Investments ────────────────────────────────────────────────────────────

  const addInvestment = (data) =>
    addDoc(collection(db, COL.investments), base(data))

  const updateInvestment = (id, data) =>
    updateDoc(doc(db, COL.investments, id), data)

  const deleteInvestment = (id) =>
    deleteDoc(doc(db, COL.investments, id))

  // ── Credit Cards ───────────────────────────────────────────────────────────

  const addCreditCard = (data) =>
    addDoc(collection(db, COL.creditCards), base(data))

  const updateCreditCard = (id, data) =>
    updateDoc(doc(db, COL.creditCards, id), data)

  const deleteCreditCard = (id) =>
    deleteDoc(doc(db, COL.creditCards, id))

  // ── Alerts ─────────────────────────────────────────────────────────────────

  const addAlert = (data) =>
    addDoc(collection(db, COL.alerts), base(data))

  const updateAlert = (id, data) =>
    updateDoc(doc(db, COL.alerts, id), data)

  const deleteAlert = (id) =>
    deleteDoc(doc(db, COL.alerts, id))

  const alertsDueCount = alerts.filter(a => {
    if (a.paid) return false
    const today = new Date()
    const due = new Date(a.dueDate + 'T12:00:00')
    const diff = (due - today) / (1000 * 60 * 60 * 24)
    return diff <= 3
  }).length

  // ── Export / Import ────────────────────────────────────────────────────────

  const _download = (content, filename, mime) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    Object.assign(document.createElement('a'), { href: url, download: filename }).click()
    URL.revokeObjectURL(url)
  }

  const exportJSON = () => {
    const strip = arr => arr.map(({ id, userId, allowedUsers, createdAt, ...rest }) => rest)
    _download(
      JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(),
        transactions: strip(transactions), wallets: strip(wallets), budgets: strip(budgets),
        goals: strip(goals), investments: strip(investments), creditCards: strip(creditCards),
      }, null, 2),
      `eazy-backup-${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    )
  }

  const exportCSV = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Data','Descrição','Tipo','Categoria','Valor','Status','Carteira','Observações']
    const rows = [...transactions]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(t => [
        t.date || '', t.name || '',
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.category || '', t.amount ?? 0,
        t.status === 'completed' ? 'Concluído' : 'Pendente',
        wallets.find(w => w.id === t.walletId)?.name || '',
        t.notes || '',
      ])
    _download(
      '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\n'),
      `eazy-transacoes-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv;charset=utf-8'
    )
  }

  const importJSON = async (file) => {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!data.version || !Array.isArray(data.transactions)) throw new Error('Arquivo inválido ou corrompido')
    const batch = writeBatch(db)
    const push = (items, col) => items?.forEach(item => batch.set(doc(collection(db, col)), base(item)))
    push(data.transactions, COL.transactions)
    push(data.wallets,      COL.wallets)
    push(data.budgets,      COL.budgets)
    push(data.goals,        COL.goals)
    push(data.investments,  COL.investments)
    push(data.creditCards,  COL.creditCards)
    await batch.commit()
    return data.transactions?.length ?? 0
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  const updateSettings = (data) => {
    setSettings(prev => {
      const next = { ...prev, ...data }
      const { name, email, initials, biometricEnabled, ...prefs } = next
      // biometricEnabled is device-local — never written to Firestore
      if ('biometricEnabled' in data) saveBiometric(user.uid, biometricEnabled)
      updateDoc(doc(db, COL.users, user.uid), { prefs }).catch(console.error)
      return next
    })
  }

  const toggleTheme = () =>
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })

  const addCategory = (name) => {
    const trimmed = name.trim()
    if (!trimmed || categories.includes(trimmed)) return
    const next = [...categories, trimmed]
    setCategories(next)
    updateDoc(doc(db, COL.users, user.uid), { categories: next }).catch(console.error)
  }

  const removeCategory = (name) => {
    const next = categories.filter(c => c !== name)
    setCategories(next)
    updateDoc(doc(db, COL.users, user.uid), { categories: next }).catch(console.error)
  }

  // ── Value ──────────────────────────────────────────────────────────────────

  return (
    <AppContext.Provider value={{
      transactions, wallets, budgets, goals, investments, creditCards, alerts, alertsDueCount,
      settings, categories, dbLoading,
      totalBalance, walletBalances, monthlyIncome, monthlyExpenses, monthlySavings,
      lastIncome, lastExpenses, lastSavings, pendingCount,
      spendingByCategory, monthlyChartData, thisMonth,
      pctChange, getCardCurrentUsed,
      addTransaction, addMultipleTransactions, updateTransaction, deleteTransaction, bulkDeleteTransactions,
      addWallet, updateWallet, deleteWallet,
      addBudget, updateBudget, deleteBudget,
      addGoal, updateGoal, deleteGoal, contributeGoal,
      addInvestment, updateInvestment, deleteInvestment,
      addCreditCard, updateCreditCard, deleteCreditCard,
      addAlert, updateAlert, deleteAlert,
      updateSettings, toggleTheme, addCategory, removeCategory,
      exportJSON, exportCSV, importJSON,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
