import { useState, useEffect, useRef } from "react";
import { BadgeAlert, MessageCircle, XCircle, User, Calendar } from "lucide-react";
import { getPendingReminders, updateReminderStatus, generateAllStudentReminders } from "../services/licenseReminderService";

const TYPE_LABELS = {
  ll_apply_permanent: { label: "Apply Permanent License", color: "#3498db" },
  ll_expiring_soon: { label: "LL Expiring in 1 Month", color: "#f39c12" },
  ll_expires_today: { label: "LL Expires Today", color: "#e74c3c" },
  dl_renewal: { label: "DL Renewal", color: "#9b59b6" },
  course_completed: { label: "Course Completed", color: "#10b981" },
};

export default function LicenseReminderSection({ branchId }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const migratedRunRef = useRef(false);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const data = await getPendingReminders(branchId);
      data.sort((a, b) => a.reminderDate?.localeCompare(b.reminderDate || "") || 0);
      setReminders(data);
    } catch { setReminders([]); }
    setLoading(false);
  };

  useEffect(() => { migratedRunRef.current = false; loadReminders(); }, [branchId]);

  useEffect(() => {
    if (migratedRunRef.current) return;
    if (!branchId || loading) return;
    const key = `license_reminders_migrated_${branchId}`;
    if (localStorage.getItem(key)) { migratedRunRef.current = true; return; }
    migratedRunRef.current = true;
    const migrate = async () => {
      setMigrating(true);
      try {
        await generateAllStudentReminders(branchId);
        localStorage.setItem(key, "1");
        await loadReminders();
      } catch (e) { console.error("Migration error", e); }
      setMigrating(false);
    };
    migrate();
  }, [branchId, loading]);

  const handleStatus = async (id, status) => {
    try {
      await updateReminderStatus(id, status);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { console.error("Failed to update reminder status", e); }
  };

  const getWhatsAppMessage = (r) => {
    const msgs = {
      course_completed: `Hello ${r.studentName}, your driving course is now complete! Please visit NEW BHARATIS MOTOR DRIVING SCHOOL to proceed with the license procedure. Thank you!`,
      ll_apply_permanent: `Hello ${r.studentName}, you are now eligible to apply for your Permanent Driving License. Please contact us to schedule your appointment.`,
      ll_expiring_soon: `Hello ${r.studentName}, your Learning License is expiring soon. Please schedule your Driving Test and apply for the Permanent License at the earliest.`,
      ll_expires_today: `Hello ${r.studentName}, your Learning License expires today. Please contact us immediately to avoid any issues.`,
      dl_renewal: `Hello ${r.studentName}, your Driving License has expired. Please contact us for renewal assistance.`,
    };
    return msgs[r.reminderType] || `Hello ${r.studentName}, this is a reminder from NEW BHARATIS MOTOR DRIVING SCHOOL. Please contact us.`;
  };

  const handleWhatsApp = (r) => {
    if (!r.studentPhone) return;
    const phone = r.studentPhone.toString().replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(getWhatsAppMessage(r))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="card" style={{ borderLeft: "4px solid #9b59b6" }}>
      <div className="card-header">
        <h2 style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <BadgeAlert size={20} /> License Reminders
        </h2>
      </div>
      {migrating ? (
        <p style={{ color: "var(--gray-500)", padding: "16px 0", textAlign: "center" }}>
          Generating reminders for existing students...
        </p>
      ) : loading ? (
        <p style={{ color: "var(--gray-500)", padding: "16px 0", textAlign: "center" }}>
          Loading reminders...
        </p>
      ) : reminders.length === 0 ? (
        <p style={{ color: "var(--gray-500)", padding: "16px 0", textAlign: "center" }}>
          No pending reminders
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="reminder-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--gray-200)", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Student</th>
                <th style={{ padding: "10px 12px" }}>Reminder Type</th>
                <th style={{ padding: "10px 12px" }}>Reminder Date</th>
                <th style={{ padding: "10px 12px" }}>Message</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => {
                const typeInfo = TYPE_LABELS[r.reminderType] || { label: r.reminderType, color: "#666" };
                const isOverdue = r.reminderDate < new Date().toISOString().split("T")[0];
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                      <User size={14} style={{ marginRight: 6, color: "var(--gray-400)" }} />
                      {r.studentName}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 12,
                        fontSize: 12, fontWeight: 500,
                        background: `${typeInfo.color}18`, color: typeInfo.color,
                        border: `1px solid ${typeInfo.color}30`,
                      }}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Calendar size={14} style={{ marginRight: 6, color: "var(--gray-400)" }} />
                      {r.reminderDate}
                      {isOverdue && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#e74c3c", fontWeight: 600 }}>🔴 Overdue</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--gray-600)", fontSize: 13, maxWidth: 280 }}>
                      {r.message}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          className="btn btn-sm btn-whatsapp"
                          title="Send WhatsApp"
                          onClick={() => handleWhatsApp(r)}
                          disabled={!r.studentPhone}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Dismiss"
                          onClick={() => handleStatus(r.id, "dismissed")}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                        >
                          <XCircle size={14} /> Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
