export default function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="sidebar-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onCancel}>
      <div className="card" style={{ maxWidth: 400, width: "90%", padding: 24, position: "relative", zIndex: 1001 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 8px" }}>{title || "Confirm"}</h3>
        <p style={{ color: "var(--gray-600)", margin: "0 0 20px" }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}