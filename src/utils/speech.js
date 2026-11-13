// Ditado pelo reconhecimento de voz do próprio navegador.
//
// De graça e sem servidor: Chrome/Android e Safari (iOS 14.5+) transcrevem no
// aparelho ou no serviço do sistema. O áudio nunca passa pelo Eazy. Onde a API
// não existe (Firefox), o botão simplesmente não aparece.
import { useCallback, useEffect, useRef, useState } from 'react'

const Recognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : undefined

export const speechSupported = !!Recognition

/**
 * @param {object} opts
 * @param {string} opts.lang            ex.: 'pt-BR'
 * @param {(text:string) => void} opts.onInterim  transcrição parcial, enquanto fala
 * @param {(text:string) => void} opts.onFinal    frase fechada
 * @param {(code:string) => void} [opts.onError]  'not-allowed', 'no-speech'…
 */
export function useSpeech({ lang, onInterim, onFinal, onError }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  // Os callbacks mudam a cada render; o reconhecimento é criado uma vez.
  const cb = useRef({ onInterim, onFinal, onError })
  useEffect(() => { cb.current = { onInterim, onFinal, onError } })

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!Recognition || recRef.current) return
    const rec = new Recognition()
    rec.lang = lang || 'pt-BR'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    let finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      cb.current.onInterim?.((finalText + interim).trim())
    }
    rec.onerror = (e) => {
      // 'aborted' é o stop() manual; não é erro para quem fala.
      if (e.error !== 'aborted') cb.current.onError?.(e.error)
    }
    rec.onend = () => {
      recRef.current = null
      setListening(false)
      if (finalText.trim()) cb.current.onFinal?.(finalText.trim())
    }

    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      recRef.current = null
      setListening(false)
    }
  }, [lang])

  // Fechar o modal no meio da fala não pode deixar o microfone aberto.
  useEffect(() => () => recRef.current?.abort(), [])

  return { supported: speechSupported, listening, start, stop }
}
