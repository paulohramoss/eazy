import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CatIcon, useApp } from '../context/AppContext'
import { frequentEntries, parseQuickEntry } from '../utils/quickParse'
import { useToast } from './Toast'

// Lançamento rápido.
//
// O modal completo pede 11 campos — proporcional a um financiamento, absurdo
// para o lanche de R$ 18, que é o lançamento que mais acontece e o que mais
// deixa de ser registrado. Aqui é uma linha: "almoço 32" e Enter.
//
// O que não couber (parcelar, anexar comprovante, escolher cartão) sai pelo
// "mais opções", que abre o modal de sempre já preenchido com o que foi
// entendido — ninguém redigita.

export default function QuickAdd({ onClose, onExpand, initialText = '' }) {
  const {
    transactions, categories, wallets, addTransaction,
    formatCurrency: fmt, t,
  } = useApp()
  const toast = useToast()

  const [text, setText] = useState(initialText)
  const [override, setOverride] = useState(null)   // categoria escolhida à mão
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    // requestAnimationFrame pelo mesmo motivo da paleta: autoFocus não vence
    // o portal recém-montado em todo navegador.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // As 40 transações mais recentes bastam para reconhecer um hábito e evitam
  // varrer o histórico inteiro a cada tecla.
  const history = useMemo(
    () => [...transactions]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 40),
    [transactions])

  const parsed = useMemo(
    () => parseQuickEntry(text, { categories, history }),
    [text, categories, history])

  const frequent = useMemo(
    () => frequentEntries(transactions, { limit: 3 }),
    [transactions])

  const category = override || parsed.category
  const ready = parsed.amount !== null && parsed.amount > 0

  // A categoria provável primeiro: na maioria das vezes o primeiro chip já é
  // o certo, e aí não se toca em nenhum.
  const orderedCategories = useMemo(
    () => [category, ...categories.filter(c => c !== category)],
    [category, categories])

  const build = () => ({
    type: parsed.type,
    name: parsed.name,
    category,
    amount: parsed.amount,
    date: parsed.date,
    status: parsed.status,
    walletId: wallets[0]?.id || '',
    cardId: '',
    notes: '',
    tags: [],
  })

  const handleSave = async () => {
    if (!ready || saving) return
    setSaving(true)
    try {
      await addTransaction(build())
      toast.success(t('quickAdd.saved', { name: parsed.name, amount: fmt(parsed.amount) }))
      onClose()
    } catch {
      toast.error(t('quickAdd.saveError'))
      setSaving(false)
    }
  }

  const applyFrequent = (entry) => {
    // Preenche a linha em vez de salvar direto: o valor do almoço muda, e
    // gravar no primeiro toque tiraria a chance de corrigir.
    setText(`${entry.name} ${String(entry.amount).replace('.', ',')}`)
    setOverride(entry.category)
    inputRef.current?.focus()
  }

  return createPortal(
    <div className="quick-add-backdrop" onClick={onClose}>
      <div
        className="quick-add"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('quickAdd.title')}
      >
        {/* Linha de entrada */}
        <div className="quick-add-input-row">
          <i className={`fi ${parsed.type === 'income' ? 'fi-rr-arrow-down-left' : 'fi-rr-arrow-up-right'} quick-add-type-icon ${parsed.type}`} aria-hidden="true" />
          <input
            ref={inputRef}
            className="quick-add-input"
            value={text}
            onChange={e => { setText(e.target.value); setOverride(null) }}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder={t('quickAdd.placeholder')}
            aria-label={t('quickAdd.title')}
          />
          {ready && (
            <span className={`quick-add-amount ${parsed.type}`}>
              {parsed.type === 'income' ? '+' : '−'}{fmt(parsed.amount)}
            </span>
          )}
        </div>

        {/* O que foi entendido, ou o atalho para os hábitos */}
        {!ready ? (
          <div className="quick-add-hint-row">
            {frequent.length > 0 ? (
              <>
                <span className="quick-add-hint-label">{t('quickAdd.frequent')}</span>
                <div className="quick-add-chips">
                  {frequent.map(entry => (
                    <button
                      key={entry.name}
                      type="button"
                      className="quick-add-chip quick-add-chip--frequent"
                      onClick={() => applyFrequent(entry)}
                    >
                      <CatIcon category={entry.category} />
                      <span>{entry.name}</span>
                      <span className="quick-add-chip-amount">{fmt(entry.amount)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className="quick-add-hint">{t('quickAdd.hint')}</span>
            )}
          </div>
        ) : (
          <div className="quick-add-hint-row">
            <span className="quick-add-hint-label">{t('tx.category')}</span>
            <div className="quick-add-chips quick-add-chips--scroll">
              {orderedCategories.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`quick-add-chip${c === category ? ' active' : ''}`}
                  onClick={() => setOverride(c)}
                  aria-pressed={c === category}
                >
                  <CatIcon category={c} />
                  <span>{c}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="quick-add-footer">
          <button type="button" className="quick-add-expand" onClick={() => onExpand(build())}>
            <i className="fi fi-rr-settings-sliders" aria-hidden="true" />
            {t('quickAdd.more')}
          </button>
          <div className="quick-add-actions">
            <kbd className="quick-add-kbd">Enter</kbd>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!ready || saving}
            >
              {t('action.save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
