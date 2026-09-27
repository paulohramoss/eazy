import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { buildEqualSplit, ownShare, pendingTotal } from '../utils/split'

// Divisão de conta: quem estava junto e quanto cada um deve.
//
// Os nomes são texto livre, não contas do app. É de propósito: exigir que o
// amigo se cadastre para você anotar que ele te deve R$ 30 mata a feature no
// primeiro uso. Quando existir conta compartilhada de verdade, estes nomes
// viram o ponto de ligação.

export default function SplitEditor({ amount, split, onChange, onSettle }) {
  const { formatCurrency: fmt, t } = useApp()
  const [nameInput, setNameInput] = useState('')

  const participants = split?.participants || []
  const total = Number(amount) || 0
  const mine = ownShare(total, split)
  const pending = pendingTotal(split)

  const addPerson = () => {
    const name = nameInput.trim()
    if (!name) return
    if (participants.some(p => p.name.toLowerCase() === name.toLowerCase())) return

    // Redivide igualmente a cada entrada: quem chega depois muda a conta de
    // todo mundo, e refazer é mais previsível que ajustar incrementalmente.
    const names = [...participants.map(p => p.name), name]
    const next = buildEqualSplit(total, names)
    // Preserva quem já acertou — redividir não pode desfazer um pagamento.
    if (next) {
      next.participants = next.participants.map(p => ({
        ...p,
        settled: participants.find(old => old.name === p.name)?.settled || false,
      }))
    }
    onChange(next)
    setNameInput('')
  }

  const removePerson = (name) => {
    const names = participants.filter(p => p.name !== name).map(p => p.name)
    onChange(names.length ? buildEqualSplit(total, names) : null)
  }

  return (
    <div className="split-editor">
      {total <= 0 ? (
        <div className="split-empty">{t('split.needAmount')}</div>
      ) : (
        <>
          <div className="split-add-row">
            <input
              className="form-input"
              placeholder={t('split.namePlaceholder')}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addPerson() }
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={addPerson}>
              <i className="fi fi-rr-user-add" aria-hidden="true" />
              {t('split.add')}
            </button>
          </div>

          {participants.length > 0 && (
            <>
              <div className="split-list">
                {/* Sua parte primeiro: é a informação que a pessoa procura. */}
                <div className="split-row split-row--me">
                  <i className="fi fi-rr-user" aria-hidden="true" />
                  <span className="split-name">{t('split.you')}</span>
                  <span className="split-amount">{fmt(mine)}</span>
                </div>

                {participants.map(p => (
                  <div key={p.name} className={`split-row${p.settled ? ' settled' : ''}`}>
                    <i className={`fi ${p.settled ? 'fi-rr-check' : 'fi-rr-user'}`} aria-hidden="true" />
                    <span className="split-name">{p.name}</span>
                    <span className="split-amount">{fmt(p.amount)}</span>
                    {p.settled ? (
                      <span className="split-settled-tag">{t('split.settled')}</span>
                    ) : (
                      <>
                        {onSettle && (
                          <button
                            type="button"
                            className="split-action"
                            onClick={() => onSettle(p)}
                            title={t('split.settleHint')}
                          >
                            {t('split.settle')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="split-action split-action--remove"
                          onClick={() => removePerson(p.name)}
                          aria-label={t('split.remove', { name: p.name })}
                        >
                          <i className="fi fi-rr-cross-small" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {pending > 0 && (
                <div className="split-summary">
                  <i className="fi fi-rr-hand-holding-usd" aria-hidden="true" />
                  <span>{t('split.pending', { amount: fmt(pending) })}</span>
                </div>
              )}

              {/* O saldo não é dividido, e esconder isso geraria desconfiança
                  quando a carteira mostrasse a saída cheia. */}
              <div className="split-note">{t('split.note', { total: fmt(total) })}</div>
            </>
          )}
        </>
      )}
    </div>
  )
}
