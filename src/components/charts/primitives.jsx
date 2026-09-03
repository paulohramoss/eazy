import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'

// Reexportado para os gráficos importarem tudo de um lugar só; a implementação
// mora em geometry.js, que é puro e testável.
export { SERIES, OTHER_COLOR, foldTail, niceScale, shortNumber, donutArcs, arcPath } from './geometry'

/**
 * Peças compartilhadas pelos gráficos.
 *
 * A regra que motiva a maior parte disto: um tooltip nunca pode ser o único
 * caminho para um valor. Todo gráfico aqui vem com uma tabela equivalente, que
 * também resolve o caso das cores claras da paleta, que ficam abaixo de 3:1
 * contra o cartão branco.
 */

// ─── Moldura ─────────────────────────────────────────────────────────────────

/**
 * Título, legenda, alternância gráfico/tabela e a área de desenho.
 * `table` é obrigatório — é a via sem cor para os mesmos números.
 */
export function ChartFrame({ title, subtitle, legend, table, children }) {
  const { t } = useApp()
  const [showTable, setShowTable] = useState(false)

  return (
    <div className="chart-frame">
      <div className="chart-frame-head">
        <div className="chart-frame-titles">
          <div className="chart-frame-title">{title}</div>
          {subtitle && <div className="chart-frame-sub">{subtitle}</div>}
        </div>
        {table && (
          <button
            type="button"
            className="chart-view-toggle"
            onClick={() => setShowTable(v => !v)}
            aria-pressed={showTable}
          >
            <i className={`fi ${showTable ? 'fi-rr-chart-histogram' : 'fi-rr-list'}`} aria-hidden="true" />
            {t(showTable ? 'chart.viewChart' : 'chart.viewTable')}
          </button>
        )}
      </div>

      {showTable ? table : (
        <>
          {children}
          {/* Com duas ou mais séries a legenda é sempre visível: identidade
              nunca pode depender só da cor. */}
          {legend?.length > 1 && <Legend items={legend} />}
        </>
      )}
    </div>
  )
}

export function Legend({ items }) {
  return (
    <div className="chart-legend">
      {items.map(it => (
        <span key={it.name} className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

/**
 * Posicionado em % do container para acompanhar o SVG responsivo.
 * O clamp evita que o balão saia do cartão nas pontas.
 */
export function Tooltip({ x, y, title, rows }) {
  const left = Math.min(Math.max(x, 12), 88)
  return (
    <div className="chart-tooltip" style={{ left: `${left}%`, top: `${y}%` }}>
      {title && <div className="chart-tooltip-title">{title}</div>}
      {rows.map(r => (
        <div key={r.label} className="chart-tooltip-row">
          {r.color && <span className="chart-legend-swatch" style={{ background: r.color }} />}
          {r.label}
          <strong>{r.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Tabela equivalente ──────────────────────────────────────────────────────

export function ChartTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="chart-table">
        <thead>
          <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key ?? i}>
              {r.cells.map((cell, j) => (
                <td key={j}>
                  {j === 0 && r.color
                    ? (
                      <span className="chart-table-name">
                        <span className="chart-legend-swatch" style={{ background: r.color }} />
                        {cell}
                      </span>
                    )
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Medição do container ────────────────────────────────────────────────────

/**
 * Largura real do elemento, em pixels.
 *
 * A alternativa preguiçosa é um viewBox fixo com preserveAspectRatio="none",
 * que estica o desenho para caber. Só que isso estica TUDO junto: o texto dos
 * eixos sai deformado na horizontal e a espessura do traço muda conforme a
 * largura da tela. Medindo, o gráfico é desenhado em coordenadas reais e nada
 * distorce.
 */
export function useElementWidth(ref, fallback = 640) {
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // ResizeObserver e não window.resize: o cartão muda de largura quando a
    // sidebar recolhe ou um painel abre, sem a janela mudar de tamanho.
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return width
}
