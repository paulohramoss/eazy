import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ChartFrame, ChartTable } from './primitives'
import { arcPath, donutArcs, foldTail } from './geometry'

/**
 * Donut de parte-do-todo.
 *
 * Mudanças em relação à versão anterior:
 *   - a paleta antiga entrava com preto e cinza como se fossem cores, e um lima
 *     com 1,27:1 de contraste que sumia no fundo branco;
 *   - as cores eram cicladas pelo índice, então filtrar uma categoria repintava
 *     as outras e quem tinha aprendido "Alimentação é azul" era enganado;
 *   - o número no centro era um percentual que dava sempre 100%.
 *
 * Agora a cor segue a entidade pela ordem de valor, a cauda vira "Outros" em
 * cinza, o centro mostra o total e a legenda é interativa e leva os valores —
 * a leitura não depende de acertar o cursor numa fatia.
 */

// O anel ficou mais fino e o furo maior porque o valor total mora no centro:
// com o furo anterior (84px) um "R$ 10.003,00" transbordava por cima da fatia.
const SIZE = 168
const R_OUT = 72
const R_IN = 54
const C = SIZE / 2

// Largura útil dentro do furo, já descontando respiro nas laterais.
const CENTER_W = R_IN * 2 - 12

/**
 * Tamanho de fonte que faz o valor caber no furo do donut.
 *
 * Sem isto o número usava um tamanho fixo e o texto invadia o anel — o mesmo
 * defeito de rótulo estourando a marca que se evita nas barras. 0.58 é a
 * largura média de caractere da Inter em peso 750, medida empiricamente.
 */
function fitFontSize(text, max = 20, min = 10) {
  const needed = CENTER_W / (String(text).length * 0.58)
  return Math.max(min, Math.min(max, needed))
}

// Donut só funciona para parte-do-todo "de relance". Passando disso as fatias
// ficam finas demais para comparar e o gráfico vira decoração.
const MAX_SLICES = 5

export default function DonutChart({ title, subtitle, items, centerLabel, renderIcon }) {
  const { formatCurrency: fmt, t } = useApp()
  const [active, setActive] = useState(null)

  const sorted = [...items].sort((a, b) => b.value - a.value)
  const slices = foldTail(sorted, MAX_SLICES, t('chart.other'))
  const total = slices.reduce((s, d) => s + d.value, 0) || 1

  const arcs = donutArcs(slices)
  const GEO = { cx: C, cy: C, rOuter: R_OUT, rInner: R_IN }

  const pct = (v) => ((v / total) * 100)
  const centerValue = fmt(active === null ? total : slices[active].value)

  const table = (
    <ChartTable
      columns={[t('chart.category'), t('chart.value'), t('analysis.pctOfTotal')]}
      rows={slices.map(s => ({
        key: s.name, color: s.color,
        cells: [s.name, fmt(s.value), `${pct(s.value).toFixed(1)}%`],
      }))}
    />
  )

  return (
    <ChartFrame title={title} subtitle={subtitle} table={table}>
      <div className="chart-donut-wrap">
        <div className="chart-donut" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} role="img"
               aria-label={`${title}. ${t('chart.useTable')}`}>
            {arcs.map((a, i) => (
              <path
                key={a.name}
                d={arcPath(a.start, a.end, GEO)}
                fill={a.color}
                className={`chart-segment${active !== null && active !== i ? ' is-dim' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            ))}
          </svg>
          <div className="chart-donut-center">
            <span
              className="chart-donut-value"
              style={{ fontSize: fitFontSize(centerValue) }}
            >
              {centerValue}
            </span>
            <span className="chart-donut-label">
              {active === null ? centerLabel : `${pct(slices[active].value).toFixed(0)}%`}
            </span>
          </div>
        </div>

        {/* A legenda carrega os valores: quem não consegue distinguir duas
            fatias de cor parecida lê os números aqui, sem depender do tooltip. */}
        <div className="chart-donut-legend">
          {slices.map((s, i) => (
            <div
              key={s.name}
              className={`chart-donut-row${active === i ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="chart-legend-swatch" style={{ background: s.color }} />
              {renderIcon && !s.isOther && renderIcon(s.name)}
              <span className="chart-donut-row-name">{s.name}</span>
              <span className="chart-donut-row-value">{fmt(s.value)}</span>
              <span className="chart-donut-row-pct">{pct(s.value).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </ChartFrame>
  )
}
