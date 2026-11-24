import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import CurrencyInput from './CurrencyInput'
import { BrandLockup } from './BrandLogo'
import { SummitArt, WalletPlantArt } from './OnboardingArt'
import { addMonths, isoDate, monthKey } from '../utils/date'
import { endOfMonth, monthlyNeeded } from '../utils/setup'
import { DEFAULT_WALLET_ICON, resolveWalletIcon } from '../utils/walletIcons'

// Onboarding de quem acabou de criar a conta.
//
// Começa pelo porquê (o que a pessoa quer fazer com o dinheiro) e devolve algo
// concreto antes de pedir dado chato: no passo 4 a meta já sai com "guarde
// R$ X por mês". A primeira conta fica por último porque é ela que libera o
// app — o gate em App.jsx troca esta tela pela visão geral assim que existe
// uma carteira, e lá o cartão "Seus primeiros passos" continua o caminho.
//
// Faixa etária ficou de fora de propósito: o app não usa, e dado pessoal sem
// uso é só uma pergunta a mais antes do valor aparecer.

const TOTAL_STEPS = 5

const OBJECTIVES = [
  { id: 'control', icon: 'fi-rr-chart-histogram' },
  { id: 'reserve', icon: 'fi-rr-piggy-bank', goal: true },
  { id: 'travel', icon: 'fi-rr-plane', goal: true, editableName: true },
  { id: 'debts', icon: 'fi-rr-credit-card', goal: true },
  { id: 'invest', icon: 'fi-rr-chart-line-up', goal: true },
  { id: 'dream', icon: 'fi-rr-star', goal: true, editableName: true },
]

const INCOME_TYPES = ['fixed', 'variable', 'multiple']
const TRACKING = ['none', 'bank', 'sheet', 'otherApp']

const WALLET_TYPES = [
  { value: 'checking', icon: 'fi-rr-bank' },
  { value: 'savings', icon: 'fi-rr-piggy-bank' },
  { value: 'investment', icon: 'fi-rr-chart-line-up' },
  { value: 'cash', icon: 'fi-rr-money-bill-wave' },
]

// Valor sugerido da meta: a reserva de emergência clássica é 6 meses de renda.
const defaultTarget = (id, income) => ({
  reserve: income > 0 ? income * 6 : 10000,
  travel: 5000,
  debts: 0,
  invest: 2000,
  dream: 8000,
}[id] ?? 0)

function Choice({ selected, onClick, title, sub, role = 'radio' }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      className={`onb-choice${selected ? ' selected' : ''}`}
      onClick={onClick}
    >
      <span className={`onb-choice-mark onb-choice-mark--${role}`} aria-hidden="true">
        {selected && <i className="fi fi-rr-check" />}
      </span>
      <span className="onb-choice-text">
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </span>
    </button>
  )
}

