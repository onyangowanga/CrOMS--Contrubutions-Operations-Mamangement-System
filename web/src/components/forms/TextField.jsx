import { useState } from "react";

export default function TextField({ label, value, onChange, type = "text", placeholder, helperText, showVisibilityToggle = type === "password" }) {
  const [revealed, setRevealed] = useState(false);
  const resolvedType = type === "password" && showVisibilityToggle ? (revealed ? "text" : "password") : type;

  return (
    <label className="field">
      <span>{label}</span>
      <div className={`field-input-wrap ${type === "password" && showVisibilityToggle ? "field-input-wrap-password" : ""}`.trim()}>
        <input
          type={resolvedType}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        {type === "password" && showVisibilityToggle ? (
          <button className="field-inline-button" type="button" onClick={() => setRevealed((current) => !current)}>
            {revealed ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
      {helperText ? <small className="field-helper">{helperText}</small> : null}
    </label>
  );
}
