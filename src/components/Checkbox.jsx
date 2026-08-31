// Checkbox custom compartilhado pelas telas com seleção múltipla.
// Os estilos vivem em App.css sob .tx-checkbox.
export default function Checkbox({ checked, indeterminate, onChange, label }) {
  return (
    <label className="tx-checkbox" aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        ref={el => { if (el) el.indeterminate = !!indeterminate }}
        onChange={onChange}
      />
      <span className="tx-checkbox-box" />
    </label>
  )
}
