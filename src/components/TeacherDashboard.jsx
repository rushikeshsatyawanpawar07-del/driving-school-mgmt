import { useState, useEffect, useCallback } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useBranch } from "../context/BranchContext";
import { getStudentsByTeacher } from "../services/studentService";
import { markAttendance, startTraining, isMonday, computeStatus } from "../services/attendanceService";
import { LayoutDashboard, Users, ClipboardList, Calendar, Car, Phone, User, BookOpen, Wallet, Play, AlertTriangle } from "lucide-react";
import { SCHOOL, TRAINING_DAYS, VALIDITY_DAYS, getCourseTotalClasses } from "../config/schoolConfig";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const { selectedBranch } = useBranch();
  const navigate = useNavigate();
  const [view, setView] = useState("dashboard");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [markingId, setMarkingId] = useState(null);
  const [search, setSearch] = useState("");
  const [teacherData, setTeacherData] = useState(null);
  const [startTrainingStudent, setStartTrainingStudent] = useState(null);
  const [trainingStartDate, setTrainingStartDate] = useState(new Date().toISOString().split("T")[0]);

  const loadStudents = useCallback(async () => {
    setLoading(true);
      try {
        const data = user?.uid ? await getStudentsByTeacher(user.uid, selectedBranch?.id) : [];
        setStudents(data);
      } catch { addNotification("Failed to load students", "error"); }
    setLoading(false);
  }, [addNotification, user, selectedBranch]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  useEffect(() => {
    if (user?.uid) {
      getDoc(doc(db, "teachers", user.uid)).then((snap) => {
        if (snap.exists()) setTeacherData(snap.data());
      }).catch(() => {});
    }
  }, [user]);

  const filtered = students.filter((s) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  useEffect(() => {
    const loadAttendance = async () => {
      if (!students.length) return;
      try {
        const q = query(
          collection(db, "attendance"),
          where("date", "==", selectedDate)
        );
        const snap = await getDocs(q);
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[data.studentId] = data.present;
        });
        setAttendanceMap(map);
      } catch { setAttendanceMap({}); }
    };
    loadAttendance();
  }, [selectedDate, students, teacherData]);

  const handleStartTraining = async () => {
    if (!startTrainingStudent || !trainingStartDate) return;
    try {
      await startTraining(startTrainingStudent.id, trainingStartDate);
      setStartTrainingStudent(null);
      await loadStudents();
      addNotification("Training started successfully!");
    } catch { addNotification("Failed to start training", "error"); }
  };

  const handleAttendance = async (studentId, present) => {
    setMarkingId(studentId);
    try {
      await markAttendance(studentId, selectedDate, present, teacherData?.branchId);
      setAttendanceMap((prev) => ({ ...prev, [studentId]: present }));
      addNotification(`Marked ${present ? "present" : "absent"}`);
    } catch { addNotification("Failed to mark attendance", "error"); }
    setMarkingId(null);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "students", label: "Students", icon: Users },
    { key: "attendance", label: "Attendance", icon: ClipboardList },
    { key: "salary", label: "Salary", icon: Wallet },
  ];

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo"><Car size={28} /></span>
          <span>{SCHOOL.name}</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-link ${view === item.key ? "active" : ""}`}
              onClick={() => { setView(item.key); setSidebarOpen(false); }}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="user-badge teacher-badge">Teacher</span>
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
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>
            <span /><span /><span />
          </button>
          <h1>
            {view === "dashboard" && "Teacher Dashboard"}
            {view === "students" && "My Students"}
            {view === "attendance" && "Mark Attendance"}
            {view === "salary" && "My Salary"}
          </h1>
          <div className="topbar-right">
            <span className="user-badge teacher-badge">Teacher</span>
          </div>
        </header>

        <main className="main-content">
          {view === "dashboard" && (
            <>
                <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon stat-icon-blue"><Users size={24} /></div>
                  <div className="stat-body">
                    <h3>Total Students</h3>
                    <p className="stat-number">{students.length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-green"><ClipboardList size={24} /></div>
                  <div className="stat-body">
                    <h3>Active Training</h3>
                    <p className="stat-number">{students.filter((s) => (s.trainingStatus || computeStatus(s)) === "active").length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-purple"><Calendar size={24} /></div>
                  <div className="stat-body">
                    <h3>Completed</h3>
                    <p className="stat-number">{students.filter((s) => (s.trainingStatus || computeStatus(s)) === "completed").length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-red"><LayoutDashboard size={24} /></div>
                  <div className="stat-body">
                    <h3>Not Started</h3>
                    <p className="stat-number">{students.filter((s) => (s.trainingStatus || computeStatus(s)) === "not_started").length}</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <h2>Welcome, {user?.name || "Teacher"}!</h2>
                <p>View your students and mark attendance.</p>
              </div>
            </>
          )}

          {view === "students" && (
            <div className="card">
              <div className="card-header">
                <h2>Student Roster</h2>
              </div>

              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="table-loader"><div className="spinner" /></div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">No students found.</div>
              ) : (
                  <div className="responsive-table-container">
                    <div className="desktop-table">
                      <div className="table-wrapper">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Phone</th>
                              <th>Course</th>
                              <th>Attendance</th>
                              <th>Pending Fees</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((s) => {
                              const tStatus = s.trainingStatus || computeStatus(s);
                              const tProgress = Number(s.trainingProgress) || 0;
                              const pending = s.pendingFees ?? (s.courseFees || 0) - (s.feesPaid || 0);
                              return (
                              <tr key={s.id}>
                                <td className="td-name">{s.name}</td>
                                <td className="td-phone">{s.phone}</td>
                                <td><span className="badge badge-course td-course" title={s.course}>{s.course}</span></td>
<td className="td-attendance">{tProgress}/{getCourseTotalClasses(s.course)}</td>
                                <td className="td-fees">
                                  <span style={{ color: pending > 0 ? "#DC2626" : "#059669", fontWeight: 600 }}>
                                    ₹{pending.toLocaleString()}
                                  </span>
                                </td>
                                <td className="td-status">
                                  <span className={`badge ${tStatus === "active" ? "badge-success" : tStatus === "completed" ? "badge-success" : tStatus === "expired" ? "badge-danger" : "badge-warning"}`}>
                                    {tStatus === "not_started" ? "Not Started" : tStatus === "active" ? "Active" : tStatus === "completed" ? "Completed" : "Expired"}
                                  </span>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="mobile-cards">
                      {filtered.map((s) => {
                        const tStatus = s.trainingStatus || computeStatus(s);
                        const tProgress = Number(s.trainingProgress) || 0;
                        const pending = s.pendingFees ?? (s.courseFees || 0) - (s.feesPaid || 0);
                        return (
                        <div key={s.id} className="data-card">
                          <div className="data-card-row"><span className="data-card-label"><User size={14} /></span><span className="data-card-value">{s.name}</span></div>
                          <div className="data-card-row"><span className="data-card-label"><Phone size={14} /></span><span className="data-card-value">{s.phone}</span></div>
                          <div className="data-card-row"><span className="data-card-label"><BookOpen size={14} /></span><span className="data-card-value">{s.course}</span></div>
                          <div className="data-card-row"><span className="data-card-label"><ClipboardList size={14} /></span><span className="data-card-value">{tProgress}/{getCourseTotalClasses(s.course)} days</span></div>
                          <div className="data-card-row"><span className="data-card-label"><Wallet size={14} /> Pending Fees</span><span style={{ color: pending > 0 ? "#DC2626" : "#059669", fontWeight: 600 }}>₹{pending.toLocaleString()}</span></div>
                          <div className="data-card-row"><span className="data-card-label">Status</span><span className={`badge ${tStatus === "active" ? "badge-success" : tStatus === "completed" ? "badge-success" : tStatus === "expired" ? "badge-danger" : "badge-warning"}`}>{tStatus === "not_started" ? "Not Started" : tStatus === "active" ? "Active" : tStatus === "completed" ? "Completed" : "Expired"}</span></div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
              )}
            </div>
          )}

          {view === "attendance" && (
            <div className="card">
              <div className="card-header">
                <h2>Mark Attendance</h2>
                <input
                  type="date"
                  className="date-input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              {isMonday(selectedDate) && (
                <div className="empty-state" style={{ padding: 12, margin: "0 0 12px", background: "#fef3cd", borderRadius: 8, border: "1px solid #ffc107" }}>
                  <AlertTriangle size={18} style={{ marginRight: 8, color: "#856404" }} />
                  <span style={{ color: "#856404", fontSize: 14 }}>Mondays are holidays. Attendance cannot be marked.</span>
                </div>
              )}
              {loading ? (
                <div className="table-loader"><div className="spinner" /></div>
              ) : students.length === 0 ? (
                <div className="empty-state">No students to mark attendance for.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Course</th>
                        <th>Progress</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => {
                        const tStatus = s.trainingStatus || computeStatus(s);
                        const tProgress = Number(s.trainingProgress) || 0;
                        return (
                        <tr key={s.id}>
                          <td className="td-name">{s.name}</td>
                          <td><span className="badge badge-course td-course" title={s.course}>{s.course}</span></td>
                          <td className="td-attendance">{tProgress}/{getCourseTotalClasses(s.course)}</td>
                          <td className="td-status">
                            {tStatus === "not_started" ? (
                              <span className="badge badge-warning">Not Started</span>
                            ) : tStatus === "active" ? (
                              <span className="badge badge-success">Active</span>
                            ) : tStatus === "completed" ? (
                              <span className="badge badge-success">Completed</span>
                            ) : (
                              <span className="badge badge-danger">Expired</span>
                            )}
                          </td>
                          <td className="td-actions">
                            {tStatus === "not_started" ? (
                              <button className="btn btn-sm btn-primary" onClick={() => { setStartTrainingStudent(s); setTrainingStartDate(new Date().toISOString().split("T")[0]); }}>
                                <Play size={14} /> Start Training
                              </button>
                            ) : tStatus === "active" ? (
                              <div className="action-btns attendance-actions">
                                <button
                                  className="btn btn-sm btn-success"
                                  disabled={markingId === s.id || isMonday(selectedDate)}
                                  onClick={() => handleAttendance(s.id, true)}
                                >
                                  Present
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  disabled={markingId === s.id || isMonday(selectedDate)}
                                  onClick={() => handleAttendance(s.id, false)}
                                >
                                  Absent
                                </button>
                              </div>
                            ) : tStatus === "completed" ? (
                              <span className="badge badge-success">✅ Completed</span>
                            ) : (
                              <span className="badge badge-danger">⛔ Expired</span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Start Training Modal */}
          {startTrainingStudent && (
            <div className="modal-overlay" onClick={() => setStartTrainingStudent(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <h3>Start Training</h3>
                <p style={{ margin: "8px 0", fontSize: 14, color: "var(--gray-600)" }}>
                  Starting training for <strong>{startTrainingStudent.name}</strong>
                </p>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Training Start Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={trainingStartDate}
                    onChange={(e) => setTrainingStartDate(e.target.value)}
                  />
                </div>
                <p style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 8 }}>
                  Maximum valid date will be {trainingStartDate ? (() => { const d = new Date(trainingStartDate + "T00:00:00"); d.setDate(d.getDate() + VALIDITY_DAYS); return d.toISOString().split("T")[0]; })() : "—"} ({VALIDITY_DAYS} days from start)
                </p>
                <div className="form-actions" style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={handleStartTraining}>Confirm Start</button>
                  <button className="btn btn-secondary" onClick={() => setStartTrainingStudent(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {view === "salary" && (
            <div className="card">
              <div className="card-header">
                <h2>My Salary</h2>
              </div>
              {!teacherData ? (
                <div className="table-loader"><div className="spinner" /></div>
              ) : teacherData.salary ? (
                <div className="detail-grid" style={{ marginTop: 16 }}>
                  <div className="detail-item">
                    <span className="detail-label">Teacher Name</span>
                    <span className="detail-value">{teacherData.name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Monthly Salary</span>
                    <span className="detail-value" style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>
                      ₹{Number(teacherData.salary).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <p style={{ color: "var(--gray-500)", padding: "32px 0", textAlign: "center" }}>
                  Salary has not been set yet. Contact the owner.
                </p>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
