import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { addMonths, advance, isoDate } from '../utils/date'
import { splitInstallments } from '../utils/installments'
import { normalizeDate, parseAmount, parseCSV } from '../utils/csv'
import { cacheLanguage, createFormatters, createTranslator } from '../i18n'
import { walletStats } from '../utils/balances'
import { db } from '../firebase'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { notify } from '../notifications'
import { WALLET_TYPE_ICONS } from '../utils/walletIcons'

// ─── Static config ────────────────────────────────────────────────────────────

// Categoria usada pelos aportes em objetivos. Quem já tem categorias salvas no
// Firestore não recebe a lista nova, então contributeGoal garante a inclusão.
export const GOAL_CATEGORY = 'Objetivos'

export const CATEGORIES = [
  'Salário', 'Freelance', 'Investimentos', 'Outros Rendimentos',
  'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer',
  'Educação', 'Vestuário', 'Tecnologia', GOAL_CATEGORY, 'Outros',
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
  'Objetivos':         'fi-rr-bullseye',
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
  recurrences:  'recurrences',
  users:        'users',
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

const PREF_DEFAULTS = {
  currency: 'BRL', language: 'pt-BR', theme: 'system',
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

// ─── Pure helpers (no closures over component state — safe to hoist) ─────────

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const sumIncome   = (txs) => txs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
const sumExpenses = (txs) => txs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
const pctChange   = (curr, prev) => prev === 0 ? 0 : +(((curr - prev) / prev) * 100).toFixed(1)

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

// ─── Context ──────────────────────────────────────────────────────────────────

// Exportado para a página de preview (preview.html) poder injetar dados de
// exemplo sem Firebase. O app real nunca usa o Provider diretamente.
export const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { user } = useAuth()
  // Só o uid entra nas dependências do efeito de subscription: o objeto `user`
  // troca de identidade a cada refresh de token, e depender dele religaria as
  // sete listeners do Firestore sem necessidade.
  const uid = user?.uid

  const [transactions, setTransactions] = useState([])
  const [wallets,      setWallets]      = useState([])
  const [budgets,      setBudgets]      = useState([])
  const [goals,        setGoals]        = useState([])
  const [investments,  setInvestments]  = useState([])
  const [creditCards,  setCreditCards]  = useState([])
  const [alerts,       setAlerts]       = useState([])
  const [recurrences,  setRecurrences]  = useState([])
  // Guarda só o que vem do Firestore. Nome/e-mail/iniciais são derivados do
  // objeto de auth logo abaixo — misturá-los aqui obrigava o efeito de
  // subscription a depender do `user` inteiro e a religar as sete listeners a
  // cada refresh de token.
  const [rawSettings,  setRawSettings]  = useState(PREF_DEFAULTS)
  const [systemDark,   setSystemDark]   = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  const [categories,   setCategories]   = useState(CATEGORIES)
  const [dbLoading,    setDbLoading]    = useState(() => !!user)
  const [dbError,      setDbError]      = useState('')
  // addWallet confirmado pelo servidor. O gate do Onboarding depende de
  // wallets.length, alimentado só pelo onSnapshot — se o listener falhar
  // (regra negada, rede), a tela nunca sairia mesmo com a carteira gravada.
  const [walletCreated, setWalletCreated] = useState(false)

  // ── Subscribe to Firestore collections ────────────────────────────────────

  useEffect(() => {
    // Sem usuário não há nada a assinar. O estado não precisa ser limpo aqui:
    // o App monta o AppProvider com key={uid}, então trocar de conta (ou sair)
    // desmonta o provider inteiro e nada da conta anterior sobrevive. Limpar
    // via setState dentro do efeito só provocava renders em cascata.
    if (!uid) return

    // dbLoading já nasce true quando há usuário e dbError já nasce vazio; como
    // o provider é remontado por key={uid}, este efeito roda uma vez por conta
    // e não precisa reinicializar nada — fazê-lo aqui só custava um render.
    const userQuery = (col) => query(collection(db, col), where('allowedUsers', 'array-contains', uid))

    let walletsReady = false
    let userDocReady = false
    const readyCb = () => { if (walletsReady && userDocReady) setDbLoading(false) }

    const userDocRef = doc(db, COL.users, uid)

    // Sem isso, um erro no listener (regra negada, rede instável etc.) deixa
    // walletsReady/userDocReady travados em false pra sempre — dbLoading nunca
    // vira false, e o gate do Onboarding (!dbLoading && wallets.length===0)
    // nunca chega a avaliar. Erro também precisa liberar o "ready".
    const onSnapError = (label) => (err) => {
      console.error(`[Firestore:${label}]`, err)
      setDbError(`${label}: ${err?.code || err?.message || String(err)}`)
    }

    const unsubs = [
      // User preferences & categories — source of truth in Firestore
      onSnapshot(userDocRef, snap => {
        if (snap.exists()) {
          const { prefs = {}, categories: cats } = snap.data()
          setRawSettings({
            ...PREF_DEFAULTS,
            ...prefs,
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
      }, err => { onSnapError('users')(err); userDocReady = true; readyCb() }),

      onSnapshot(userQuery(COL.transactions), snap =>
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      onSnapError('transactions')),
      onSnapshot(userQuery(COL.wallets), snap => {
        setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        walletsReady = true; readyCb()
      }, err => { onSnapError('wallets')(err); walletsReady = true; readyCb() }),
      onSnapshot(userQuery(COL.budgets),      snap => setBudgets(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onSnapError('budgets')),
      onSnapshot(userQuery(COL.goals),        snap => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onSnapError('goals')),
      onSnapshot(userQuery(COL.investments),  snap => setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onSnapError('investments')),
      onSnapshot(userQuery(COL.creditCards),  snap => setCreditCards(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onSnapError('creditCards')),
      onSnapshot(userQuery(COL.alerts),       snap => setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onSnapError('alerts')),
      onSnapshot(userQuery(COL.recurrences),  snap => setRecurrences(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onSnapError('recurrences')),
    ]

    return () => unsubs.forEach(u => u())
  }, [uid])

  // ── Identidade vinda do auth (não persistida em prefs) ─────────────────────

  const authDisplay = useMemo(() => ({
    name:     user?.displayName || user?.email?.split('@')[0] || 'Usuário',
    email:    user?.email || '',
    initials: (user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase(),
  }), [user?.displayName, user?.email])

  const settings = useMemo(
    () => ({ ...rawSettings, ...authDisplay }),
    [rawSettings, authDisplay])

  // ── Auto-complete pending transactions ─────────────────────────────────────
  // Uma transação pendente cuja data já chegou vira concluída.
  //
  // Antes isto rodava a cada mudança em `transactions` — e como o próprio batch
  // muda `transactions`, o efeito se realimentava. Terminava porque o filtro
  // esvaziava, mas gastava escritas à toa e ficava a um bug de distância de um
  // laço infinito. Agora cada id só é processado uma vez por sessão, e o efeito
  // reavalia de hora em hora para pegar a virada do dia com o app aberto.
  const completedRef = useRef(new Set())
  const [dayTick, setDayTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setDayTick(tx => tx + 1), 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!user || !transactions.length) return

    const todayStr = isoDate()
    const toComplete = transactions.filter(tx =>
      tx.status === 'pending' && tx.date && tx.date <= todayStr && !completedRef.current.has(tx.id))

    if (!toComplete.length) return

    toComplete.forEach(tx => completedRef.current.add(tx.id))

    const batch = writeBatch(db)
    toComplete.forEach(tx => batch.update(doc(db, COL.transactions, tx.id), { status: 'completed' }))
    batch.commit().catch(err => {
      // A escrita falhou: solta os ids para uma próxima tentativa não ficar
      // bloqueada pelo registro otimista acima.
      toComplete.forEach(tx => completedRef.current.delete(tx.id))
      console.error('[auto-complete]', err)
    })
  }, [transactions, user, dayTick])

  // ── Base doc fields ────────────────────────────────────────────────────────

  const base = useCallback((data) => ({
    ...data,
    userId:       user.uid,
    allowedUsers: [user.uid],
    createdAt:    serverTimestamp(),
  }), [user])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = e => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // ── Currency (settings.currency é a fonte da verdade — não hardcoded) ───────

  // Formatadores derivados do idioma E da moeda. Antes o locale estava fixo em
  // 'pt-BR' aqui e em mais uma dúzia de pontos, então quem escolhia USD via
  // "US$ 1.234,56": símbolo americano com agrupamento brasileiro.
  const i18n = useMemo(
    () => createFormatters(settings.language, settings.currency || 'BRL'),
    [settings.language, settings.currency])

  const t = useMemo(() => createTranslator(settings.language), [settings.language])

  // Cache local do idioma: a tela de login roda fora deste provider e precisa
  // saber em que língua se apresentar antes de haver usuário.
  useEffect(() => { cacheLanguage(settings.language) }, [settings.language])

  const { formatCurrency, currencySymbol, formatNumber, formatDate, formatLongDate } = i18n

  // ── Computed ───────────────────────────────────────────────────────────────

  const now   = new Date()
  const today = isoDate(now)
  const thisMonth = fmt(now)
  const lastMonth = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  const validTx = useMemo(() => transactions.filter(tx => tx.status !== 'failed'), [transactions])

  // Retorna o total gasto no ciclo atual de um cartão
  const getCardCurrentUsed = useCallback((cardId) => {
    const card = creditCards.find(c => c.id === cardId)
    if (!card) return 0
    const cycleStart = getCardCycleStart(card.closingDay || 1)
    return validTx
      .filter(tx => tx.cardId === cardId && tx.type === 'expense')
      .filter(tx => {
        if (!tx.date) return false
        return new Date(tx.date + 'T00:00:00') >= cycleStart
      })
      .reduce((s, tx) => s + (tx.amount || 0), 0)
  }, [creditCards, validTx])

  const txThis = useMemo(() => validTx.filter(tx => tx.date?.startsWith(thisMonth)), [validTx, thisMonth])
  const txLast = useMemo(() => validTx.filter(tx => tx.date?.startsWith(lastMonth)), [validTx, lastMonth])

  const monthlyIncome   = useMemo(() => sumIncome(txThis), [txThis])
  const monthlyExpenses = useMemo(() => sumExpenses(txThis), [txThis])
  const monthlySavings  = monthlyIncome - monthlyExpenses
  const lastIncome      = useMemo(() => sumIncome(txLast), [txLast])
  const lastExpenses    = useMemo(() => sumExpenses(txLast), [txLast])
  const lastSavings     = lastIncome - lastExpenses
  const pendingCount    = useMemo(() => transactions.filter(tx => tx.status === 'pending').length, [transactions])

  const walletStatsAsOf = useCallback(
    (cutoff) => walletStats(wallets, validTx, cutoff), [wallets, validTx])

  // Saldo de hoje — não conta parcela nem recorrência com data futura. Para ver
  // a projeção, a tela de Carteiras aceita uma data futura no corte.
  const walletBalances = useMemo(() => {
    const stats = walletStatsAsOf(today)
    return Object.fromEntries(Object.entries(stats).map(([id, st]) => [id, st.balance]))
  }, [walletStatsAsOf, today])

  const totalBalance = useMemo(
    () => Object.values(walletBalances).reduce((s, b) => s + b, 0),
    [walletBalances]
  )


  // Saldo no fim do mês anterior: só tx com data < 1º deste mês. Comparável
  // direto com totalBalance, que também para no dia de hoje.
  const lastBalance = useMemo(() => wallets.reduce((sum, w) => {
    const txsUpToLastMonth = validTx.filter(tx => tx.walletId === w.id && tx.date && tx.date < `${thisMonth}-01`)
    const income   = txsUpToLastMonth.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
    const expenses = txsUpToLastMonth.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
    return sum + (w.balance || 0) + income - expenses
  }, 0), [wallets, validTx, thisMonth])

  const spendingByCategory = useMemo(() => txThis
    .filter(tx => tx.type === 'expense')
    .reduce((acc, tx) => { acc[tx.category] = (acc[tx.category] || 0) + tx.amount; return acc }, {}),
  [txThis])

  const monthlyChartData = useMemo(() => {
    const [y, m] = thisMonth.split('-').map(Number) // m é 1-based
    return Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(y, (m - 1) - (5 - i), 1)
      const key = fmt(d)
      const txs = validTx.filter(tx => tx.date?.startsWith(key))
      return { key, label: i18n.formatMonthShort(d), income: sumIncome(txs), expenses: sumExpenses(txs) }
    })
  }, [validTx, thisMonth, i18n])

  // ── Notification helpers ───────────────────────────────────────────────────

  const checkBudgetNotify = useCallback((category, addedAmount, status) => {
    if (status === 'failed') return
    const budget = budgets.find(b => b.category === category)
    if (!budget) return
    const currentSpend = validTx
      .filter(tx => tx.type === 'expense' && tx.category === category && tx.date?.startsWith(thisMonth))
      .reduce((s, tx) => s + tx.amount, 0)
    const projected = currentSpend + addedAmount
    const pct = budget.limit > 0 ? Math.round((projected / budget.limit) * 100) : 0
    if (projected > budget.limit) {
      notify({ type: 'budget_over', data: { category, pct }, settings })
    } else if (pct >= 80) {
      notify({ type: 'budget_near', data: { category, pct }, settings })
    }
  }, [budgets, validTx, thisMonth, settings])

  const checkCardNotify = useCallback((cardId, addedAmount, type, status) => {
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
  }, [creditCards, getCardCurrentUsed, settings])

  // ── Transactions ───────────────────────────────────────────────────────────

  // Parcelamento: gera as N parcelas de uma vez. Recorrência não passa mais por
  // aqui — virou uma regra própria em createRecurringSeries.
  const addMultipleTransactions = useCallback(async (data, mode, count) => {
    const batch = writeBatch(db)
    const startDate = data.date || isoDate()
    const amounts = mode === 'installment'
      ? splitInstallments(data.amount, count)
      : Array.from({ length: count }, () => Number(data.amount))

    for (let i = 0; i < count; i++) {
      // addMonths encolhe o dia quando o mês de destino é mais curto, então a
      // parcela de uma compra feita dia 31 cai em 28/fev em vez de escorregar
      // para 3 de março.
      const txData = {
        ...data,
        amount: amounts[i],
        date: addMonths(startDate, i),
        name: `${data.name} (${i + 1}/${count})`,
      }
      batch.set(doc(collection(db, COL.transactions)), base(txData))
    }

    await batch.commit()

    notify({ type: 'transaction', data: { name: data.name, amount: data.amount, txType: data.type, category: data.category }, settings })

    if (data.type === 'expense') {
      // Só o impacto da 1ª parcela conta para o mês atual.
      checkBudgetNotify(data.category, amounts[0], data.status)
      checkCardNotify(data.cardId, amounts[0], data.type, data.status)
    }
  }, [base, settings, checkBudgetNotify, checkCardNotify])

  const addTransaction = useCallback(async (data) => {
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
  }, [base, settings, checkBudgetNotify, checkCardNotify])

  const updateTransaction = useCallback((id, data) =>
    updateDoc(doc(db, COL.transactions, id), data), [])

  const deleteTransaction = useCallback((id) =>
    deleteDoc(doc(db, COL.transactions, id)), [])

  const bulkDeleteTransactions = useCallback(async (ids) => {
    const batch = writeBatch(db)
    ids.forEach(id => batch.delete(doc(db, COL.transactions, id)))
    await batch.commit()
  }, [])

  // ── Wallets ────────────────────────────────────────────────────────────────

  const addWallet = useCallback(async (data) => {
    const ref = await addDoc(collection(db, COL.wallets), base(data))
    setWalletCreated(true)
    return ref
  }, [base])

  const updateWallet = useCallback((id, data) =>
    updateDoc(doc(db, COL.wallets, id), data), [])

  // Exclusão em lote com destino explícito para as transações vinculadas.
  //
  // Antes a exclusão só apagava a carteira e deixava as transações órfãs: elas
  // continuavam entrando em algumas somas (total do mês, categorias) mas
  // sumiam de outras (saldo por carteira), então os números pararam de fechar.
  //
  //   'orphan' — comportamento antigo, mantido como escolha consciente
  //   'move'   — reatribui para outra carteira (targetId)
  //   'delete' — apaga também as transações
  //
  // writeBatch tem teto de 500 operações; grandes históricos vão em blocos.
  const removeWallets = useCallback(async (ids, { mode = 'orphan', targetId = '' } = {}) => {
    const idSet = new Set(ids)
    const affected = mode === 'orphan' ? [] : transactions.filter(tx => idSet.has(tx.walletId))

    const ops = [
      ...affected.map(tx => (batch) => {
        if (mode === 'delete') batch.delete(doc(db, COL.transactions, tx.id))
        else batch.update(doc(db, COL.transactions, tx.id), { walletId: targetId })
      }),
      ...ids.map(id => (batch) => batch.delete(doc(db, COL.wallets, id))),
    ]

    const CHUNK = 450
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = writeBatch(db)
      ops.slice(i, i + CHUNK).forEach(op => op(batch))
      await batch.commit()
    }

    return affected.length
  }, [transactions])

  const deleteWallet = useCallback((id, options) => removeWallets([id], options), [removeWallets])
  const bulkDeleteWallets = useCallback((ids, options) => removeWallets(ids, options), [removeWallets])

  // ── Budgets ────────────────────────────────────────────────────────────────

  const addBudget = useCallback((data) =>
    addDoc(collection(db, COL.budgets), base(data)), [base])

  const updateBudget = useCallback((id, data) =>
    updateDoc(doc(db, COL.budgets, id), data), [])

  const deleteBudget = useCallback((id) =>
    deleteDoc(doc(db, COL.budgets, id)), [])

  // ── Goals ──────────────────────────────────────────────────────────────────

  const addGoal = useCallback((data) =>
    addDoc(collection(db, COL.goals), base({ ...data, current: Number(data.current) || 0 })), [base])

  const updateGoal = useCallback((id, data) =>
    updateDoc(doc(db, COL.goals, id), data), [])

  const deleteGoal = useCallback((id) =>
    deleteDoc(doc(db, COL.goals, id)), [])

  // O aporte move dinheiro de verdade: sai da carteira escolhida como despesa.
  // Antes isto só incrementava um contador, então dava para "guardar" um valor
  // que não existia em carteira nenhuma. Em batch para não sobrar uma despesa
  // lançada sem o progresso correspondente.
  const contributeGoal = useCallback(async (id, amount, walletId) => {
    const goal = goals.find(g => g.id === id)
    const value = Number(amount)
    if (!goal || !(value > 0) || !walletId) return

    const newCurrent = Math.min(goal.current + value, goal.target)
    const batch = writeBatch(db)

    const txRef = doc(collection(db, COL.transactions))
    batch.set(txRef, base({
      name: `Aporte: ${goal.name}`,
      amount: value,
      type: 'expense',
      category: GOAL_CATEGORY,
      walletId,
      goalId: id,
      date: isoDate(),
      status: 'completed',
    }))
    batch.update(doc(db, COL.goals, id), { current: newCurrent })
    await batch.commit()

    // addCategory é declarado mais abaixo — não dá para referenciar aqui sem
    // estourar TDZ na lista de dependências, então grava direto.
    if (!categories.includes(GOAL_CATEGORY)) {
      const next = [...categories, GOAL_CATEGORY]
      setCategories(next)
      updateDoc(doc(db, COL.users, user.uid), { categories: next }).catch(console.error)
    }

    if (newCurrent >= goal.target) {
      notify({ type: 'goal_reached', data: { goalName: goal.name, amount: goal.target }, settings })
    }
  }, [goals, settings, base, categories, user])

  // Desfaz um aporte: apaga a despesa e devolve o valor ao progresso.
  const undoContribution = useCallback(async (tx) => {
    const goal = goals.find(g => g.id === tx.goalId)
    const batch = writeBatch(db)
    batch.delete(doc(db, COL.transactions, tx.id))
    if (goal) {
      batch.update(doc(db, COL.goals, goal.id), {
        current: Math.max(0, goal.current - (tx.amount || 0)),
      })
    }
    await batch.commit()
  }, [goals])

  // ── Investments ────────────────────────────────────────────────────────────

  const addInvestment = useCallback((data) =>
    addDoc(collection(db, COL.investments), base(data)), [base])

  const updateInvestment = useCallback((id, data) =>
    updateDoc(doc(db, COL.investments, id), data), [])

  const deleteInvestment = useCallback((id) =>
    deleteDoc(doc(db, COL.investments, id)), [])

  // ── Credit Cards ───────────────────────────────────────────────────────────

  const addCreditCard = useCallback((data) =>
    addDoc(collection(db, COL.creditCards), base(data)), [base])

  const updateCreditCard = useCallback((id, data) =>
    updateDoc(doc(db, COL.creditCards, id), data), [])

  // Mesmo tratamento das carteiras: uma fatura apagada não pode deixar as
  // despesas dela apontando para um cartão que não existe mais.
  const deleteCreditCard = useCallback(async (id, { mode = 'orphan', targetId = '' } = {}) => {
    const affected = mode === 'orphan' ? [] : transactions.filter(tx => tx.cardId === id)

    const ops = [
      ...affected.map(tx => (batch) => {
        if (mode === 'delete') batch.delete(doc(db, COL.transactions, tx.id))
        else batch.update(doc(db, COL.transactions, tx.id), { cardId: targetId })
      }),
      (batch) => batch.delete(doc(db, COL.creditCards, id)),
    ]

    const CHUNK = 450
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = writeBatch(db)
      ops.slice(i, i + CHUNK).forEach(op => op(batch))
      await batch.commit()
    }

    return affected.length
  }, [transactions])

  // ── Recorrências ───────────────────────────────────────────────────────────
  // Antes, "fixa/recorrente" apenas materializava N cópias na criação: não
  // existia a série, então não dava para editar, pausar ou cancelar "daqui em
  // diante" — só apagar transação por transação. Agora a regra é um documento
  // próprio e o job diário gera as ocorrências.

  const addRecurrence = useCallback((data) =>
    addDoc(collection(db, COL.recurrences), base(data)), [base])

  const updateRecurrence = useCallback((id, data) =>
    updateDoc(doc(db, COL.recurrences, id), data), [])

  // Apagar a regra não apaga o que já foi lançado: aquele dinheiro saiu de
  // verdade. Quem quiser remover o histórico usa a tela de transações.
  const deleteRecurrence = useCallback((id) =>
    deleteDoc(doc(db, COL.recurrences, id)), [])

  const toggleRecurrence = useCallback((id, active) =>
    updateDoc(doc(db, COL.recurrences, id), { active: !!active }), [])

  // Cria a regra e, se a data de início já chegou, lança a primeira ocorrência
  // na hora — esperar o cron da madrugada seguinte faria a transação sumir da
  // tela logo depois de o usuário salvá-la.
  const createRecurringSeries = useCallback(async (data, frequency = 'monthly', count = 0) => {
    const startDate = data.date || isoDate()
    const repetitions = Number(count) || 0
    const endDate = repetitions > 1 ? advance(startDate, frequency, repetitions - 1) : ''

    const todayStr = isoDate()
    const startsToday = startDate <= todayStr

    const batch = writeBatch(db)
    const recRef = doc(collection(db, COL.recurrences))

    batch.set(recRef, base({
      name: data.name,
      amount: Number(data.amount),
      type: data.type,
      category: data.category || 'Outros',
      walletId: data.walletId || '',
      cardId: data.cardId || '',
      notes: data.notes || '',
      frequency,
      startDate,
      endDate,
      nextDate: startsToday ? advance(startDate, frequency) : startDate,
      active: true,
    }))

    if (startsToday) {
      batch.set(doc(collection(db, COL.transactions)), base({
        ...data,
        amount: Number(data.amount),
        date: startDate,
        status: data.status || 'completed',
        recurrenceId: recRef.id,
      }))
    }

    await batch.commit()

    if (startsToday) {
      notify({ type: 'transaction', data: { name: data.name, amount: data.amount, txType: data.type, category: data.category }, settings })
      if (data.type === 'expense') {
        checkBudgetNotify(data.category, Number(data.amount), data.status)
        checkCardNotify(data.cardId, Number(data.amount), data.type, data.status)
      }
    }

    return recRef
  }, [base, settings, checkBudgetNotify, checkCardNotify])

  const nextRecurrences = useMemo(() =>
    recurrences
      .filter(r => r.active !== false)
      .sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || '')),
  [recurrences])

  // ── Alerts ─────────────────────────────────────────────────────────────────

  const addAlert = useCallback((data) =>
    addDoc(collection(db, COL.alerts), base(data)), [base])

  const updateAlert = useCallback((id, data) =>
    updateDoc(doc(db, COL.alerts, id), data), [])

  const deleteAlert = useCallback((id) =>
    deleteDoc(doc(db, COL.alerts, id)), [])

  const alertsDueCount = useMemo(() => alerts.filter(a => {
    if (a.paid) return false
    const rightNow = new Date()
    const due = new Date(a.dueDate + 'T12:00:00')
    const diff = (due - rightNow) / (1000 * 60 * 60 * 24)
    return diff <= 3
  }).length, [alerts])

  // ── Export / Import ────────────────────────────────────────────────────────

  const _download = (content, filename, mime) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    Object.assign(document.createElement('a'), { href: url, download: filename }).click()
    URL.revokeObjectURL(url)
  }

  const exportJSON = useCallback(() => {
    const strip = arr => arr.map(({ id, userId, allowedUsers, createdAt, ...rest }) => rest)
    _download(
      JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(),
        transactions: strip(transactions), wallets: strip(wallets), budgets: strip(budgets),
        goals: strip(goals), investments: strip(investments), creditCards: strip(creditCards),
      }, null, 2),
      `eazy-backup-${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    )
  }, [transactions, wallets, budgets, goals, investments, creditCards])

  const exportCSV = useCallback(() => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Data','Descrição','Tipo','Categoria','Valor','Status','Carteira','Observações']
    const rows = [...transactions]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(tx => [
        tx.date || '', tx.name || '',
        tx.type === 'income' ? 'Receita' : 'Despesa',
        tx.category || '', tx.amount ?? 0,
        tx.status === 'completed' ? 'Concluído' : 'Pendente',
        wallets.find(w => w.id === tx.walletId)?.name || '',
        tx.notes || '',
      ])
    _download(
      '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\n'),
      `eazy-transacoes-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv;charset=utf-8'
    )
  }, [transactions, wallets])

  // Assinatura de conteúdo de uma transação. Serve para não reimportar o que já
  // existe: antes, importar o mesmo backup duas vezes duplicava tudo em
  // silêncio, e não havia como desfazer.
  const txSignature = (tx) =>
    [tx.date, tx.type, Number(tx.amount).toFixed(2), (tx.name || '').trim().toLowerCase()].join('|')

  const importJSON = useCallback(async (file, { skipDuplicates = true } = {}) => {
    const text = await file.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('Arquivo não é um JSON válido')
    }
    if (!data.version || !Array.isArray(data.transactions)) throw new Error('Arquivo inválido ou corrompido')

    const existing = new Set(transactions.map(txSignature))
    const stats = { imported: 0, skipped: 0 }

    const entries = []
    const push = (items, col) => (items || []).forEach(item => entries.push({ item, col }))

    for (const tx of data.transactions) {
      if (skipDuplicates && existing.has(txSignature(tx))) { stats.skipped++; continue }
      // Marca dentro do próprio lote também: um backup pode trazer duplicatas.
      existing.add(txSignature(tx))
      entries.push({ item: tx, col: COL.transactions })
      stats.imported++
    }

    // Carteiras/cartões/categorias não são deduplicados por conteúdo — o
    // usuário pode legitimamente ter duas contas com o mesmo nome — mas nomes
    // já existentes são ignorados para não encher a lista de cópias.
    const existingWallets = new Set(wallets.map(w => (w.name || '').trim().toLowerCase()))
    push((data.wallets || []).filter(w => !existingWallets.has((w.name || '').trim().toLowerCase())), COL.wallets)

    const existingCards = new Set(creditCards.map(c => (c.name || '').trim().toLowerCase()))
    push((data.creditCards || []).filter(c => !existingCards.has((c.name || '').trim().toLowerCase())), COL.creditCards)

    const existingBudgets = new Set(budgets.map(b => b.category))
    push((data.budgets || []).filter(b => !existingBudgets.has(b.category)), COL.budgets)

    const existingGoals = new Set(goals.map(g => (g.name || '').trim().toLowerCase()))
    push((data.goals || []).filter(g => !existingGoals.has((g.name || '').trim().toLowerCase())), COL.goals)

    push(data.investments, COL.investments)

    // writeBatch tem teto de 500 operações — quebra em chunks pra backups grandes
    const CHUNK_SIZE = 450
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db)
      entries.slice(i, i + CHUNK_SIZE).forEach(({ item, col }) => batch.set(doc(collection(db, col)), base(item)))
      await batch.commit()
    }

    return stats
  }, [base, transactions, wallets, creditCards, budgets, goals])

  // Importação de CSV — a via realista de trazer o extrato do banco. Aceita o
  // CSV exportado pelo próprio app e os cabeçalhos mais comuns de banco.
  const importCSV = useCallback(async (file, { skipDuplicates = true, walletId = '' } = {}) => {
    const text = (await file.text()).replace(/^\uFEFF/, '')
    const rows = parseCSV(text)
    if (rows.length < 2) throw new Error('CSV vazio ou sem linhas de dados')

    const header = rows[0].map(h => h.trim().toLowerCase())
    const findCol = (...names) => header.findIndex(h => names.some(n => h.includes(n)))

    const iDate   = findCol('data', 'date')
    const iName   = findCol('descri', 'histór', 'histor', 'name', 'lançamento', 'lancamento')
    const iAmount = findCol('valor', 'amount', 'quantia')
    const iType   = findCol('tipo', 'type')
    const iCat    = findCol('categoria', 'category')
    const iNotes  = findCol('observ', 'notes', 'memo')

    if (iDate < 0 || iAmount < 0) {
      throw new Error('Não encontrei as colunas de data e valor. Cabeçalhos esperados: Data, Descrição, Valor.')
    }

    const existing = new Set(transactions.map(txSignature))
    const parsed = []
    const stats = { imported: 0, skipped: 0, invalid: 0 }

    for (const row of rows.slice(1)) {
      if (!row.length || row.every(c => !c.trim())) continue

      const date = normalizeDate(row[iDate])
      const amountRaw = row[iAmount]
      const amount = parseAmount(amountRaw)

      if (!date || amount == null) { stats.invalid++; continue }

      // Sem coluna de tipo, o sinal do valor decide — é a convenção de extrato.
      const typeCell = iType >= 0 ? (row[iType] || '').toLowerCase() : ''
      const type = typeCell
        ? (typeCell.includes('receit') || typeCell.includes('entrada') || typeCell.includes('credit') || typeCell.includes('income') ? 'income' : 'expense')
        : (amount < 0 ? 'expense' : 'income')

      const tx = {
        date,
        name: (iName >= 0 ? row[iName] : '').trim() || 'Importado',
        amount: Math.abs(amount),
        type,
        category: (iCat >= 0 ? row[iCat] : '').trim() || 'Outros',
        notes: (iNotes >= 0 ? row[iNotes] : '').trim(),
        status: 'completed',
        walletId,
        cardId: '',
      }

      const sig = txSignature(tx)
      if (skipDuplicates && existing.has(sig)) { stats.skipped++; continue }
      existing.add(sig)
      parsed.push(tx)
      stats.imported++
    }

    const CHUNK_SIZE = 450
    for (let i = 0; i < parsed.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db)
      parsed.slice(i, i + CHUNK_SIZE).forEach(tx => batch.set(doc(collection(db, COL.transactions)), base(tx)))
      await batch.commit()
    }

    return stats
  }, [base, transactions])

  // ── Settings ───────────────────────────────────────────────────────────────

  // Espelho do estado para o updateSettings ler o valor atual sem se recriar a
  // cada troca de preferência (ele entra na dependência de meio contexto).
  // A sincronia vai num efeito porque escrever em ref durante o render é
  // proibido — o efeito roda no commit, antes de qualquer interação do usuário.
  const rawSettingsRef = useRef(rawSettings)
  useEffect(() => { rawSettingsRef.current = rawSettings }, [rawSettings])

  const updateSettings = useCallback((data) => {
    const next = { ...rawSettingsRef.current, ...data }
    setRawSettings(next)

    // A gravação fica FORA do updater do setState: em StrictMode o React chama
    // o updater duas vezes, e a versão anterior disparava dois writes no
    // Firestore a cada mudança de preferência.
    // name/email/initials vêm do auth e podem estar em prefs antigas — são
    // removidos aqui para não congelar um nome desatualizado no banco.
    const { name, email, initials, biometricEnabled, ...prefs } = next
    void name; void email; void initials
    // biometricEnabled is device-local — never written to Firestore
    if ('biometricEnabled' in data) saveBiometric(user.uid, biometricEnabled)
    updateDoc(doc(db, COL.users, user.uid), { prefs }).catch(console.error)
  }, [user])

  // theme guarda a preferência ('system' | 'light' | 'dark'); resolvedTheme é o
  // que a UI realmente pinta. Só 'light'/'dark' contam como escolha explícita —
  // qualquer outro valor (inclusive prefs antigas sem o campo) segue o sistema.
  const resolvedTheme = settings.theme === 'light' || settings.theme === 'dark'
    ? settings.theme
    : (systemDark ? 'dark' : 'light')

  // Alterna a partir do que está na tela, senão sair de 'system' no escuro
  // acenderia o escuro de novo.
  const toggleTheme = useCallback(() =>
    updateSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' }),
  [resolvedTheme, updateSettings])

  const addCategory = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed || categories.includes(trimmed)) return
    const next = [...categories, trimmed]
    setCategories(next)
    updateDoc(doc(db, COL.users, user.uid), { categories: next }).catch(console.error)
  }, [categories, user])

  const removeCategory = useCallback((name) => {
    const next = categories.filter(c => c !== name)
    setCategories(next)
    updateDoc(doc(db, COL.users, user.uid), { categories: next }).catch(console.error)
  }, [categories, user])

  // ── Value ──────────────────────────────────────────────────────────────────

  const value = useMemo(() => ({
    transactions, wallets, budgets, goals, investments, creditCards, alerts, alertsDueCount,
    recurrences, nextRecurrences,
    settings, resolvedTheme, categories, dbLoading, dbError, walletCreated,
    totalBalance, walletBalances, walletStatsAsOf, monthlyIncome, monthlyExpenses, monthlySavings,
    lastIncome, lastExpenses, lastSavings, lastBalance, pendingCount,
    spendingByCategory, monthlyChartData, thisMonth,
    pctChange, getCardCurrentUsed, formatCurrency, currencySymbol,
    formatNumber, formatDate, formatLongDate, t, locale: i18n.locale,
    addTransaction, addMultipleTransactions, updateTransaction, deleteTransaction, bulkDeleteTransactions,
    addWallet, updateWallet, deleteWallet, bulkDeleteWallets,
    addBudget, updateBudget, deleteBudget,
    addGoal, updateGoal, deleteGoal, contributeGoal, undoContribution,
    addInvestment, updateInvestment, deleteInvestment,
    addCreditCard, updateCreditCard, deleteCreditCard,
    addAlert, updateAlert, deleteAlert,
    addRecurrence, updateRecurrence, deleteRecurrence, toggleRecurrence, createRecurringSeries,
    updateSettings, toggleTheme, addCategory, removeCategory,
    exportJSON, exportCSV, importJSON, importCSV,
  }), [
    transactions, wallets, budgets, goals, investments, creditCards, alerts, alertsDueCount,
    recurrences, nextRecurrences,
    settings, resolvedTheme, categories, dbLoading, dbError, walletCreated,
    totalBalance, walletBalances, walletStatsAsOf, monthlyIncome, monthlyExpenses, monthlySavings,
    lastIncome, lastExpenses, lastSavings, lastBalance, pendingCount,
    spendingByCategory, monthlyChartData, thisMonth,
    getCardCurrentUsed, formatCurrency, currencySymbol,
    formatNumber, formatDate, formatLongDate, t, i18n,
    addTransaction, addMultipleTransactions, updateTransaction, deleteTransaction, bulkDeleteTransactions,
    addWallet, updateWallet, deleteWallet, bulkDeleteWallets,
    addBudget, updateBudget, deleteBudget,
    addGoal, updateGoal, deleteGoal, contributeGoal, undoContribution,
    addInvestment, updateInvestment, deleteInvestment,
    addCreditCard, updateCreditCard, deleteCreditCard,
    addAlert, updateAlert, deleteAlert,
    addRecurrence, updateRecurrence, deleteRecurrence, toggleRecurrence, createRecurringSeries,
    updateSettings, toggleTheme, addCategory, removeCategory,
    exportJSON, exportCSV, importJSON, importCSV,
  ])

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
