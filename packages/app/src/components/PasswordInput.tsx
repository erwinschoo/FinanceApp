import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { Ic } from "./Ic";

/* Wachtwoordveld met een oogje om de ingevulde waarde te tonen/verbergen. De marge staat op de
 * wrapper (niet op het input) zodat het oogje altijd netjes verticaal gecentreerd blijft. */
export function PasswordInput({
  value, onChange, placeholder, autoComplete, autoFocus, name, ariaLabel, onKeyDown, disabled,
  fontSize = 14, style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  name?: string;
  ariaLabel?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  fontSize?: number;
  style?: CSSProperties;   // marge/breedte op de wrapper
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", marginTop: 8, ...style }}>
      <input
        type={show ? "text" : "password"} name={name} autoComplete={autoComplete} autoFocus={autoFocus}
        placeholder={placeholder} value={value} disabled={disabled} aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
        style={{ width: "100%", padding: "11px 42px 11px 13px", borderRadius: 10, border: "1px solid var(--line)",
          background: "var(--surface)", color: "var(--ink)", fontSize, outline: "none" }}
      />
      <button
        type="button" tabIndex={-1} disabled={disabled}
        aria-label={show ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
        aria-pressed={show} onClick={() => setShow((s) => !s)}
        style={{ position: "absolute", right: 6, top: 0, height: "100%", width: 34, display: "flex",
          alignItems: "center", justifyContent: "center", background: "none", border: 0,
          color: "var(--muted)", cursor: disabled ? "default" : "pointer" }}
      >
        <Ic name={show ? "eyeOff" : "eye"} size={18} />
      </button>
    </div>
  );
}
