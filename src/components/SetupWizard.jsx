import { useEffect, useMemo, useRef, useState } from 'react'
import { CatIcon, useApp } from '../context/AppContext'
import CurrencyInput from './CurrencyInput'
import StatementImport from './StatementImport'
import QuickAdd from './QuickAdd'
import TransactionModal from './TransactionModal'
import { useToast } from './Toast'
import { GOAL_CATEGORY } from '../utils/categories'
import { INCOME_CATEGORIES } from '../utils/quickParse'
import { isoDate } from '../utils/date'
import { navigate } from '../utils/router'
import { anchoredInitialBalance, spendableSummary } from '../utils/setup'
import { DEFAULT_WALLET_ICON, resolveWalletIcon } from '../utils/walletIcons'

// Assistente de configuração: "comece de onde está", em qualquer dia do mês.
//
// 1. Saldos de hoje e renda   2. Gastos do mês até aqui   3. Cartões
// 4. Limites por categoria    5. Quanto ainda dá para gastar
//
// O ponto delicado é o 1 + 2. O saldo de uma conta é saldo inicial + entradas
// − saídas; quem informa "tenho R$ 2.000 hoje" e em seguida importa os gastos
// do mês teria esses gastos descontados de novo. Por isso o saldo informado
// vira uma âncora enquanto o assistente está aberto: quando entram lançamentos
// com data até hoje, o saldo inicial é recalculado para o saldo de hoje
// continuar o que a pessoa disse.

const STEPS = ['start', 'expenses', 'cards', 'limits', 'summary']
const STEP_ICONS = ['fi-rr-flag', 'fi-rr-download', 'fi-rr-credit-card', 'fi-rr-chart-pie-alt', 'fi-rr-wallet']

const WALLET_TYPES = ['checking', 'savings', 'investment', 'cash']

