import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CatIcon, useApp } from '../context/AppContext'
import { apiPost } from '../utils/api'
import { GOAL_CATEGORY } from '../utils/categories'
import { addMonths, isoDate } from '../utils/date'
import { compressImage } from '../utils/image'
import { useSpeech } from '../utils/speech'
import { splitInstallments } from '../utils/installments'
import { frequentEntries, needsAi, parseQuickEntry } from '../utils/quickParse'
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
//
// Frase que o parser local não entende ("uber 20 e mercado 100 no nubank")
// vai para a IA (/api/parse-entry). A IA só propõe: a lista aparece aqui e
// nada é gravado até a pessoa confirmar.
//
// "geladeira 2.400 em 10x" vira as 10 parcelas de uma vez, pelo mesmo
// addMultipleTransactions do modal completo.
//
// Também aceita voz (ditado do navegador, vira texto aqui mesmo) e foto do
// cupom ou comprovante, que vai direto para a IA.

// Servidor sem ANTHROPIC_API_KEY responde 503. Guardado no módulo para o botão
// sumir na sessão inteira em vez de falhar a cada abertura.
let aiUnavailable = false

export default function QuickAdd({ onClose, onExpand, initialText = '' }) {
  const {
    transactions, categories, wallets, creditCards = [], addTransaction, addMultipleTransactions,
    formatCurrency: fmt, formatDate, settings, t,
  } = useApp()
  const toast = useToast()

  const [text, setText] = useState(initialText)
  const [override, setOverride] = useState(null)   // categoria escolhida à mão
  const [saving, setSaving] = useState(false)
  const [aiEntries, setAiEntries] = useState(null) // null = modo local
  const [aiLoading, setAiLoading] = useState(false)
  const [aiOff, setAiOff] = useState(aiUnavailable)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const aiRequest = useRef(0)
  const [fromPhoto, setFromPhoto] = useState(false)

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
  const wantsAi = !aiOff && needsAi(text, parsed)
  const aiMode = aiEntries !== null

  // A categoria provável primeiro: na maioria das vezes o primeiro chip já é
  // o certo, e aí não se toca em nenhum.
  const orderedCategories = useMemo(
    () => [category, ...categories.filter(c => c !== category)],
    [category, categories])

  const nameOf = useMemo(() => {
    const map = new Map()
    for (const w of wallets) map.set(w.id, w.name)
    for (const c of creditCards) map.set(c.id, c.name)
    return (id) => map.get(id) || ''
  }, [wallets, creditCards])

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

  // Item da IA no formato que addTransaction e o modal completo esperam.
  // Sem carteira nem cartão, cai na primeira carteira, como o caminho local.
  // O número de parcelas não é campo do lançamento: vai à parte para save().
  const fromAi = ({ installments: _n, ...entry }) => ({
    ...entry,
    walletId: entry.cardId ? '' : (entry.walletId || wallets[0]?.id || ''),
    notes: '',
    tags: [],
  })

  // Grava um lançamento à vista ou as N parcelas (amount é sempre o total).
  const save = (data, installments) => (installments
    ? addMultipleTransactions(data, 'installment', installments)
    : addTransaction(data))

  // Valor de cada parcela para mostrar: a 1ª leva a sobra de centavos, as
  // demais são iguais — mostra a que se repete.
  const perInstallment = (amount, n) => splitInstallments(amount, n)[n - 1]

  const changeText = (value) => {
    setText(value)
    setOverride(null)
    // Texto mudou, a proposta da IA ficou velha. Uma resposta em voo também.
    aiRequest.current += 1
    setAiEntries(null)
    setAiLoading(false)
  }

  const runAi = async ({ inputText = text, image = null } = {}) => {
    if (aiLoading || (!inputText.trim() && !image)) return
    const id = ++aiRequest.current
    setAiLoading(true)
    setFromPhoto(!!image)
    try {
      const { entries = [] } = await apiPost('/api/parse-entry', {
        text: inputText,
        ...(image ? { image } : {}),
        today: isoDate(),
        categories: categories.filter(c => c !== GOAL_CATEGORY),
        wallets: wallets.map(w => ({ id: w.id, name: w.name })),
        cards: creditCards.map(c => ({ id: c.id, name: c.name })),
      })
      if (id !== aiRequest.current) return
      if (!entries.length) {
        toast.info(t(image ? 'quickAdd.photo.empty' : 'quickAdd.ai.empty'))
        setAiLoading(false)
        return
      }
      setAiEntries(entries)
    } catch (err) {
      if (id !== aiRequest.current) return
      if (err.status === 503) {
        aiUnavailable = true
        setAiOff(true)
      }
      toast.error(err.status === 429 ? t('quickAdd.ai.rateLimited')
        : err.status === 413 ? t('quickAdd.photo.tooBig')
        : t('quickAdd.ai.error'))
    }
    if (id === aiRequest.current) setAiLoading(false)
  }

  // Ditado: o parcial aparece na linha enquanto a pessoa fala. No fim, frase
  // que o parser local entende fica para o Enter; o resto vai para a IA.
  const speech = useSpeech({
    lang: settings?.language || 'pt-BR',
    onInterim: (value) => { aiRequest.current += 1; setAiEntries(null); setOverride(null); setText(value) },
    onFinal: (value) => {
      setText(value)
      const local = parseQuickEntry(value, { categories, history })
      if (!aiOff && needsAi(value, local)) runAi({ inputText: value })
    },
    onError: (code) => {
      if (code === 'not-allowed' || code === 'service-not-allowed') toast.error(t('quickAdd.voice.denied'))
      else if (code !== 'no-speech') toast.error(t('quickAdd.voice.error'))
    },
  })

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // a mesma foto de novo precisa disparar onChange
    if (!file) return
    try {
      const image = await compressImage(file)
      // O texto já digitado vai junto: "só metade", "foi no crédito".
      await runAi({ inputText: text, image })
    } catch {
      toast.error(t('quickAdd.photo.error'))
    }
  }

  const removeAiEntry = (index) => {
    const next = aiEntries.filter((_, i) => i !== index)
    setAiEntries(next.length ? next : null)
    inputRef.current?.focus()
  }

  const handleSave = async () => {
    if (saving || aiLoading) return

    if (aiMode) {
      setSaving(true)
      let saved = 0
      try {
        // Em sequência: as notificações de orçamento e de cartão leem o estado
        // e dariam aviso duplicado com gravações em paralelo.
        for (const entry of aiEntries) {
          await save(fromAi(entry), entry.installments)
          saved += 1
        }
        toast.success(saved === 1
          ? t('quickAdd.saved', { name: aiEntries[0].name, amount: fmt(aiEntries[0].amount) })
          : t('quickAdd.ai.savedMany', { count: saved }))
        onClose()
      } catch {
        // Os que já foram ficam; tira-os da lista para não duplicar no retry.
        if (saved) setAiEntries(aiEntries.slice(saved))
        toast.error(t('quickAdd.saveError'))
        setSaving(false)
      }
      return
    }

    // Enter numa frase que o local não entende pergunta à IA em vez de gravar
    // uma leitura pela metade.
    if (wantsAi) return runAi()
    if (!ready) return

    setSaving(true)
    try {
      await save(build(), parsed.installments)
      toast.success(parsed.installments
        ? t('quickAdd.savedInstallments', { name: parsed.name, count: parsed.installments, amount: fmt(perInstallment(parsed.amount, parsed.installments)) })
        : t('quickAdd.saved', { name: parsed.name, amount: fmt(parsed.amount) }))
      onClose()
    } catch {
      toast.error(t('quickAdd.saveError'))
      setSaving(false)
    }
  }

  const applyFrequent = (entry) => {
    // Preenche a linha em vez de salvar direto: o valor do almoço muda, e
    // gravar no primeiro toque tiraria a chance de corrigir.
    changeText(`${entry.name} ${String(entry.amount).replace('.', ',')}`)
    setOverride(entry.category)
    inputRef.current?.focus()
  }

  const expand = () => {
    if (aiMode && aiEntries.length === 1) {
      return onExpand({ ...fromAi(aiEntries[0]), installments: aiEntries[0].installments })
    }
    onExpand({ ...build(), installments: parsed.installments })
  }

  const today = isoDate()
  const aiTotal = aiMode
    ? aiEntries.reduce((sum, e) => sum + (e.type === 'income' ? e.amount : -e.amount), 0)
    : 0
  const canSave = aiMode ? aiEntries.length > 0 : (ready || wantsAi)
  const saveLabel = aiMode
    ? (aiEntries.length > 1 ? t('quickAdd.ai.saveMany', { count: aiEntries.length }) : t('action.save'))
    : (wantsAi ? t('quickAdd.ai.understand') : t('action.save'))

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
          <i className={`fi ${aiMode ? 'fi-rr-sparkles' : (parsed.type === 'income' ? 'fi-rr-arrow-down-left' : 'fi-rr-arrow-up-right')} quick-add-type-icon ${aiMode ? 'ai' : parsed.type}`} aria-hidden="true" />
          <input
            ref={inputRef}
            className="quick-add-input"
            value={text}
            onChange={e => changeText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder={t(speech.listening ? 'quickAdd.voice.listening'
              : (aiMode && fromPhoto) ? 'quickAdd.photo.done' : 'quickAdd.placeholder')}
            aria-label={t('quickAdd.title')}
          />
          {aiLoading && <i className="fi fi-rr-spinner quick-add-spinner" aria-label={t(fromPhoto ? 'quickAdd.photo.loading' : 'quickAdd.ai.loading')} />}
          {!aiLoading && !aiMode && !text && (
            <div className="quick-add-tools">
              {speech.supported && (
                <button
                  type="button"
                  className={`quick-add-tool${speech.listening ? ' listening' : ''}`}
                  onClick={speech.listening ? speech.stop : speech.start}
                  aria-label={t(speech.listening ? 'quickAdd.voice.stop' : 'quickAdd.voice.start')}
                  aria-pressed={speech.listening}
                >
                  <i className="fi fi-rr-microphone" aria-hidden="true" />
                </button>
              )}
              {!aiOff && (
                <button
                  type="button"
                  className="quick-add-tool"
                  onClick={() => fileRef.current?.click()}
                  aria-label={t('quickAdd.photo.start')}
                >
                  <i className="fi fi-rr-camera" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {speech.listening && text && (
            <button type="button" className="quick-add-tool listening" onClick={speech.stop} aria-label={t('quickAdd.voice.stop')}>
              <i className="fi fi-rr-microphone" aria-hidden="true" />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={onPhoto}
          />
          {!aiLoading && aiMode && aiEntries.length > 1 && (
            <span className={`quick-add-amount ${aiTotal >= 0 ? 'income' : 'expense'}`}>
              {aiTotal >= 0 ? '+' : '−'}{fmt(Math.abs(aiTotal))}
            </span>
          )}
          {!aiLoading && !aiMode && ready && !wantsAi && (
            <span className={`quick-add-amount ${parsed.type}`}>
              {parsed.type === 'income' ? '+' : '−'}{fmt(parsed.amount)}
            </span>
          )}
        </div>

        {/* Parcelamento entendido: quanto e até quando, antes de gravar. */}
        {!aiLoading && !aiMode && ready && !wantsAi && parsed.installments && (
          <div className="quick-add-installments">
            <i className="fi fi-rr-calendar" aria-hidden="true" />
            {t('quickAdd.installmentsPlan', {
              count: parsed.installments,
              amount: fmt(perInstallment(parsed.amount, parsed.installments)),
              last: formatDate(addMonths(parsed.date, parsed.installments - 1)),
            })}
          </div>
        )}

        {/* O que a IA entendeu: confirmação antes de gravar */}
        {aiMode ? (
          <ul className="quick-add-ai-list" aria-label={t('quickAdd.ai.review')}>
            {aiEntries.map((entry, i) => {
              const where = nameOf(entry.cardId || entry.walletId)
              return (
                <li key={i} className="quick-add-ai-item">
                  <CatIcon category={entry.category} />
                  <div className="quick-add-ai-main">
                    <span className="quick-add-ai-name">{entry.name}</span>
                    <span className="quick-add-ai-meta">
                      {entry.category}
                      {entry.date !== today && ` · ${formatDate(entry.date)}`}
                      {where && ` · ${where}`}
                      {entry.installments && ` · ${entry.installments}× ${fmt(perInstallment(entry.amount, entry.installments))}`}
                    </span>
                  </div>
                  <span className={`quick-add-ai-amount ${entry.type}`}>
                    {entry.type === 'income' ? '+' : '−'}{fmt(entry.amount)}
                  </span>
                  <button
                    type="button"
                    className="quick-add-ai-remove"
                    onClick={() => removeAiEntry(i)}
                    aria-label={t('quickAdd.ai.remove', { name: entry.name })}
                  >
                    <i className="fi fi-rr-cross-small" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : !ready || wantsAi ? (
          <div className="quick-add-hint-row">
            {wantsAi ? (
              <span className="quick-add-hint">
                <i className="fi fi-rr-sparkles" aria-hidden="true" /> {t('quickAdd.ai.hint')}
              </span>
            ) : frequent.length > 0 ? (
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
          {(!aiMode || aiEntries.length === 1) ? (
            <button type="button" className="quick-add-expand" onClick={expand}>
              <i className="fi fi-rr-settings-sliders" aria-hidden="true" />
              {t('quickAdd.more')}
            </button>
          ) : (
            <span className="quick-add-hint">{t('quickAdd.ai.confirm')}</span>
          )}
          <div className="quick-add-actions">
            {/* Escape para quem preferir a leitura local mesmo com a IA sugerida. */}
            {!aiMode && wantsAi && ready && (
              <button type="button" className="quick-add-expand" onClick={() => { setAiOff(true) }}>
                {t('quickAdd.ai.skip')}
              </button>
            )}
            <kbd className="quick-add-kbd">Enter</kbd>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!canSave || saving || aiLoading}
            >
              {wantsAi && !aiMode && <i className="fi fi-rr-sparkles" aria-hidden="true" style={{ marginRight: 6 }} />}
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
