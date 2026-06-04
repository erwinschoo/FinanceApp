import { Button } from "./Button";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  icon?: string;                              // icoon op de bevestigknop (default "trash")
  confirmVariant?: "danger" | "primary";      // stijl van de bevestigknop (default "danger")
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Verwijderen", icon = "trash", confirmVariant = "danger", onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <p>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <Button style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Annuleren</Button>
          <Button variant={confirmVariant} style={{ flex: 1, justifyContent: "center" }} icon={icon} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
