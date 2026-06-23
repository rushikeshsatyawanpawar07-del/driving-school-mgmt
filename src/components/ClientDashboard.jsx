import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { getStudents, getStudent } from "../services/studentService";

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
          (s) => s.phone === user?.phoneNumber || s.email === user?.email
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
                    <p className="stat-number">{student.attendanceDays || 0} days</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-green">💰</div>
                  <div className="stat-body">
                    <h3>Fees Paid</h3>
                    <p className="stat-number">${(student.feesPaid || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-red">⏳</div>
                  <div className="stat-body">
                    <h3>Pending Fees</h3>
                    <p className="stat-number">${(student.remainingFees || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>{student.name}</h2>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Course</span>
                    <span className="detail-value">
                      <span className="badge badge-course">{student.course}</span>
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{student.phone}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Total Fees</span>
                    <span className="detail-value">${(student.totalFees || 0).toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Fees Paid</span>
                    <span className="detail-value">${(student.feesPaid || 0).toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Remaining</span>
                    <span className={`detail-value ${(student.remainingFees || 0) <= 0 ? "text-success" : "text-danger"}`}>
                      ${(student.remainingFees || 0).toLocaleString()}
                    </span>
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
