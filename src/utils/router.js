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

/**
 * Lê — e apaga da URL — os parâmetros de entrada do app: o atalho do launcher
 * (`#/overview?quick=1`) e o compartilhamento do sistema (`/?text=...`, que o
 * share_target do manifest entrega por GET).
 *
 * Apaga porque senão um F5 reabriria o lançamento rápido para sempre, e o
 * texto compartilhado grudaria na barra de endereço.
 *
 * @returns {{quick: boolean, sharedText: string}}
 */
export function consumeLaunchParams() {
  let quick = false
  let sharedText = ''

  const search = new URLSearchParams(window.location.search)
  // O Android manda o link em `url` e o texto em `text`; o iOS costuma mandar
  // tudo em `text`. Juntar os dois cobre os dois casos sem ramificar por SO.
  const shared = [search.get('title'), search.get('text'), search.get('url')]
    .filter(Boolean).join(' ').trim()
  if (shared) sharedText = shared

  const hashQuery = window.location.hash.split('?')[1]
  if (hashQuery && new URLSearchParams(hashQuery).get('quick') === '1') quick = true

  if (shared || quick) {
    const screen = routeFromHash()
    window.history.replaceState(null, '', `${window.location.pathname}#/${screen}`)
  }

  return { quick: quick || !!sharedText, sharedText }
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
