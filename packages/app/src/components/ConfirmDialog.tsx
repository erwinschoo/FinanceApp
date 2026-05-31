import { Button } from "./Button";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Verwijderen", onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <p>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <Button style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Annuleren</Button>
          <Button variant="danger" style={{ flex: 1, justifyContent: "center" }} icon="trash" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
