import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Ic } from "./Ic";

type Variant = "default" | "primary" | "orange" | "danger" | "ghost";
type Size = "md" | "sm";

const VARIANT_CLASS: Record<Variant, string> = {
  default: "",
  primary: "btn-primary",
  orange: "btn-orange",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /* Compacte, vierkante knop voor alleen een icoon (vervangt de losse padding-overrides). */
  iconOnly?: boolean;
  /* Naam van een Ic-icoon dat vóór de children komt. */
  icon?: string;
  iconSize?: number;
  children?: ReactNode;
}

/* Centrale knop-atom bovenop de .btn-classes uit app.css. Eén plek voor varianten en maten;
 * eenmalige layout-afwijkingen kunnen nog via `style`/`className` worden doorgegeven. */
export function Button({
  variant = "default", size = "md", iconOnly = false, icon, iconSize = 16,
  className, children, type = "button", ...rest
}: ButtonProps) {
  const cls = ["btn", VARIANT_CLASS[variant], size === "sm" ? "btn-sm" : "", iconOnly ? "btn-icon" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Ic name={icon} size={iconSize} />}
      {children}
    </button>
  );
}
