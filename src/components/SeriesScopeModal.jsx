import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'

// Pergunta a quem a alteração vale quando o lançamento faz parte de uma
// recorrência ou de um parcelamento — o mesmo padrão de agenda: só este,
// este e os próximos, ou todos.
export default function SeriesScopeModal({ kind, action, futureCount, totalCount, onChoose, onClose }) {
  const { t } = useApp()
  const [scope, setScope] = useState('one')
  const isDelete = action === 'delete'

  const options = [
    { value: 'one', label: t('series.one'), hint: t('series.oneHint') },
    // "Este e os próximos" igual a "só este" (último da série) não é escolha.
    futureCount > 1 && { value: 'future', label: t('series.future', { count: futureCount }), hint: t('series.futureHint') },
    { value: 'all', label: t('series.all', { count: totalCount }), hint: t(kind === 'recurrence' ? 'series.allHintRec' : 'series.allHintInst') },
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
