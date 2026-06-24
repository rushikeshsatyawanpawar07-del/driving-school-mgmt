import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { getStudents, getStudent } from "../services/studentService";

const COURSE_TOTAL_CLASSES = {
  "Light Motor Vehicle (LMV)": 21,
  "Heavy Motor Vehicle (HMV)": 31,
  "Motorcycle With Gear": 15,
  "Motorcycle Without Gear": 15,
};

export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const all = await getStudents();
        const mine = all.find(
          (s) => s.email === user?.email
        );
        if (mine) {
          const detail = await getStudent(mine.id);
          setStudent(detail);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  const totalClasses = COURSE_TOTAL_CLASSES[student?.course] || 30;
  const attendancePct = Math.min(100, Math.round(((student?.attendanceDays || 0) / totalClasses) * 100));
  const totalFees = student?.totalFees || student?.courseFees || 0;
  const feesPaid = student?.feesPaid || 0;
  const pendingFees = student?.remainingFees || student?.pendingFees || 0;
  const feesPct = totalFees > 0 ? Math.min(100, Math.round((feesPaid / totalFees) * 100)) : 0;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">🚗</span>
          <span>DriveSchool</span>
        </div>
        <nav className="sidebar-nav">
          <button className="sidebar-link active">
            <span>📊</span>
            Dashboard
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

      <div className="main-area">
        <header className="topbar">
          <h1>My Dashboard</h1>
          <div className="topbar-right">
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
          ) : (
            <>
              <div className="card" style={{ background: "linear-gradient(135deg, var(--blue), #1a73e8)", color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h2 style={{ margin: "0 0 4px", color: "#fff" }}>Welcome, {student.name}</h2>
                    <p style={{ opacity: 0.85, margin: 0, fontSize: 14 }}>
                      Student ID: <span style={{ fontFamily: "monospace" }}>{student.studentId || "—"}</span>
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 12 }}>{student.course}</span>
                    <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75 }}>Joined {student.joiningDate}</p>
                  </div>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon stat-icon-blue">📅</div>
                  <div className="stat-body">
                    <h3>Joining Date</h3>
                    <p className="stat-number">{student.joiningDate}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-purple">📋</div>
                  <div className="stat-body">
                    <h3>Attendance</h3>
                    <p className="stat-number">{student.attendanceDays || 0} / {totalClasses}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-green">💰</div>
                  <div className="stat-body">
                    <h3>Fees Paid</h3>
                    <p className="stat-number">₹{feesPaid.toLocaleString()}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-red">⏳</div>
                  <div className="stat-body">
                    <h3>Pending Fees</h3>
                    <p className="stat-number">₹{pendingFees.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 style={{ margin: "0 0 16px" }}>Course Progress</h3>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Attendance</span>
                    <span style={{ fontSize: 13, color: "var(--gray-500)" }}>{attendancePct}%</span>
                  </div>
                  <div style={{ height: 10, background: "var(--gray-200)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${attendancePct}%`, background: attendancePct >= 80 ? "var(--green)" : "var(--orange)", borderRadius: 5, transition: "width 0.5s" }} />
                  </div>
                  <p style={{ fontSize: 11, color: "var(--gray-400)", margin: "4px 0 0" }}>
                    {student.attendanceDays || 0} of {totalClasses} classes attended
                  </p>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Fees</span>
                    <span style={{ fontSize: 13, color: "var(--gray-500)" }}>{feesPct}%</span>
                  </div>
                  <div style={{ height: 10, background: "var(--gray-200)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${feesPct}%`, background: pendingFees <= 0 ? "var(--green)" : "var(--orange)", borderRadius: 5, transition: "width 0.5s" }} />
                  </div>
                  <p style={{ fontSize: 11, color: "var(--gray-400)", margin: "4px 0 0" }}>
                    ₹{feesPaid.toLocaleString()} paid of ₹{totalFees.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="card">
                <h3 style={{ margin: "0 0 12px" }}>Student Details</h3>
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
                    <span className="detail-value">{student.vehicleType || "—"}</span>
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
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
