import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { navigate } from '../utils/router'
import { checklistItems } from '../utils/setup'

// "Seus primeiros passos": continua o onboarding dentro do app. Cada passo
// marca sozinho a partir dos dados (conta criada, cartão cadastrado...) e leva
// para o passo certo do assistente de configuração. Some quando tudo está
// feito ou quando a pessoa dispensa.
export default function SetupChecklist() {
  const {
    wallets, creditCards, budgets, goals, transactions, thisMonth, settings, updateSettings, t,
  } = useApp()

  const items = useMemo(() => checklistItems({
    wallets, creditCards, budgets, goals, settings,
    monthTx: transactions.filter(tx => tx.date?.startsWith(thisMonth)),
  }), [wallets, creditCards, budgets, goals, transactions, thisMonth, settings])

  const done = items.filter(i => i.done).length
  // Só para quem passou pelo onboarding novo: para quem já usa o app há meses,
  // "seu espaço está pronto" não faz sentido. Esses acham o assistente em
  // Configurações.
  if (!settings.profile?.onboardedAt) return null
  if (settings.setup?.dismissed || done === items.length) return null

  const open = (item) => navigate(item.screen || `setup?step=${item.step}`)
  const dismiss = () => updateSettings({ setup: { ...(settings.setup || {}), dismissed: true } })
  const nextItem = items.find(i => !i.done)

  return (
    <section className="card setup-checklist" aria-labelledby="setup-checklist-title">
      <div className="setup-checklist-head">
        <div>
          <h2 id="setup-checklist-title">{t('setup.checklist.title')}</h2>
          <p>{t('setup.checklist.sub')}</p>
        </div>
        <button type="button" className="setup-checklist-dismiss" onClick={dismiss} aria-label={t('setup.checklist.dismiss')}>
          <i className="fi fi-rr-cross-small" aria-hidden="true" />
        </button>
      </div>

      <div className="setup-checklist-progress" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done}>
        <span style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <p className="setup-checklist-count">{t('setup.checklist.count', { done, total: items.length })}</p>

      <ul className="setup-checklist-list">
        {items.map(item => (
          <li key={item.id}>
            <button
              type="button"
              className={`setup-checklist-item${item.done ? ' done' : ''}${item === nextItem ? ' next' : ''}`}
              onClick={() => open(item)}
            >
              <i className={`fi ${item.done ? 'fi-rr-check-circle' : 'fi-rr-circle'}`} aria-hidden="true" />
              <span>{t(`setup.item.${item.id}`)}</span>
              <i className="fi fi-rr-angle-small-right" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-primary setup-checklist-cta" onClick={() => navigate('setup')}>
        {t('setup.checklist.cta')} <i className="fi fi-rr-arrow-right" aria-hidden="true" />
      </button>
    </section>
  )
}
