import { useId, useState } from 'react'
import { useApp } from '../context/AppContext'
import { COLOR_PALETTE, normalizeHex, sameColor as same } from '../utils/color'

// Seletor de cor de carteira, cartão e investimento. Existiam quatro cópias,
// cada uma com uma paleta curta diferente; agora todas usam esta, com a cor
// livre do sistema e o campo hexadecimal para quem quer a cor exata do banco.

export default function ColorPicker({ value, onChange, palette = COLOR_PALETTE, shape = 'circle', label }) {
  const { t } = useApp()
  const id = useId()
  const current = normalizeHex(value) || palette[0]
  const isCustom = !palette.some(c => same(c, current))

  // O campo guarda o que está sendo digitado; só vira cor quando é válido.
  // Comparar com a cor atual (em vez de sincronizar por efeito) faz o campo
  // acompanhar quando a pessoa clica numa bolinha da paleta.
  const [draft, setDraft] = useState(null)
  const shown = draft ?? current
  const invalid = draft !== null && draft.trim() !== '' && !normalizeHex(draft)

  const pick = (color) => { setDraft(null); onChange(color) }

  const onType = (e) => {
    const next = e.target.value
    setDraft(next)
    const hex = normalizeHex(next)
    if (hex) onChange(hex)
  }

  return (
    <div className={`color-picker color-picker--${shape}`}>
      {label && <span className="form-label" id={`${id}-label`}>{label}</span>}

      <div className="color-picker-swatches" role="radiogroup" aria-labelledby={label ? `${id}-label` : undefined}>
        {palette.map(color => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={same(color, current)}
            aria-label={color}
            title={color}
            className={`color-swatch${same(color, current) ? ' selected' : ''}`}
            style={{ '--swatch': color }}
            onClick={() => pick(color)}
          />
        ))}

        {/* Cor livre: o seletor nativo do sistema, escondido atrás do arco-íris. */}
        <label
          className={`color-swatch color-swatch-custom${isCustom ? ' selected' : ''}`}
          style={{ '--swatch': current }}
          title={t('color.custom')}
        >
          <input
            type="color"
            value={current.toLowerCase()}
            onChange={e => pick(e.target.value.toUpperCase())}
            aria-label={t('color.custom')}
          />
          {!isCustom && <i className="fi fi-rr-palette" aria-hidden="true" />}
        </label>
      </div>

      <div className="color-picker-hex">
        <span className="color-picker-preview" style={{ background: normalizeHex(shown) || current }} aria-hidden="true" />
        <label className="sr-only" htmlFor={`${id}-hex`}>{t('color.hex')}</label>
        <input
          id={`${id}-hex`}
          className={`form-input color-picker-hex-input${invalid ? ' invalid' : ''}`}
          value={shown}
          onChange={onType}
          onBlur={() => setDraft(null)}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          placeholder="#0053EF"
          aria-invalid={invalid}
        />
        {invalid && <span className="color-picker-error">{t('color.invalid')}</span>}
      </div>
    </div>
  )
}
