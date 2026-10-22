// Landing (/conheca): página estática de apresentação. Fica fora do bundle do
// app — nada de React, Firebase ou contexto; só os estilos e os ícones.
import '@flaticon/flaticon-uicons/css/regular/rounded.css'
import './landing.css'

document.getElementById('ano').textContent = String(new Date().getFullYear())

// Sombra no menu depois que a página rola, para ele não "flutuar" sobre o
// conteúdo sem borda.
const nav = document.querySelector('.nav')
const onScroll = () => nav.classList.toggle('nav-scrolled', window.scrollY > 8)
onScroll()
window.addEventListener('scroll', onScroll, { passive: true })

// Entrada suave das seções. Sem IntersectionObserver (ou com movimento
// reduzido) tudo já aparece visível — o conteúdo nunca depende da animação.
const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
if ('IntersectionObserver' in window && !reduce) {
  const items = document.querySelectorAll('.hl-card, .feature, .steps li, .trust-list li')
  items.forEach(el => el.classList.add('reveal'))
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('in')
      io.unobserve(entry.target)
    }
  }, { rootMargin: '0px 0px -8% 0px' })
  items.forEach(el => io.observe(el))
}
