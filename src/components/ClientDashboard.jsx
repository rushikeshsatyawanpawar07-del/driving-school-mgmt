import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { getStudentByAuthUid } from "../services/studentService";
import { addComplaint } from "../services/complaintService";
import { Car, LayoutDashboard, Calendar, ClipboardList, Wallet, BadgeAlert, CreditCard, GraduationCap, Phone, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { SCHOOL, TRAINING_DAYS, getCourseTotalClasses } from "../config/schoolConfig";
import { computeStatus } from "../services/attendanceService";

export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [view, setView] = useState("dashboard");
  const [complaintForm, setComplaintForm] = useState({ targetType: "Teacher", targetName: "", message: "" });
  const [complaintSent, setComplaintSent] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const mine = await getStudentByAuthUid(user?.uid);
        setStudent(mine);
        if (user?.uid) {
          const snap = await getDocs(query(
            collection(db, "attendance"),
            where("clientAuthUid", "==", user.uid)
          ));
          setAttendanceRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch (e) { console.error("Failed to load data", e); }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!complaintForm.targetName.trim() || !complaintForm.message.trim()) return;
    try {
      await addComplaint({
        branchId: student?.branchId,
        clientId: student?.id || user?.uid,
        studentName: student?.name || "",
        studentId: student?.studentId || "",
        targetType: complaintForm.targetType,
        targetName: complaintForm.targetName.trim(),
        message: complaintForm.message.trim(),
      });
      setComplaintSent(true);
      setComplaintForm({ targetType: "Teacher", targetName: "", message: "" });
    } catch (e) { console.error("Failed to submit complaint", e); }
  };

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const totalClasses = getCourseTotalClasses(student?.courseId);
  const attendancePct = Math.min(100, Math.round(((student?.trainingProgress || 0) / totalClasses) * 100));
  const totalFees = student?.totalFees || student?.courseFees || 0;
  const feesPaid = student?.feesPaid || 0;
  const pendingFees = student?.remainingFees || student?.pendingFees || 0;
  const feesPct = totalFees > 0 ? Math.min(100, Math.round((feesPaid / totalFees) * 100)) : 0;

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo"><Car size={28} /></span>
          <span>{SCHOOL.name}</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`sidebar-link ${view === "dashboard" ? "active" : ""}`} onClick={() => { setView("dashboard"); }}>
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button className={`sidebar-link ${view === "complaint" ? "active" : ""}`} onClick={() => { setView("complaint"); }}>
            <MessageCircle size={18} />
            Complaint
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="user-badge client-badge">Client</span>
            <span className="sidebar-user-name">{user?.name || user?.email}</span>
          </div>
          <button className="logout-btn sidebar-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>
              <span /><span /><span />
            </button>
            <h1>My Dashboard</h1>
          </div>
          <div className="topbar-right">
            <button className="btn btn-sm btn-danger mobile-logout-btn" onClick={handleLogout}>Logout</button>
            <span className="user-badge client-badge">Client</span>
          </div>
        </header>

        <main className="main-content">
          {loading ? (
            <div className="table-loader"><div className="spinner" /></div>
          ) : !student ? (
            <div className="card">
              <div className="empty-state">
                <h2>No student record found</h2>
                <p>Please contact the school to link your account.</p>
              </div>
            </div>
          ) : view === "complaint" ? (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MessageCircle size={20} style={{ color: "var(--primary)" }} />
                <h3 style={{ margin: 0 }}>Submit a Complaint</h3>
              </div>
              <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 16 }}>
                If you have any issue with your teacher or receptionist, please let us know.
              </p>
              {complaintSent ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ color: "#059669", fontWeight: 600, fontSize: 16 }}>Thank you! Your complaint has been submitted.</p>
                  <p style={{ fontSize: 13, color: "var(--gray-500)" }}>The school management will review it shortly.</p>
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => { setComplaintSent(false); setView("dashboard"); }}>
                    Back to Dashboard
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitComplaint}>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Regarding</label>
                    <select
                      className="form-input"
                      value={complaintForm.targetType}
                      onChange={(e) => setComplaintForm({ ...complaintForm, targetType: e.target.value })}
                    >
                      <option value="Teacher">Teacher</option>
                      <option value="Receptionist">Receptionist</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">{complaintForm.targetType} Name</label>
                    <input
                      className="form-input"
                      placeholder={`Enter ${complaintForm.targetType} name`}
                      value={complaintForm.targetName}
                      onChange={(e) => setComplaintForm({ ...complaintForm, targetName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Your Complaint</label>
                    <textarea
                      className="form-input"
                      rows={4}
                      placeholder="Describe your issue..."
                      value={complaintForm.message}
                      onChange={(e) => setComplaintForm({ ...complaintForm, message: e.target.value })}
                      required
                      style={{ resize: "vertical" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button type="submit" className="btn btn-primary">Submit Complaint</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setView("dashboard")}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
              <div className="card" style={{ background: "linear-gradient(135deg, var(--blue), #1a73e8)", color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h2 style={{ margin: "0 0 4px", color: "#090909", fontSize: 26 }}>Welcome, <strong>{student.name}</strong></h2>
                    <p style={{ opacity: 0.85, margin: 0, fontSize: 14 }}>
                      Student ID: <span style={{ fontFamily: "monospace" }}>{student.studentId || "—"}</span>
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "#1F2937", fontSize: 12 }}>{student.course}</span>
                    <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75 }}>Joined {student.joiningDate}</p>
                  </div>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon stat-icon-blue"><Calendar size={24} /></div>
                  <div className="stat-body">
                    <h3>Joining Date</h3>
                    <p className="stat-number">{student.joiningDate}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-purple"><ClipboardList size={24} /></div>
                  <div className="stat-body">
                    <h3>Training Progress</h3>
                    <p className="stat-number">{student.trainingProgress || 0} / {totalClasses}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-green"><Wallet size={24} /></div>
                  <div className="stat-body">
                    <h3>Fees Paid</h3>
                    <p className="stat-number">₹{feesPaid.toLocaleString()}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-red"><BadgeAlert size={24} /></div>
                  <div className="stat-body">
                    <h3>Pending Fees</h3>
                    <p className="stat-number">₹{pendingFees.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-base font-semibold text-[#090909] mb-5">Course Progress</h3>

                <div className="group mb-6 hover:scale-[1.02] transition-all duration-300 cursor-default">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-emerald-500" />
                      <span className="text-sm font-semibold text-gray-700">Attendance</span>
                    </div>
                    <span className="text-xs font-medium text-gray-400 tabular-nums">{student.trainingProgress || 0} / {totalClasses}</span>
                  </div>
                  <div className="relative h-3.5 bg-gray-100/80 rounded-full overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)]">
                    <div
                      className="h-full rounded-full transition-all duration-[1400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                      style={{
                        width: `${animated ? attendancePct : 0}%`,
                        background: 'linear-gradient(90deg, #059669, #22C55E, #4ADE80)',
                        boxShadow: animated ? '0 0 14px rgba(34,197,94,0.45), 0 0 40px rgba(34,197,94,0.15)' : 'none',
                      }}
                    />
                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-all duration-700 ${animated ? 'opacity-100' : 'opacity-0'}`}>
                      <span className={`text-[11px] font-bold tracking-tight ${attendancePct > 25 ? 'text-white' : 'text-emerald-600'}`}>
                        {attendancePct}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="group hover:scale-[1.02] transition-all duration-300 cursor-default">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-blue-500" />
                      <span className="text-sm font-semibold text-gray-700">Fees</span>
                    </div>
                    <span className="text-xs font-medium text-gray-400 tabular-nums">₹{feesPaid.toLocaleString()} / ₹{totalFees.toLocaleString()}</span>
                  </div>
                  <div className="relative h-3.5 bg-gray-100/80 rounded-full overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)]">
                    <div
                      className="h-full rounded-full transition-all duration-[1400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                      style={{
                        width: `${animated ? feesPct : 0}%`,
                        background: 'linear-gradient(90deg, #2563EB, #3B82F6, #60A5FA)',
                        boxShadow: animated ? '0 0 14px rgba(59,130,246,0.45), 0 0 40px rgba(59,130,246,0.15)' : 'none',
                      }}
                    />
                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-all duration-700 ${animated ? 'opacity-100' : 'opacity-0'}`}>
                      <span className={`text-[11px] font-bold tracking-tight ${feesPct > 25 ? 'text-white' : 'text-blue-600'}`}>
                        {feesPct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Training Calendar */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>Training Calendar</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="btn btn-sm" onClick={() => {
                      const d = new Date(calMonth.year, calMonth.month - 1);
                      setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
                    }}><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 100, textAlign: "center" }}>
                      {new Date(calMonth.year, calMonth.month).toLocaleString("default", { month: "long", year: "numeric" })}
                    </span>
                    <button className="btn btn-sm" onClick={() => {
                      const d = new Date(calMonth.year, calMonth.month + 1);
                      setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
                    }}><ChevronRight size={16} /></button>
                  </div>
                </div>
                {(() => {
                  const year = calMonth.year;
                  const month = calMonth.month;
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const todayStr = new Date().toISOString().split("T")[0];
                  const cells = [];
                  for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} />);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const day = new Date(year, month, d).getDay();
                    const isMonday = day === 1;
                    const record = attendanceRecords.find((r) => r.date === dateStr);
                    const isToday = dateStr === todayStr;
                    const isFuture = dateStr > todayStr;
                    let bg = "#fff";
                    let color = "#1F2937";
                    if (isMonday) { bg = "#1F2937"; color = "#fff"; }
                    else if (record?.present === true) { bg = "#059669"; color = "#fff"; }
                    else if (record?.present === false) { bg = "#DC2626"; color = "#fff"; }
                    else if (isFuture || !student.trainingStartDate || dateStr < student.trainingStartDate) { bg = "#fff"; color = "#9CA3AF"; }
                    if (isToday && !isMonday && !record) { bg = "#EFF6FF"; color = "#2563EB"; }
                    cells.push(
                      <div key={dateStr} style={{
                        aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: 8, fontSize: 13, fontWeight: isToday ? 700 : 400,
                        background: bg, color, border: isToday ? "2px solid #2563EB" : "1px solid #E5E7EB",
                        cursor: "default", transition: "all 0.15s",
                      }}
                      title={isMonday ? "Holiday (Monday)" : record ? (record.present ? "Present" : "Absent") : ""}
                      >
                        {d}
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((n) => (
                        <div key={n} style={{ textAlign: "center", fontSize: 11, color: "#6B7280", fontWeight: 600, padding: "4px 0" }}>{n}</div>
                      ))}
                      {cells}
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 14, height: 14, borderRadius: 4, background: "#059669" }} /> Present</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 14, height: 14, borderRadius: 4, background: "#DC2626" }} /> Absent</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 14, height: 14, borderRadius: 4, background: "#1F2937" }} /> Holiday (Mon)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 14, height: 14, borderRadius: 4, border: "1px solid #E5E7EB", background: "#fff" }} /> Future</div>
                </div>
                {student.trainingStartDate && (
                  <div style={{ marginTop: 12, padding: 12, background: "#F9FAFB", borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
                    <strong>Training started:</strong> {student.trainingStartDate} &nbsp;|&nbsp;
                    <strong>Valid until:</strong> {student.maximumValidDate || "—"} &nbsp;|&nbsp;
                    <strong>Progress:</strong> {student.trainingProgress || 0}/{totalClasses} &nbsp;|&nbsp;
                    <strong>Status:</strong>{" "}
                    <span className={`badge ${
                      computeStatus(student) === "active" ? "badge-success" :
                      computeStatus(student) === "completed" ? "badge-primary" :
                      computeStatus(student) === "expired" ? "badge-danger" : "badge-warning"
                    }`}>{computeStatus(student).replace("_", " ")}</span>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 style={{ margin: "0 0 12px" }}>Student Profile</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Student ID</span>
                    <span className="detail-value" style={{ fontFamily: "monospace" }}>{student.studentId || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Course</span>
                    <span className="detail-value"><span className="badge badge-course">{student.course}</span></span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Batch</span>
                    <span className="detail-value">{student.batch || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Vehicle</span>
                    <span className="detail-value">
                      {student.selectedVehicles?.length
                        ? student.selectedVehicles.map((v) => v.name).join(", ")
                        : student.twoWheelerName || student.vehicleType || "—"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{student.phone}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{student.email || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className={`badge ${student.status === "active" ? "badge-success" : "badge-danger"}`}>
                      {student.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label"><GraduationCap size={14} /> Assigned Teacher</span>
                    <span className="detail-value">{student.teacherName || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label"><Phone size={14} /> Teacher Phone</span>
                    <span className="detail-value">{student.teacherPhone || "—"}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
