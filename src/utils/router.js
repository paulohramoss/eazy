// Roteador por hash, ~40 linhas, sem dependência.
//
// A tela era um useState + localStorage: não havia URL por tela, botão voltar,
// link compartilhável nem deep link — este último passa a importar agora que as
// notificações agendadas apontam para telas específicas.
//
// Hash (e não History API) porque o app é servido como SPA estática em vários
// hosts; com hash não é preciso rewrite de servidor para cada rota.
import { useEffect, useState } from 'react'

export const routeFromHash = (fallback = 'overview') => {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].trim()
  return raw || fallback
}

export function navigate(screen, { replace = false } = {}) {
  const target = `#/${screen}`
  if (window.location.hash === target) return
  if (replace) window.history.replaceState(null, '', target)
  else window.location.hash = target
}

// isValid mantém uma rota desconhecida (link velho, typo) caindo no fallback em
// vez de renderizar uma tela vazia.
export function useHashRoute(fallback = 'overview', isValid = () => true) {
  const [route, setRoute] = useState(() => {
    const r = routeFromHash(fallback)
    return isValid(r) ? r : fallback
  })

  useEffect(() => {
    const onChange = () => {
      const r = routeFromHash(fallback)
      setRoute(isValid(r) ? r : fallback)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [fallback, isValid])

  // Primeira visita sem hash: escreve a rota inicial para o botão voltar do
  // navegador ter um ponto de partida coerente.
  useEffect(() => {
    if (!window.location.hash) navigate(route, { replace: true })
  }, [route])

  return route
}
