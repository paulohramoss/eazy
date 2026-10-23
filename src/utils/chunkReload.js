import { lazy } from 'react'

// Depois de um deploy, a aba (ou o service worker) ainda pode estar com o
// index.html antigo, que aponta para chunks com hash velho. O SW novo limpa o
// precache antigo, o Vercel não tem mais esses arquivos, e o import() da tela
// falha — caía no ErrorBoundary logo na abertura, e só um F5 resolvia. O F5 é
// exatamente a correção: baixa o index novo. Aqui ele acontece sozinho.
const KEY = 'eazy_chunk_reload'
// Se o reload não resolver (rede fora, deploy quebrado), não entra em loop:
// a segunda falha dentro da janela vai para o ErrorBoundary normalmente.
const COOLDOWN_MS = 15000

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Loading chunk|Unable to preload|MIME type/i

export const isChunkLoadError = (err) => CHUNK_ERROR.test(String(err?.message || err))

export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(KEY))
    if (last && Date.now() - last < COOLDOWN_MS) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Sem sessionStorage não há como evitar loop: melhor mostrar o erro.
    return false
  }
  window.location.reload()
  return true
}

// O import() que falhou fica em cache no navegador, então tentar de novo na
// mesma página não adianta; só o reload resolve.
export const lazyWithReload = (factory) => lazy(() =>
  factory().catch((err) => {
    // Promise pendente: a página já está recarregando, não pisca o erro.
    if (isChunkLoadError(err) && reloadOnce()) return new Promise(() => {})
    throw err
  })
)
