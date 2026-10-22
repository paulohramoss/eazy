import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'

// Pergunta a quem a alteração vale quando o lançamento faz parte de uma
// recorrência ou de um parcelamento — o mesmo padrão de agenda: só este,
// este e os próximos, ou todos.
export default function SeriesScopeModal({ kind, action, futureCount, totalCount, hasRule = false, onChoose, onClose }) {
  const { t } = useApp()
  const [scope, setScope] = useState('one')
  const isDelete = action === 'delete'

  // "Este e os próximos" só aparece quando é diferente das outras duas: no
  // último lançamento seria igual a "só este" e no primeiro, igual a "todos".
  // Com regra ativa ele também alcança os que ainda vão ser criados.
  const showFuture = futureCount < totalCount && (futureCount > 1 || hasRule)
  // Recorrência não tem total fechado (a regra ainda vai gerar mais), então a
  // contagem sai do rótulo; parcelamento mostra quantas parcelas atinge.
  const counted = kind !== 'recurrence'

  const options = [
    { value: 'one', label: t('series.one'), hint: t('series.oneHint') },
    showFuture && {
      value: 'future',
      label: counted ? t('series.future', { count: futureCount }) : t('series.futureRec'),
      hint: t('series.futureHint'),
    },
    {
      value: 'all',
      label: counted ? t('series.all', { count: totalCount }) : t('series.allRec'),
      hint: t(kind === 'recurrence' ? 'series.allHintRec' : 'series.allHintInst'),
    },
  ].filter(Boolean)

  return (
    <Modal
      title={t(isDelete ? 'series.deleteTitle' : 'series.editTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button className={`btn ${isDelete ? 'btn-danger' : 'btn-primary'}`} onClick={() => onChoose(scope)}>
            {t(isDelete ? 'action.delete' : 'series.apply')}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>
        {t(kind === 'recurrence' ? 'series.introRec' : 'series.introInst')}
      </p>
      <div className="series-options" role="radiogroup">
        {options.map(o => (
          <label key={o.value} className={`series-option${scope === o.value ? ' selected' : ''}`}>
            <input type="radio" name="series-scope" value={o.value} checked={scope === o.value} onChange={() => setScope(o.value)} />
            <span>
              <strong>{o.label}</strong>
              <small>{o.hint}</small>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  )
}
