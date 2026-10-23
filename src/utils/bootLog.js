// Tempos da abertura do app (auth, cache, servidor), em ms desde a navegação.
// Liga no dev ou com localStorage.eazy_debug_boot = '1' em produção.
let enabled = import.meta.env.DEV
try { enabled ||= localStorage.getItem('eazy_debug_boot') === '1' } catch { /* modo privado */ }

export function bootLog(label, data) {
  if (!enabled) return
  console.info(`[boot] ${Math.round(performance.now())}ms ${label}`, data ?? '')
}
