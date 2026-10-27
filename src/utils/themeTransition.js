import { flushSync } from 'react-dom'

// Troca de tema com um círculo que cresce a partir do botão clicado.
//
// A View Transitions API tira um "print" da tela antes e depois da troca; aqui
// a tela nova é revelada por um clip-path circular centrado no clique, com raio
// até o canto mais distante para cobrir tudo. Sem suporte (Firefox antigo) ou
// com "reduzir movimento" ligado, a troca é instantânea como antes.
export function switchTheme(next, apply, origin) {
  const root = document.documentElement
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduced || root.dataset.theme === next) {
    apply()
    return
  }

  const r = origin?.getBoundingClientRect()
  const x = r ? r.left + r.width / 2 : innerWidth / 2
  const y = r ? r.top + r.height / 2 : innerHeight / 2
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))

  document.startViewTransition(() => {
    // O print "depois" é tirado quando este callback termina: o React precisa
    // ter pintado o tema novo de forma síncrona. O data-theme vai direto no
    // <html> porque o efeito que o aplica em App roda só depois.
    flushSync(apply)
    root.dataset.theme = next
  }).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 600, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => {})
}
