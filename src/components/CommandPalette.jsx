import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CatIcon, useApp } from '../context/AppContext'
import { resolveWalletIcon } from '../utils/walletIcons'

// Busca global (Ctrl/⌘+K).
//
// Até aqui, achar uma transação exigia abrir a tela certa e montar filtros —
// e não havia busca nenhuma sobre carteiras, cartões, objetivos ou
// recorrências. A paleta procura em tudo de uma vez e também navega.

// Normaliza para busca: sem acento e sem caixa, para "alimentacao" achar
// "Alimentação".
const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const MAX_PER_GROUP = 5

export default function CommandPalette({ open, onClose, onNavigate, screens }) {
  const {
    transactions, wallets, creditCards, goals, recurrences,
    formatCurrency: fmt, formatDate, t,
  } = useApp()

  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      // O autoFocus do React não vence o portal recém-montado em todos os
      // navegadores; focar no efeito é confiável.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const results = useMemo(() => {
    const term = norm(q).trim()
    const groups = []

    // Sem termo, a paleta é um navegador de telas — o uso mais comum.
    const screenItems = screens
      .filter(s => !term || norm(s.label).includes(term))
      .slice(0, term ? MAX_PER_GROUP : screens.length)
      .map(s => ({
        kind: 'screen', id: `screen:${s.screen}`, icon: s.icon,
        title: s.label, subtitle: t('palette.goTo'), action: () => onNavigate(s.screen),
      }))
    if (screenItems.length) groups.push({ label: t('palette.screens'), items: screenItems })

    if (!term) return groups

    const txItems = transactions
      .filter(x => norm(x.name).includes(term) || norm(x.category).includes(term) || norm(x.notes).includes(term))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, MAX_PER_GROUP)
      .map(x => ({
        kind: 'transaction', id: `tx:${x.id}`, category: x.category,
        title: x.name,
        subtitle: `${formatDate(x.date)} · ${x.category}`,
        amount: x.amount, type: x.type,
        action: () => onNavigate('transactions'),
      }))
    if (txItems.length) groups.push({ label: t('nav.transactions'), items: txItems })

    const walletItems = wallets
      .filter(w => norm(w.name).includes(term))
      .slice(0, MAX_PER_GROUP)
      .map(w => ({
        kind: 'wallet', id: `w:${w.id}`, icon: resolveWalletIcon(w.icon, w.type),
        title: w.name, subtitle: t('nav.wallets'), action: () => onNavigate('wallets'),
      }))
    if (walletItems.length) groups.push({ label: t('nav.wallets'), items: walletItems })

    const cardItems = creditCards
      .filter(c => norm(c.name).includes(term) || norm(c.flag).includes(term))
      .slice(0, MAX_PER_GROUP)
      .map(c => ({
        kind: 'card', id: `c:${c.id}`, icon: 'fi-rr-credit-card',
        title: c.name, subtitle: t('nav.creditcards'), action: () => onNavigate('creditcards'),
      }))
    if (cardItems.length) groups.push({ label: t('nav.creditcards'), items: cardItems })

    const goalItems = goals
      .filter(g => norm(g.name).includes(term))
      .slice(0, MAX_PER_GROUP)
      .map(g => ({
        kind: 'goal', id: `g:${g.id}`, icon: 'fi-rr-star',
        title: g.name,
        subtitle: `${fmt(g.current || 0)} / ${fmt(g.target || 0)}`,
        action: () => onNavigate('goals'),
      }))
    if (goalItems.length) groups.push({ label: t('nav.goals'), items: goalItems })

    const recItems = recurrences
      .filter(r => norm(r.name).includes(term))
      .slice(0, MAX_PER_GROUP)
      .map(r => ({
        kind: 'recurrence', id: `r:${r.id}`, icon: 'fi-rr-refresh',
        title: r.name,
        subtitle: `${t('nav.recurrences')} · ${formatDate(r.nextDate)}`,
        action: () => onNavigate('recurrences'),
      }))
    if (recItems.length) groups.push({ label: t('nav.recurrences'), items: recItems })

    return groups
  }, [q, screens, transactions, wallets, creditCards, goals, recurrences, fmt, formatDate, t, onNavigate])

  // Lista achatada: a navegação por seta ignora os cabeçalhos de grupo.
  const flat = useMemo(() => results.flatMap(g => g.items), [results])

  useEffect(() => { setCursor(0) }, [q])

  // Mantém o item destacado visível ao navegar por teclado.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  const run = (item) => { item.action(); onClose() }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => (flat.length ? (c + 1) % flat.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => (flat.length ? (c - 1 + flat.length) % flat.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flat[cursor]) run(flat[cursor])
    }
  }

  let index = -1

  return createPortal(
    <div className="palette-backdrop" onClick={onClose}>
      <div
        className="palette"
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.title')}
      >
        <div className="palette-search">
          <i className="fi fi-rr-search" aria-hidden="true" />
          <input
            ref={inputRef}
            className="palette-input"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="palette-kbd">esc</kbd>
        </div>

        <div className="palette-results" ref={listRef}>
          {flat.length === 0 && (
            <div className="palette-empty">{t('palette.noResults', { term: q })}</div>
          )}

          {results.map(group => (
            <div key={group.label} className="palette-group">
              <div className="palette-group-label">{group.label}</div>
              {group.items.map(item => {
                index++
                const active = index === cursor
                const myIndex = index
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`palette-item${active ? ' is-active' : ''}`}
                    data-active={active}
                    onMouseMove={() => setCursor(myIndex)}
                    onClick={() => run(item)}
                  >
                    <span className="palette-item-icon">
                      {item.kind === 'transaction'
                        ? <CatIcon category={item.category} />
                        : <i className={`fi ${item.icon}`} />}
                    </span>
                    <span className="palette-item-body">
                      <span className="palette-item-title">{item.title}</span>
                      <span className="palette-item-sub">{item.subtitle}</span>
                    </span>
                    {item.amount != null && (
                      <span
                        className="palette-item-amount"
                        style={{ color: item.type === 'income' ? 'var(--accent-green)' : 'var(--text-secondary)' }}
                      >
                        {item.type === 'income' ? '+' : '−'}{fmt(item.amount)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="palette-footer">
          <span><kbd className="palette-kbd">↑</kbd><kbd className="palette-kbd">↓</kbd> {t('palette.navigate')}</span>
          <span><kbd className="palette-kbd">↵</kbd> {t('palette.select')}</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
