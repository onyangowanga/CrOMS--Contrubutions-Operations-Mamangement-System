export default function TextAreaField({ label, value, onChange, rows = 4, placeholder, helperText }) {
  return (
    <label className="field field-full">
      <span>{label}</span>
      <textarea rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {helperText ? <small className="field-helper">{helperText}</small> : null}
    </label>
  );
}
