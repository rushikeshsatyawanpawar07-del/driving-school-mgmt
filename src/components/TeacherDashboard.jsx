import { useState, useEffect, useCallback } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { getStudentsByTeacher } from "../services/studentService";
import { markAttendance, getAttendanceForDate } from "../services/attendanceService";
import { LayoutDashboard, Users, ClipboardList, Calendar, Car, Phone, User, BookOpen } from "lucide-react";
import { SCHOOL } from "../config/schoolConfig";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [view, setView] = useState("dashboard");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [markingId, setMarkingId] = useState(null);
  const [search, setSearch] = useState("");

  const loadStudents = useCallback(async () => {
    setLoading(true);
      try {
        const data = user?.uid ? await getStudentsByTeacher(user.uid) : [];
        setStudents(data);
      } catch { addNotification("Failed to load students", "error"); }
    setLoading(false);
  }, [addNotification]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filtered = students.filter((s) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  useEffect(() => {
    const loadAttendance = async () => {
      const map = {};
      for (const s of students) {
        const rec = await getAttendanceForDate(s.id, selectedDate);
        if (rec) map[s.id] = rec.present;
      }
      setAttendanceMap(map);
    };
    if (students.length) loadAttendance();
  }, [selectedDate, students]);

  const handleAttendance = async (studentId, present) => {
    setMarkingId(studentId);
    try {
      await markAttendance(studentId, selectedDate, present);
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
  ];

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo"><Car size={28} /></span>
          <span>{SCHOOL.shortName}</span>
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
                    <h3>Today's Attendance</h3>
                    <p className="stat-number">{Object.values(attendanceMap).filter(Boolean).length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-purple"><Calendar size={24} /></div>
                  <div className="stat-body">
                    <h3>Active Students</h3>
                    <p className="stat-number">{students.filter((s) => s.status === "active").length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-red"><LayoutDashboard size={24} /></div>
                  <div className="stat-body">
                    <h3>Avg Attendance</h3>
                    <p className="stat-number">
                      {students.length
                        ? `${Math.round(students.reduce((s, x) => s + (x.attendanceDays || 0), 0) / students.length)}d`
                        : "0d"}
                    </p>
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
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((s) => (
                            <tr key={s.id}>
                              <td className="td-name">{s.name}</td>
                              <td className="td-phone">{s.phone}</td>
                              <td><span className="badge badge-course td-course" title={s.course}>{s.course}</span></td>
                              <td className="td-attendance">{s.attendanceDays || 0}</td>
                              <td className="td-status">
                                <span className={`badge ${s.status === "active" ? "badge-success" : "badge-danger"}`}>
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mobile-cards">
                    {filtered.map((s) => (
                      <div key={s.id} className="data-card">
                        <div className="data-card-row"><span className="data-card-label"><User size={14} /></span><span className="data-card-value">{s.name}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><Phone size={14} /></span><span className="data-card-value">{s.phone}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><BookOpen size={14} /></span><span className="data-card-value">{s.course}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><ClipboardList size={14} /></span><span className="data-card-value">{s.attendanceDays || 0} days</span></div>
                        <div className="data-card-row"><span className="data-card-label">Status</span><span className={`badge ${s.status === "active" ? "badge-success" : "badge-danger"}`}>{s.status}</span></div>
                      </div>
                    ))}
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
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.id}>
                          <td className="td-name">{s.name}</td>
                          <td><span className="badge badge-course td-course" title={s.course}>{s.course}</span></td>
                          <td className="td-status">
                            {attendanceMap[s.id] === undefined ? (
                              <span className="badge badge-warning">Not marked</span>
                            ) : attendanceMap[s.id] ? (
                              <span className="badge badge-success">Present</span>
                            ) : (
                              <span className="badge badge-danger">Absent</span>
                            )}
                          </td>
                          <td className="td-actions">
                            <div className="action-btns attendance-actions">
                              <button
                                className="btn btn-sm btn-success"
                                disabled={markingId === s.id}
                                onClick={() => handleAttendance(s.id, true)}
                              >
                                Present
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                disabled={markingId === s.id}
                                onClick={() => handleAttendance(s.id, false)}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
