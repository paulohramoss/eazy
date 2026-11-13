import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { apiPost } from '../utils/api'
import { buildAskData } from '../utils/askPayload'
import { isoDate } from '../utils/date'
import EmptyState from './EmptyState'

// Pergunte ao Eazy.
//
// Uma conversa curta sobre os próprios números: "quanto gastei com mercado
// esse mês?", "o que mais subiu desde setembro?". O servidor faz as contas a
// partir dos lançamentos que já estão em memória aqui — a IA só escolhe o que
// consultar e escreve a resposta.
//
// A conversa não é salva: some ao sair da tela. Pergunta financeira é dado
// sensível, e guardar histórico pediria regra e tela de apagar.

const SUGGESTIONS = ['ask.s1', 'ask.s2', 'ask.s3', 'ask.s4']

// Servidor sem chave responde 503; o estado vale para a sessão toda.
let aiUnavailable = false

// Markdown mínimo, sem innerHTML: **negrito**, listas com "- " e parágrafos.
// É o que o prompt pede ao modelo, e nada além disso é interpretado.
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part)
}

function Answer({ text }) {
  const blocks = []
  let list = null
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (item) {
      if (!list) { list = []; blocks.push({ list }) }
      list.push(item[1])
    } else if (line.trim()) {
      list = null
      blocks.push({ p: line.trim() })
    } else {
      list = null
    }
  }
  return blocks.map((b, i) => b.list
    ? <ul key={i}>{b.list.map((li, j) => <li key={j}>{renderInline(li)}</li>)}</ul>
    : <p key={i}>{renderInline(b.p)}</p>)
}

export default function Ask() {
  const {
    transactions, wallets, walletBalances, creditCards, getCardCurrentUsed,
    budgets, goals, settings, t,
  } = useApp()

  const [messages, setMessages] = useState([])   // { role, content, error? }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiOff, setAiOff] = useState(aiUnavailable)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const ask = async (raw) => {
    const question = String(raw ?? input).trim()
    if (!question || loading) return
    setInput('')

    // Só as trocas que deram certo viram contexto: uma mensagem de erro no
    // histórico confundiria a próxima resposta.
    const history = messages.filter(m => !m.error).map(({ role, content }) => ({ role, content }))
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const today = isoDate()
      const { answer } = await apiPost('/api/ask', {
        question,
        today,
        history,
        data: buildAskData({
          transactions, wallets, walletBalances, creditCards, budgets, goals, today,
          cardUsed: getCardCurrentUsed,
          currency: settings.currency || 'BRL',
        }),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: answer }])
    } catch (err) {
      if (err.status === 503) {
        aiUnavailable = true
        setAiOff(true)
      }
      const msg = err.status === 429 ? t('ask.rateLimited') : t('ask.error')
      setMessages(prev => [...prev, { role: 'assistant', content: msg, error: true }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  if (aiOff && !messages.length) {
    return (
      <EmptyState
        icon="fi-rr-sparkles"
        title={t('ask.offTitle')}
        description={t('ask.offBody')}
      />
    )
  }

  const empty = messages.length === 0

  return (
    <div className="ask">
      <div className="ask-thread" aria-live="polite">
        {empty && (
          <div className="ask-intro">
            <div className="ask-intro-icon"><i className="fi fi-rr-sparkles" aria-hidden="true" /></div>
            <h2>{t('ask.introTitle')}</h2>
            <p>{t('ask.introBody')}</p>
            <div className="ask-suggestions">
              {SUGGESTIONS.map(key => (
                <button key={key} type="button" className="ask-suggestion" onClick={() => ask(t(key))}>
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`ask-msg ask-msg--${m.role}${m.error ? ' ask-msg--error' : ''}`}>
            {m.role === 'assistant' && !m.error ? <Answer text={m.content} /> : <p>{m.content}</p>}
          </div>
        ))}

        {loading && (
          <div className="ask-msg ask-msg--assistant ask-msg--loading" aria-label={t('ask.thinking')}>
            <span /><span /><span />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="ask-composer" onSubmit={e => { e.preventDefault(); ask() }}>
        <input
          ref={inputRef}
          className="form-input ask-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('ask.placeholder')}
          aria-label={t('ask.placeholder')}
          maxLength={500}
          disabled={aiOff}
        />
        <button type="submit" className="btn btn-primary ask-send" disabled={!input.trim() || loading || aiOff} aria-label={t('ask.send')}>
          <i className="fi fi-rr-paper-plane" aria-hidden="true" />
        </button>
      </form>
      <p className="ask-disclaimer">{t('ask.disclaimer')}</p>
    </div>
  )
}
