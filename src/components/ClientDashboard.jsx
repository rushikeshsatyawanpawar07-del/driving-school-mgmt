import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { getStudentByAuthUid } from "../services/studentService";
import { Car, LayoutDashboard, Calendar, ClipboardList, Wallet, BadgeAlert, CreditCard } from "lucide-react";

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
        const mine = await getStudentByAuthUid(user?.uid);
        setStudent(mine);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const totalClasses = COURSE_TOTAL_CLASSES[student?.course] || 30;
  const attendancePct = Math.min(100, Math.round(((student?.attendanceDays || 0) / totalClasses) * 100));
  const totalFees = student?.totalFees || student?.courseFees || 0;
  const feesPaid = student?.feesPaid || 0;
  const pendingFees = student?.remainingFees || student?.pendingFees || 0;
  const feesPct = totalFees > 0 ? Math.min(100, Math.round((feesPaid / totalFees) * 100)) : 0;

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo"><Car size={28} /></span>
          <span>DriveSchool</span>
        </div>
        <nav className="sidebar-nav">
          <button className="sidebar-link active">
            <LayoutDashboard size={18} />
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
                    <h3>Attendance</h3>
                    <p className="stat-number">{student.attendanceDays || 0} / {totalClasses}</p>
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
                    <span className="text-xs font-medium text-gray-400 tabular-nums">{student.attendanceDays || 0} / {totalClasses}</span>
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
