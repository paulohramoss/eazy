import { useMemo } from 'react'

// Mês e ano em duas listas, no lugar do <input type="month">: o Safari do Mac
// não implementa esse tipo (vira caixa de texto pedindo "2027-11") e os demais
// escrevem o mês no idioma do sistema, não no idioma escolhido no app.
//
// value e min no formato "AAAA-MM".
export default function MonthPicker({ value, onChange, min, language = 'pt-BR', years = 10, id, labelMonth, labelYear }) {
  const [minY, minM] = min.split('-').map(Number)
  const [y, m] = value.split('-').map(Number)

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' })
    return Array.from({ length: 12 }, (_, i) => {
      const name = fmt.format(new Date(Date.UTC(2000, i, 1)))
      return name.charAt(0).toUpperCase() + name.slice(1)
    })
  }, [language])

  const yearList = Array.from({ length: years + 1 }, (_, i) => minY + i)
  const pad = (n) => String(n).padStart(2, '0')

  // Trocar para o ano mínimo com um mês já passado puxa o mês para o mínimo.
  const setYear = (ny) => onChange(`${ny}-${pad(ny === minY && m < minM ? minM : m)}`)
  const setMonth = (nm) => onChange(`${y}-${pad(nm)}`)

  return (
    <div className="month-picker">
      <i className="fi fi-rr-calendar" aria-hidden="true" />
      <select id={id} className="form-select" value={m} onChange={e => setMonth(Number(e.target.value))} aria-label={labelMonth}>
        {monthNames.map((name, i) => (
          <option key={i} value={i + 1} disabled={y === minY && i + 1 < minM}>{name}</option>
        ))}
      </select>
      <select className="form-select" value={y} onChange={e => setYear(Number(e.target.value))} aria-label={labelYear}>
        {yearList.map(yy => <option key={yy} value={yy}>{yy}</option>)}
      </select>
    </div>
  )
}