export default function Onboarding() {
  const { addWallet, addGoal, updateSettings, settings, wallets, dbError, formatCurrency: fmt, t } = useApp()
  const today = isoDate()

  const [step, setStep] = useState(1)
  const [objectives, setObjectives] = useState([])
  const [profile, setProfile] = useState({ incomeType: '', monthlyIncome: 0, incomeLater: false, tracking: '' })
  const [goal, setGoal] = useState(null) // { id, name, target, month } ou null = sem meta
  const [goalTouched, setGoalTouched] = useState(false)
  const [account, setAccount] = useState({ type: 'checking', name: '', balance: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Um clique repetido em Concluir (ou nova tentativa depois de erro) não
  // pode criar uma segunda meta.
  const goalSaved = useRef(false)

  const setP = (k, v) => setProfile(p => ({ ...p, [k]: v }))
  const setG = (k, v) => { setGoalTouched(true); setGoal(g => ({ ...g, [k]: v })) }
  const setA = (k, v) => setAccount(a => ({ ...a, [k]: v }))

  // A meta detalhada é a do primeiro objetivo que vira meta, na ordem da lista.
  const goalObjective = OBJECTIVES.find(o => o.goal && objectives.includes(o.id))
  const income = profile.incomeLater ? 0 : Number(profile.monthlyIncome) || 0

  const toggleObjective = (id) => setObjectives(list =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  // Ao entrar no passo da meta, sugere valor e prazo — a menos que a pessoa
  // já tenha mexido nela e só voltou um passo.
  const goToGoal = () => {
    if (!goalObjective) return setStep(5)
    if (!goalTouched || goal?.id !== goalObjective.id) {
      setGoal({
        id: goalObjective.id,
        name: t(`onb.goal.${goalObjective.id}.name`),
        target: defaultTarget(goalObjective.id, income),
        // Reserva de 6 rendas em 12 meses pediria metade da renda por mês;
        // 24 meses dá uma sugestão que a pessoa consegue cumprir.
        month: monthKey(new Date(`${addMonths(today, goalObjective.id === 'reserve' ? 24 : 12)}T12:00:00`)),
      })
      setGoalTouched(false)
    }
    setStep(4)
  }

  const next = () => {
    if (step === 3) return goToGoal()
    setStep(s => Math.min(TOTAL_STEPS, s + 1))
  }
  const back = () => {
    if (step === 5 && !goalObjective) return setStep(3)
    setStep(s => Math.max(1, s - 1))
  }

  const skipGoal = () => { setGoal(null); setStep(5) }

  const goalValid = goal && goal.name.trim() && Number(goal.target) > 0 && goal.month
  const perMonth = goalValid ? monthlyNeeded(goal.target, today, goal.month) : 0

  const finish = async ({ skipAccount = false } = {}) => {
    setSaving(true)
    setError('')
    try {
      if (goal && goalValid && !goalSaved.current) {
        await addGoal({
          name: goal.name.trim(),
          target: Number(goal.target),
          current: 0,
          deadline: endOfMonth(goal.month),
        })
        goalSaved.current = true
      }

      updateSettings({
        profile: {
          ...(settings.profile || {}),
          objectives,
          incomeType: profile.incomeType,
          monthlyIncome: income,
          tracking: profile.tracking,
          onboardedAt: today,
        },
      })

      // Por último: a carteira desmonta esta tela (ver App.jsx).
      const name = account.name.trim() || t('onb.account.defaultName')
      await addWallet({
        name,
        type: account.type,
        balance: skipAccount ? 0 : Number(account.balance) || 0,
        color: '#0053EF',
        icon: resolveWalletIcon(DEFAULT_WALLET_ICON, account.type),
      })
    } catch (err) {
      console.error('[Onboarding]', err)
      setError(t('onb.saveFailed', { error: err?.code || err?.message || String(err) }))
      setSaving(false)
    }
  }

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="onb-top">
          <BrandLockup className="onboarding-logo" />
        </div>

        <div className="onb-progress" aria-label={t('onb.progress', { step, total: TOTAL_STEPS })}>
          <div className="onb-progress-bars">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span key={i} className={i < step ? 'on' : ''} />
            ))}
          </div>
          {step > 1 && <span className="onb-progress-label">{t('onb.progress', { step, total: TOTAL_STEPS })}</span>}
        </div>

        {dbError && (
          <div className="onb-alert">{t('onb.dbError', { error: dbError, count: wallets.length })}</div>
        )}

        {/* ── 1. Boas-vindas ───────────────────────────────────────────── */}
        {step === 1 && (
          <section className="onb-step onb-step--welcome">
            <h1 className="onb-title onb-title--hero">
              {t('onb.welcome.title1')} <span className="onb-underline">{t('onb.welcome.title2')}</span>
            </h1>
            <p className="onb-sub">{t('onb.welcome.sub')}</p>
            <WalletPlantArt className="onb-art" />
            <div className="onb-actions">
              <button className="btn btn-primary onb-cta" onClick={next} autoFocus>
                {t('onb.start')} <i className="fi fi-rr-arrow-right" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* ── 2. Objetivos ─────────────────────────────────────────────── */}
        {step === 2 && (
          <section className="onb-step">
            <h1 className="onb-title">{t('onb.objectives.title')}</h1>
            <p className="onb-sub">{t('onb.objectives.sub')}</p>
            <div className="onb-objectives" role="group" aria-label={t('onb.objectives.title')}>
              {OBJECTIVES.map(o => {
                const on = objectives.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={`onb-objective${on ? ' selected' : ''}`}
                    onClick={() => toggleObjective(o.id)}
                  >
                    {on && <i className="fi fi-rr-check onb-objective-check" aria-hidden="true" />}
                    <i className={`fi ${o.icon} onb-objective-icon`} aria-hidden="true" />
                    <strong>{t(`onb.objective.${o.id}`)}</strong>
                    <small>{t(`onb.objective.${o.id}.sub`)}</small>
                  </button>
                )
              })}
            </div>
            <div className="onb-actions">
              <button className="btn btn-primary onb-cta" onClick={next} disabled={!objectives.length}>
                {t('onb.continue')} <i className="fi fi-rr-arrow-right" aria-hidden="true" />
              </button>
              <button className="onb-later" onClick={() => { setObjectives([]); next() }}>{t('onb.later')}</button>
            </div>
          </section>
        )}

        {/* ── 3. Renda e hábitos ───────────────────────────────────────── */}
        {step === 3 && (
          <section className="onb-step">
            <div className="onb-heading-art">
              <span className="onb-heading-icon"><i className="fi fi-rr-wallet" aria-hidden="true" /></span>
              <div>
                <h1 className="onb-title">{t('onb.money.title')}</h1>
                <p className="onb-sub">{t('onb.money.sub')}</p>
              </div>
            </div>

            <h2 className="onb-question">{t('onb.money.incomeType')}</h2>
            <div className="onb-choices" role="radiogroup" aria-label={t('onb.money.incomeType')}>
              {INCOME_TYPES.map(v => (
                <Choice key={v} selected={profile.incomeType === v} onClick={() => setP('incomeType', v)}
                  title={t(`onb.income.${v}`)} sub={t(`onb.income.${v}.sub`)} />
              ))}
            </div>

            <h2 className="onb-question">
              {t('onb.money.incomeAmount')} <span className="onb-optional">{t('onb.optional')}</span>
            </h2>
            <div className="onb-income-row">
              <CurrencyInput
                className="form-input onb-money-input"
                value={profile.incomeLater ? 0 : profile.monthlyIncome}
                onChange={v => setProfile(p => ({ ...p, monthlyIncome: v, incomeLater: false }))}
                disabled={profile.incomeLater}
                aria-label={t('onb.money.incomeAmount')}
              />
              <label className="onb-check">
                <input type="checkbox" checked={profile.incomeLater} onChange={e => setP('incomeLater', e.target.checked)} />
                {t('onb.money.incomeLater')}
              </label>
            </div>

            <h2 className="onb-question">{t('onb.money.tracking')}</h2>
            <div className="onb-choices" role="radiogroup" aria-label={t('onb.money.tracking')}>
              {TRACKING.map(v => (
                <Choice key={v} selected={profile.tracking === v} onClick={() => setP('tracking', v)}
                  title={t(`onb.tracking.${v}`)} sub={t(`onb.tracking.${v}.sub`)} />
              ))}
            </div>

            <div className="onb-tip">
              <i className="fi fi-rr-bulb" aria-hidden="true" />
              <div><strong>{t('onb.money.tipTitle')}</strong><span>{t('onb.money.tip')}</span></div>
            </div>

            <div className="onb-actions">
              <button className="btn btn-primary onb-cta" onClick={next}>
                {t('onb.continue')} <i className="fi fi-rr-arrow-right" aria-hidden="true" />
              </button>
              <div className="onb-actions-row">
                <button className="onb-later" onClick={back}>{t('onb.back')}</button>
                <button className="onb-later" onClick={() => { setProfile({ incomeType: '', monthlyIncome: 0, incomeLater: false, tracking: '' }); next() }}>
                  {t('onb.later')}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── 4. A meta ────────────────────────────────────────────────── */}
        {step === 4 && goal && (
          <section className="onb-step">
            <h1 className="onb-title">{t('onb.goal.title')}</h1>
            <p className="onb-sub">{t(objectives.filter(id => OBJECTIVES.find(o => o.id === id)?.goal).length > 1 ? 'onb.goal.subMany' : 'onb.goal.sub')}</p>

            <div className="onb-goal">
              <div className="onb-goal-head">
                <i className={`fi ${goalObjective.icon}`} aria-hidden="true" />
                <strong>{goal.name || t(`onb.goal.${goal.id}.name`)}</strong>
              </div>
              <div className="onb-goal-body">
                {goalObjective.editableName && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="onb-goal-name">{t(`onb.goal.${goal.id}.nameLabel`)}</label>
                    <input id="onb-goal-name" className="form-input" value={goal.name} maxLength={80}
                      onChange={e => setG('name', e.target.value)} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{t(`onb.goal.${goal.id}.amount`)}</label>
                  <CurrencyInput className="form-input onb-money-input" value={goal.target}
                    onChange={v => setG('target', v)} aria-label={t(`onb.goal.${goal.id}.amount`)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="onb-goal-month">{t(`onb.goal.${goal.id}.when`)}</label>
                  <input id="onb-goal-month" className="form-input" type="month" value={goal.month}
                    min={today.slice(0, 7)} onChange={e => e.target.value && setG('month', e.target.value)} />
                </div>

                <div className="onb-plan">
                  <SummitArt className="onb-plan-art" />
                  <p>
                    {perMonth > 0
                      ? t(goal.id === 'debts' ? 'onb.goal.planDebts' : 'onb.goal.plan', { amount: fmt(perMonth) })
                      : t('onb.goal.planEmpty')}
                    {perMonth > 0 && income > 0 && (
                      <small>{t('onb.goal.planShare', { pct: Math.round((perMonth / income) * 100) })}</small>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="onb-actions">
              <button className="btn btn-primary onb-cta" onClick={() => setStep(5)} disabled={!goalValid}>
                {t('onb.continue')} <i className="fi fi-rr-arrow-right" aria-hidden="true" />
              </button>
              <div className="onb-actions-row">
                <button className="onb-later" onClick={back}>{t('onb.back')}</button>
                <button className="onb-later" onClick={skipGoal}>{t('onb.later')}</button>
              </div>
            </div>
          </section>
        )}

        {/* ── 5. Primeira conta ────────────────────────────────────────── */}
        {step === 5 && (
          <section className="onb-step">
            <h1 className="onb-title">{t('onb.account.title')}</h1>
            <p className="onb-sub">{t('onb.account.sub')}</p>

            <div className="onb-account-types" role="radiogroup" aria-label={t('wallet.type')}>
              {WALLET_TYPES.map(w => (
                <button key={w.value} type="button" role="radio" aria-checked={account.type === w.value}
                  className={`onb-account-type${account.type === w.value ? ' selected' : ''}`}
                  onClick={() => setA('type', w.value)}>
                  {account.type === w.value && <i className="fi fi-rr-check onb-objective-check" aria-hidden="true" />}
                  <i className={`fi ${w.icon}`} aria-hidden="true" />
                  <span>{t(`wallet.type.${w.value}`)}</span>
                </button>
              ))}
            </div>

            <div className="onb-account-fields">
              <div className="form-group">
                <label className="form-label" htmlFor="onb-account-name">{t('onb.account.name')}</label>
                <input id="onb-account-name" className="form-input" value={account.name} maxLength={60}
                  placeholder={t('onb.account.namePlaceholder')} onChange={e => setA('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('onb.account.balance')}</label>
                <CurrencyInput className="form-input" value={account.balance}
                  onChange={v => setA('balance', v)} aria-label={t('onb.account.balance')} />
              </div>
            </div>

            <div className="onb-tip">
              <i className="fi fi-rr-info" aria-hidden="true" />
              <div><strong>{t('onb.account.midMonthTitle')}</strong><span>{t('onb.account.midMonth')}</span></div>
            </div>

            {error && <div className="onb-alert">{error}</div>}

            <div className="onb-actions">
              <button className="btn btn-primary onb-cta" onClick={() => finish()} disabled={saving || !account.name.trim()}>
                {saving ? t('onb.saving') : t('onb.finish')}
                {!saving && <i className="fi fi-rr-arrow-right" aria-hidden="true" />}
              </button>
              <div className="onb-actions-row">
                <button className="onb-later" onClick={back} disabled={saving}>{t('onb.back')}</button>
                <button className="onb-later" onClick={() => finish({ skipAccount: true })} disabled={saving}>
                  {t('onb.account.skip')}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
