import { useEffect, useMemo, useRef } from 'react'
import confetti from 'canvas-confetti'
import { useApp } from '../context/AppContext'
import { computeStreak, reachedMilestone } from '../utils/streak'

// Dias seguidos registrando. Discreto de propósito: é um reforço, não um
// placar — e a régua perdoa um dia pulado, porque streak que pune faz
// desinstalar (ver utils/streak.js).

const CELEBRATED_KEY = 'eazy_streak_celebrated'

const readCelebrated = () => {
  try { return Number(localStorage.getItem(CELEBRATED_KEY)) || 0 } catch { return 0 }
}

export default function StreakBadge() {
  const { transactions, t } = useApp()
  const firedRef = useRef(false)

  const streak = useMemo(() => computeStreak(transactions), [transactions])

  const milestone = reachedMilestone(streak.current)

  useEffect(() => {
    if (!milestone || firedRef.current) return
    // Um marco só se comemora uma vez: sem esta marca, todo reload jogaria
    // confete de novo enquanto a sequência estivesse em 7.
    if (readCelebrated() >= milestone) return

    firedRef.current = true
    try { localStorage.setItem(CELEBRATED_KEY, String(milestone)) } catch { /* modo privado */ }

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    confetti({ particleCount: 120, spread: 65, origin: { y: 0.25 }, zIndex: 9999 })
  }, [milestone])

  // Abaixo de dois dias não há sequência para mostrar, e um "1" permanente
  // vira ruído no header.
  if (streak.current < 2) return null

  return (
    <div
      className={`streak-badge${streak.atRisk ? ' at-risk' : ''}`}
      title={t(streak.atRisk ? 'streak.atRisk' : 'streak.title', { days: streak.current })}
    >
      <i className="fi fi-rr-flame" aria-hidden="true" />
      <span className="streak-count">{streak.current}</span>
      <span className="sr-only">{t('streak.title', { days: streak.current })}</span>
    </div>
  )
}
