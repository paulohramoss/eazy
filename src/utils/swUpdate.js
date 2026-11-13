// Registro do service worker do PWA e aviso de versão nova.
//
// O sw.js tem skipWaiting + clientsClaim (registerType 'autoUpdate'): a versão
// nova assume assim que é baixada, mas a tela aberta continua rodando o JS
// antigo até recarregar. Sem nada mais, quem instalou só via a atualização na
// segunda abertura depois do deploy — e no iPhone, que congela o app em vez de
// fechar, isso podia levar dias.
//
// Daqui saem duas coisas: o navegador procura sw.js novo sempre que o app volta
// ao primeiro plano (e de hora em hora), e quando a versão nova assume o
// controle a página é avisada. Recarregar fica com a pessoa — fazer sozinho
// jogaria fora um lançamento pela metade.

export const UPDATE_EVENT = 'eazy:update-ready'

const MIN_CHECK_INTERVAL = 60 * 1000
const PERIODIC_CHECK = 60 * 60 * 1000

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  // O index.html está desregistrando um SW antigo e vai recarregar.
  if (window.__eazyLandingRedirect) return

  const sw = navigator.serviceWorker
  // Sem controller é a primeira instalação: não há versão antiga na tela, e o
  // clientsClaim dispararia o aviso à toa.
  let hadController = !!sw.controller
  sw.addEventListener('controllerchange', () => {
    if (hadController) {
      window.__eazyUpdateReady = true
      window.dispatchEvent(new Event(UPDATE_EVENT))
    }
    hadController = true
  })

  window.addEventListener('load', async () => {
    let reg
    try {
      reg = await sw.register('/sw.js', { scope: '/' })
    } catch (err) {
      console.error('[sw] registro falhou', err)
      return
    }

    let lastCheck = Date.now()
    const check = () => {
      if (Date.now() - lastCheck < MIN_CHECK_INTERVAL) return
      lastCheck = Date.now()
      reg.update().catch(() => {}) // offline: tenta na próxima
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    setInterval(check, PERIODIC_CHECK)
  })
}
