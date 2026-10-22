import markSrc from '../assets/brand/eazy-mark.svg'
import lockupLight from '../assets/brand/eazy-lockup.svg'
import lockupDark from '../assets/brand/eazy-lockup-dark.svg'
import lockupTaglineLight from '../assets/brand/eazy-lockup-tagline.svg'
import lockupTaglineDark from '../assets/brand/eazy-lockup-tagline-dark.svg'
import wordLight from '../assets/brand/eazy-wordmark.svg'
import wordDark from '../assets/brand/eazy-wordmark-dark.svg'

// O "eazy" azul some no fundo escuro, então as peças com texto vêm em par
// claro/escuro e o CSS (.brand-themed) mostra a certa conforme o data-theme.
// Duas <img> e não um SVG inline: os paths pesam ~70 KB e assim ficam fora
// do bundle JS, cacheados como asset.

function Themed({ light, dark, alt, className = '', ...rest }) {
  return (
    <span className={`brand-themed ${className}`.trim()} role="img" aria-label={alt} {...rest}>
      <img className="brand-themed__light" src={light} alt="" draggable="false" />
      <img className="brand-themed__dark" src={dark} alt="" draggable="false" />
    </span>
  )
}

/** Só o tile da mão — menu recolhido, header mobile, avatar de marca. */
export function BrandMark({ size = 36, className = '', alt = 'Eazy' }) {
  return (
    <img
      className={`brand-mark ${className}`.trim()}
      src={markSrc}
      width={size}
      height={size}
      alt={alt}
      draggable="false"
    />
  )
}

/** Tile + "eazy" (opcionalmente com o slogan) — menu aberto, login. */
export function BrandLockup({ tagline = false, className = '', alt = 'Eazy' }) {
  return (
    <Themed
      className={`brand-lockup ${className}`.trim()}
      light={tagline ? lockupTaglineLight : lockupLight}
      dark={tagline ? lockupTaglineDark : lockupDark}
      alt={alt}
    />
  )
}

/** Só o "eazy". */
export function BrandWordmark({ className = '', alt = 'Eazy' }) {
  return <Themed className={`brand-wordmark ${className}`.trim()} light={wordLight} dark={wordDark} alt={alt} />
}