const stepFromHash = () => {
  const n = Number(new URLSearchParams(window.location.hash.split('?')[1] || '').get('step'))
  return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export default function SetupWizard() {
  const {
    wallets, walletBalances, totalBalance, creditCards, budgets, transactions, thisMonth, categories,
    settings, updateSettings, addWallet, updateWallet, addCreditCard, addBudget, updateBudget,
    getCardInvoice, spendingByCategory, addTransaction, addMultipleTransactions, createRecurringSeries,
    formatCurrency: fmt, formatDate, t,
  } = useApp()
  const toast = useToast()
  const today = isoDate()

  const [step, setStep] = useState(stepFromHash)
  useEffect(() => {
    const onHash = () => setStep(stepFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (n) => {
    setStep(n)
    window.history.replaceState(null, '', `#/setup?step=${n}`)
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }

  const [busy, setBusy] = useState(false)

  // ── 1. Saldos e renda ────────────────────────────────────────────────────
  const [income, setIncome] = useState(() => Number(settings.profile?.monthlyIncome) || 0)
  const [stated, setStated] = useState({})       // rascunho do saldo de hoje por conta
  const [anchors, setAnchors] = useState({})     // saldos confirmados (âncoras)
  const [negative, setNegative] = useState([])   // contas cuja âncora não coube
  const [newAccount, setNewAccount] = useState(null)

  const statedFor = (w) => stated[w.id] ?? round2(walletBalances[w.id])

  // Reaplica as âncoras sempre que o saldo calculado sai do informado (entrou
  // lançamento com data até hoje). `inFlight` evita gravar o mesmo valor duas
  // vezes enquanto o snapshot do Firestore não volta.
  const inFlight = useRef(new Map())
  useEffect(() => {
    const bad = []
    for (const [id, value] of Object.entries(anchors)) {
      const w = wallets.find(x => x.id === id)
      if (!w || walletBalances[id] === undefined) continue
      const patch = anchoredInitialBalance(w, walletBalances[id], value)
      if (!patch) { inFlight.current.delete(id); continue }
      if (patch.negative) { bad.push(w.name); continue }
      if (inFlight.current.get(id) === patch.balance) continue
      inFlight.current.set(id, patch.balance)
      updateWallet(id, { balance: patch.balance }).catch(err => {
        inFlight.current.delete(id)
        console.error('[setup] âncora de saldo', err)
      })
    }
    setNegative(prev => (prev.join('|') === bad.join('|') ? prev : bad))
  }, [anchors, wallets, walletBalances, updateWallet])

  const saveStart = async () => {
    setBusy(true)
    try {
      if (round2(income) !== round2(settings.profile?.monthlyIncome)) {
        updateSettings({ profile: { ...(settings.profile || {}), monthlyIncome: round2(income) } })
      }
      setAnchors(prev => {
        const next = { ...prev }
        for (const w of wallets) next[w.id] = round2(statedFor(w))
        return next
      })
      go(1)
    } finally {
      setBusy(false)
    }
  }

  const createAccount = async () => {
    if (!newAccount?.name.trim()) return
    setBusy(true)
    try {
      const ref = await addWallet({
        name: newAccount.name.trim(),
        type: newAccount.type,
        balance: round2(newAccount.balance),
        color: '#0053EF',
        icon: resolveWalletIcon(DEFAULT_WALLET_ICON, newAccount.type),
      })
      setStated(s => ({ ...s, [ref.id]: round2(newAccount.balance) }))
      setNewAccount(null)
    } catch (err) {
      toast.error(t('setup.saveError', { error: err?.code || err?.message }))
    } finally {
      setBusy(false)
    }
  }

  // ── 2. Gastos do mês ─────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [fullDraft, setFullDraft] = useState(null)
  const monthTx = useMemo(
    () => transactions.filter(tx => tx.date?.startsWith(thisMonth) && tx.date <= today),
    [transactions, thisMonth, today])
  const monthSpent = monthTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + (tx.amount || 0), 0)
  const prefersImport = ['bank', 'sheet', 'otherApp'].includes(settings.profile?.tracking)

  // ── 3. Cartões ───────────────────────────────────────────────────────────
  const [cardDraft, setCardDraft] = useState(null)
  const noCards = !!settings.setup?.noCards
  const createCard = async () => {
    if (!cardDraft?.name.trim() || !(Number(cardDraft.limit) > 0)) return
    setBusy(true)
    try {
      await addCreditCard({
        name: cardDraft.name.trim(),
        flag: 'Outro',
        limit: round2(cardDraft.limit),
        closingDay: Number(cardDraft.closingDay),
        dueDay: Number(cardDraft.dueDay),
        color: '#1a1a2e',
      })
      if (noCards) updateSettings({ setup: { ...(settings.setup || {}), noCards: false } })
      setCardDraft(null)
    } catch (err) {
      toast.error(t('setup.saveError', { error: err?.code || err?.message }))
    } finally {
      setBusy(false)
    }
  }

  // ── 4. Limites ───────────────────────────────────────────────────────────
  const limitCategories = useMemo(
    () => categories.filter(c => !INCOME_CATEGORIES.has(c) && c !== GOAL_CATEGORY),
    [categories])
  const budgetByCategory = useMemo(
    () => Object.fromEntries(budgets.map(b => [b.category, b])), [budgets])
  const [limits, setLimits] = useState({})
  const limitFor = (c) => limits[c] ?? (budgetByCategory[c]?.limit || 0)

  const saveLimits = async () => {
    setBusy(true)
    try {
      for (const c of limitCategories) {
        if (!(c in limits)) continue
        const value = round2(limits[c])
        const existing = budgetByCategory[c]
        // Zerar um limite existente não apaga o orçamento: isso fica na tela
        // de Orçamentos, onde a exclusão é explícita.
        if (existing && value > 0 && value !== existing.limit) await updateBudget(existing.id, { limit: value })
        else if (!existing && value > 0) await addBudget({ category: c, limit: value })
      }
      setLimits({})
      go(4)
    } catch (err) {
      toast.error(t('setup.saveError', { error: err?.code || err?.message }))
    } finally {
      setBusy(false)
    }
  }

  // ── 5. Resumo ────────────────────────────────────────────────────────────
  const summary = useMemo(() => spendableSummary({
    totalBalance, transactions, today, budgets, spendingByCategory,
    invoices: creditCards.map(c => getCardInvoice(c.id)),
  }), [totalBalance, transactions, today, budgets, spendingByCategory, creditCards, getCardInvoice])

  const finish = () => {
    updateSettings({ setup: { ...(settings.setup || {}), completedAt: today } })
    toast.success(t('setup.done'))
    navigate('overview')
  }

  const stepDone = [
    Object.keys(anchors).length > 0 || Number(settings.profile?.monthlyIncome) > 0,
    monthTx.length > 0,
    creditCards.length > 0 || noCards,
    budgets.length > 0,
    !!settings.setup?.completedAt,
  ]

  const nav = (
    <div className="setup-nav">
      {step > 0 && <button type="button" className="btn btn-secondary" onClick={() => go(step - 1)} disabled={busy}>{t('onb.back')}</button>}
      {step === 0 && (
        <button type="button" className="btn btn-primary" onClick={saveStart} disabled={busy}>
          {t('setup.saveContinue')} <i className="fi fi-rr-arrow-right" aria-hidden="true" />
        </button>
      )}
      {(step === 1 || step === 2) && (
        <button type="button" className="btn btn-primary" onClick={() => go(step + 1)} disabled={busy}>
          {t('onb.continue')} <i className="fi fi-rr-arrow-right" aria-hidden="true" />
        </button>
      )}
      {step === 3 && (
        <button type="button" className="btn btn-primary" onClick={saveLimits} disabled={busy}>
          {t('setup.saveContinue')} <i className="fi fi-rr-arrow-right" aria-hidden="true" />
        </button>
      )}
      {step === 4 && (
        <button type="button" className="btn btn-primary" onClick={finish}>
          {t('setup.finish')} <i className="fi fi-rr-check" aria-hidden="true" />
        </button>
      )}
    </div>
  )

  return (
    <div className="screen setup">
      <ol className="setup-steps" aria-label={t('setup.stepsLabel')}>
        {STEPS.map((id, i) => (
          <li key={id}>
            <button
              type="button"
              className={`setup-step${i === step ? ' current' : ''}${stepDone[i] ? ' done' : ''}`}
              onClick={() => go(i)}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="setup-step-num">{stepDone[i] && i !== step ? <i className="fi fi-rr-check" aria-hidden="true" /> : i + 1}</span>
              <span className="setup-step-label">{t(`setup.step.${id}`)}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="setup-body">
        <section className="card setup-panel">
          <header className="setup-panel-head">
            <span className="setup-panel-icon"><i className={`fi ${STEP_ICONS[step]}`} aria-hidden="true" /></span>
            <div>
              <h2>{t(`setup.${STEPS[step]}.title`)}</h2>
              <p>{t(`setup.${STEPS[step]}.sub`)}</p>
            </div>
          </header>

          {/* ── 1 ─────────────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="setup-section">
              <div className="setup-today">
                <i className="fi fi-rr-calendar" aria-hidden="true" />
                <div>
                  <strong>{t('setup.start.today', { date: formatDate(today) })}</strong>
                  <span>{t('setup.start.todayHint')}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('setup.start.income')}</label>
                <CurrencyInput className="form-input" value={income} onChange={setIncome} aria-label={t('setup.start.income')} />
              </div>

              <h3 className="setup-h3">{t('setup.start.balances')}</h3>
              <ul className="setup-list">
                {wallets.map(w => (
                  <li key={w.id} className="setup-row">
                    <span className="setup-row-icon"><i className={`fi ${resolveWalletIcon(w.icon, w.type)}`} aria-hidden="true" /></span>
                    <span className="setup-row-name">
                      <strong>{w.name}</strong>
                      <small>{t(`wallet.type.${w.type}`)}</small>
                    </span>
                    <CurrencyInput
                      className="form-input setup-row-input"
                      value={statedFor(w)}
                      onChange={v => setStated(s => ({ ...s, [w.id]: v }))}
                      aria-label={t('setup.start.balanceOf', { name: w.name })}
                    />
                  </li>
                ))}
              </ul>

              {newAccount ? (
                <div className="setup-inline-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{t('wallet.type')}</label>
                      <select className="form-select" value={newAccount.type} onChange={e => setNewAccount(a => ({ ...a, type: e.target.value }))}>
                        {WALLET_TYPES.map(v => <option key={v} value={v}>{t(`wallet.type.${v}`)}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('onb.account.name')}</label>
                      <input className="form-input" autoFocus value={newAccount.name} maxLength={60}
                        placeholder={t('onb.account.namePlaceholder')}
                        onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('onb.account.balance')}</label>
                    <CurrencyInput className="form-input" value={newAccount.balance}
                      onChange={v => setNewAccount(a => ({ ...a, balance: v }))} aria-label={t('onb.account.balance')} />
                  </div>
                  <div className="setup-inline-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setNewAccount(null)}>{t('action.cancel')}</button>
                    <button type="button" className="btn btn-primary" onClick={createAccount} disabled={busy || !newAccount.name.trim()}>{t('setup.start.addAccount')}</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="setup-add" onClick={() => setNewAccount({ type: 'checking', name: '', balance: 0 })}>
                  <i className="fi fi-rr-plus" aria-hidden="true" /> {t('setup.start.addAnother')}
                </button>
              )}
            </div>
          )}

          {/* ── 2 ─────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="setup-section">
              <div className="setup-stat">
                <span>{t('setup.expenses.soFar', { count: monthTx.length })}</span>
                <strong>{fmt(monthSpent)}</strong>
              </div>

              <div className="setup-options">
                <button type="button" className={`setup-option${prefersImport ? ' recommended' : ''}`} onClick={() => setImportOpen(true)}>
                  <i className="fi fi-rr-download" aria-hidden="true" />
                  <span>
                    <strong>{t('setup.expenses.import')}</strong>
                    <small>{t('setup.expenses.importSub')}</small>
                  </span>
                  {prefersImport && <em>{t('setup.recommended')}</em>}
                </button>
                <button type="button" className="setup-option" onClick={() => setQuickOpen(true)}>
                  <i className="fi fi-rr-pencil" aria-hidden="true" />
                  <span>
                    <strong>{t('setup.expenses.manual')}</strong>
                    <small>{t('setup.expenses.manualSub')}</small>
                  </span>
                </button>
              </div>

              {Object.keys(anchors).length > 0 && (
                <p className="setup-note"><i className="fi fi-rr-shield-check" aria-hidden="true" /> {t('setup.expenses.anchorNote')}</p>
              )}
              {negative.length > 0 && (
                <p className="setup-note setup-note--warn"><i className="fi fi-rr-triangle-warning" aria-hidden="true" /> {t('setup.expenses.anchorNegative', { names: negative.join(', ') })}</p>
              )}
            </div>
          )}

          {/* ── 3 ─────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="setup-section">
              {creditCards.length > 0 && (
                <ul className="setup-list">
                  {creditCards.map(c => (
                    <li key={c.id} className="setup-row">
                      <span className="setup-row-icon"><i className="fi fi-rr-credit-card" aria-hidden="true" /></span>
                      <span className="setup-row-name">
                        <strong>{c.name}</strong>
                        <small>{t('setup.cards.meta', { closing: c.closingDay, due: c.dueDay, limit: fmt(c.limit) })}</small>
                      </span>
                      <span className="setup-row-value">
                        <small>{t('setup.cards.invoice')}</small>
                        <strong>{fmt(getCardInvoice(c.id))}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {cardDraft ? (
                <div className="setup-inline-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{t('setup.cards.name')}</label>
                      <input className="form-input" autoFocus value={cardDraft.name} maxLength={60}
                        placeholder={t('setup.cards.namePlaceholder')}
                        onChange={e => setCardDraft(d => ({ ...d, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('setup.cards.limit')}</label>
                      <CurrencyInput className="form-input" value={cardDraft.limit}
                        onChange={v => setCardDraft(d => ({ ...d, limit: v }))} aria-label={t('setup.cards.limit')} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{t('card.closingDay')}</label>
                      <input className="form-input" type="number" inputMode="numeric" min="1" max="31" value={cardDraft.closingDay}
                        onChange={e => setCardDraft(d => ({ ...d, closingDay: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('setup.cards.dueDay')}</label>
                      <input className="form-input" type="number" inputMode="numeric" min="1" max="31" value={cardDraft.dueDay}
                        onChange={e => setCardDraft(d => ({ ...d, dueDay: e.target.value }))} />
                    </div>
                  </div>
                  <div className="setup-inline-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setCardDraft(null)}>{t('action.cancel')}</button>
                    <button type="button" className="btn btn-primary" onClick={createCard}
                      disabled={busy || !cardDraft.name.trim() || !(Number(cardDraft.limit) > 0)
                        || !(cardDraft.closingDay >= 1 && cardDraft.closingDay <= 31) || !(cardDraft.dueDay >= 1 && cardDraft.dueDay <= 31)}>
                      {t('setup.cards.add')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="setup-options">
                  <button type="button" className="setup-add" onClick={() => setCardDraft({ name: '', limit: 0, closingDay: 25, dueDay: 2 })}>
                    <i className="fi fi-rr-plus" aria-hidden="true" /> {t(creditCards.length ? 'setup.cards.addAnother' : 'setup.cards.addFirst')}
                  </button>
                  {creditCards.length > 0 && (
                    <button type="button" className="setup-add" onClick={() => setImportOpen(true)}>
                      <i className="fi fi-rr-download" aria-hidden="true" /> {t('setup.cards.importInvoice')}
                    </button>
                  )}
                </div>
              )}

              {creditCards.length === 0 && (
                <label className="onb-check">
                  <input type="checkbox" checked={noCards}
                    onChange={e => updateSettings({ setup: { ...(settings.setup || {}), noCards: e.target.checked } })} />
                  {t('setup.cards.none')}
                </label>
              )}

              <p className="setup-rule">
                <i className="fi fi-rr-credit-card" aria-hidden="true" />
                <span><strong>{t('setup.cards.ruleTitle')}</strong> {t('setup.cards.rule')}</span>
              </p>
            </div>
          )}

          {/* ── 4 ─────────────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="setup-section">
              <div className="setup-limits" role="table" aria-label={t('setup.limits.title')}>
                <div className="setup-limits-row setup-limits-head" role="row">
                  <span role="columnheader">{t('budget.category')}</span>
                  <span role="columnheader">{t('setup.limits.limit')}</span>
                  <span role="columnheader">{t('setup.limits.spent')}</span>
                  <span role="columnheader">{t('setup.limits.left')}</span>
                </div>
                {limitCategories.map(c => {
                  const limit = limitFor(c)
                  const spent = spendingByCategory[c] || 0
                  const left = limit - spent
                  return (
                    <div key={c} className="setup-limits-row" role="row">
                      <span className="setup-limits-cat" role="cell"><CatIcon category={c} /> {c}</span>
                      <span role="cell" data-label={t('setup.limits.limit')}>
                        <CurrencyInput className="form-input setup-limits-input" value={limit}
                          onChange={v => setLimits(l => ({ ...l, [c]: v }))} aria-label={t('setup.limits.limitOf', { category: c })} />
                      </span>
                      <span className="setup-limits-spent" role="cell" data-label={t('setup.limits.spent')}>{fmt(spent)}</span>
                      <span className={`setup-limits-left${limit > 0 && left < 0 ? ' over' : ''}`} role="cell" data-label={t('setup.limits.left')}>
                        {limit > 0 ? fmt(left) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="setup-rule">
                <i className="fi fi-rr-calculator" aria-hidden="true" />
                <span><strong>{t('setup.limits.formulaTitle')}</strong> {t('setup.limits.formula')}</span>
              </p>
            </div>
          )}

          {/* ── 5 ─────────────────────────────────────────────────────── */}
          {step === 4 && (
            <div className="setup-section">
              <div className={`setup-hero${summary.available < 0 ? ' negative' : ''}`}>
                <i className="fi fi-rr-wallet" aria-hidden="true" />
                <div>
                  <span>{t('setup.summary.canSpend')}</span>
                  <strong>{fmt(summary.available)}</strong>
                  {summary.perDay > 0 && (
                    <small>{t('setup.summary.perDay', { amount: fmt(summary.perDay), days: summary.daysLeft })}</small>
                  )}
                </div>
              </div>
              <ul className="setup-breakdown">
                <li><i className="fi fi-rr-bank" aria-hidden="true" /><span>{t('setup.summary.balance')}</span><strong>{fmt(summary.balance)}</strong></li>
                <li><i className="fi fi-rr-calendar" aria-hidden="true" /><span>{t('setup.summary.bills')}</span><strong>− {fmt(summary.bills)}</strong></li>
                <li><i className="fi fi-rr-credit-card" aria-hidden="true" /><span>{t('setup.summary.invoices')}</span><strong>− {fmt(summary.cardInvoices)}</strong></li>
                {budgets.length > 0 && (
                  <li className="info"><i className="fi fi-rr-chart-pie-alt" aria-hidden="true" /><span>{t('setup.summary.limits')}</span><strong>{fmt(summary.limitsLeft)}</strong></li>
                )}
              </ul>
              <p className="setup-note"><i className="fi fi-rr-info" aria-hidden="true" /> {t('setup.summary.note')}</p>
            </div>
          )}

          {nav}
        </section>
      </div>

      {importOpen && <StatementImport onClose={() => setImportOpen(false)} />}
      {quickOpen && (
        <QuickAdd
          onClose={() => setQuickOpen(false)}
          onExpand={(draft) => { setQuickOpen(false); setFullDraft(draft) }}
        />
      )}
      {fullDraft && (
        <TransactionModal
          draft={fullDraft}
          wallets={wallets} creditCards={creditCards} categories={categories}
          onSave={(data, mode, count, frequency) => {
            if (mode === 'unique') return addTransaction(data)
            if (mode === 'recurring') return createRecurringSeries(data, frequency, count)
            return addMultipleTransactions(data, mode, count)
          }}
          onClose={() => setFullDraft(null)}
        />
      )}
    </div>
  )
}
