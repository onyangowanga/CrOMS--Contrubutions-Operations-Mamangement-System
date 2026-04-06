export default function ConfirmationDialog({ dialog, onConfirm, onCancel }) {
  if (!dialog) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className={`modal-card ${dialog.tone || "default"}`} role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
        <p className="modal-eyebrow">Confirm Posting</p>
        <h2 id="confirmation-title">{dialog.title}</h2>
        <p className="modal-message">{dialog.message}</p>
        {dialog.details?.length ? (
          <div className="confirmation-details">
            {dialog.details.map((detail) => (
              <div className="confirmation-detail" key={detail.label}>
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>{dialog.cancelLabel || "Cancel"}</button>
          <button className="primary-button" type="button" onClick={onConfirm}>{dialog.confirmLabel || "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}