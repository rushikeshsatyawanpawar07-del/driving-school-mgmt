import { useState, useEffect, useCallback } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { getStudentsByTeacher } from "../services/studentService";
import { markAttendance, getAttendanceForDate } from "../services/attendanceService";

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [schedule, setSchedule] = useState(() => {
    const s = {};
    weekDays.forEach((d) => { s[d] = ""; });
    return s;
  });
  const [scheduleDay, setScheduleDay] = useState("Monday");
  const [scheduleText, setScheduleText] = useState("");

  const loadStudents = useCallback(async () => {
    setLoading(true);
      try {
        const data = user?.uid ? await getStudentsByTeacher(user.uid) : [];
        setStudents(data);
      } catch { addNotification("Failed to load students", "error"); }
    setLoading(false);
  }, [addNotification]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

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

  const handleSaveNote = async () => {
    if (!selectedStudent || !noteText.trim()) {
      addNotification("Enter a note", "error");
      return;
    }
    setSavingNote(true);
    try {
      await updateDoc(doc(db, "students", selectedStudent.id), { progressNote: noteText });
      addNotification("Progress note saved");
      setSelectedStudent((prev) => ({ ...prev, progressNote: noteText }));
      loadStudents();
    } catch { addNotification("Failed to save note", "error"); }
    setSavingNote(false);
  };

  const handleSaveSchedule = () => {
    setSchedule((prev) => ({ ...prev, [scheduleDay]: scheduleText }));
    addNotification("Schedule updated");
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "students", label: "Students", icon: "👥" },
    { key: "attendance", label: "Attendance", icon: "📋" },
    { key: "progress", label: "Progress Notes", icon: "📝" },
    { key: "schedule", label: "Schedule", icon: "📅" },
  ];

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo">🚗</span>
          <span>DriveSchool</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-link ${view === item.key ? "active" : ""}`}
              onClick={() => { setView(item.key); setSidebarOpen(false); }}
            >
              <span>{item.icon}</span>
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
            {view === "progress" && "Progress Notes"}
            {view === "schedule" && "My Schedule"}
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
                  <div className="stat-icon stat-icon-blue">👥</div>
                  <div className="stat-body">
                    <h3>Total Students</h3>
                    <p className="stat-number">{students.length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-green">📋</div>
                  <div className="stat-body">
                    <h3>Today's Attendance</h3>
                    <p className="stat-number">{Object.values(attendanceMap).filter(Boolean).length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-purple">📅</div>
                  <div className="stat-body">
                    <h3>Active Students</h3>
                    <p className="stat-number">{students.filter((s) => s.status === "active").length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-red">📊</div>
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
                <p>View students, mark attendance, add progress notes, and manage your schedule.</p>
              </div>
            </>
          )}

          {view === "students" && (
            <div className="card">
              <h2>Student Roster</h2>
              {loading ? (
                <div className="table-loader"><div className="spinner" /></div>
              ) : students.length === 0 ? (
                <div className="empty-state">No students assigned yet.</div>
              ) : (
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
                      {students.map((s) => (
                        <tr key={s.id}>
                          <td className="td-name">{s.name}</td>
                          <td>{s.phone}</td>
                          <td><span className="badge badge-course">{s.course}</span></td>
                          <td>{s.attendanceDays || 0}</td>
                          <td>
                            <span className={`badge ${s.status === "active" ? "badge-success" : "badge-danger"}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                          <td><span className="badge badge-course">{s.course}</span></td>
                          <td>
                            {attendanceMap[s.id] === undefined ? (
                              <span className="badge badge-warning">Not marked</span>
                            ) : attendanceMap[s.id] ? (
                              <span className="badge badge-success">Present</span>
                            ) : (
                              <span className="badge badge-danger">Absent</span>
                            )}
                          </td>
                          <td>
                            <div className="action-btns">
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

          {view === "progress" && (
            <div className="card">
              <h2>Student Progress Notes</h2>
              {loading ? (
                <div className="table-loader"><div className="spinner" /></div>
              ) : students.length === 0 ? (
                <div className="empty-state">No students available.</div>
              ) : (
                <>
                  <div className="search-bar">
                    <select
                      value={selectedStudent?.id || ""}
                      onChange={(e) => {
                        const s = students.find((x) => x.id === e.target.value);
                        setSelectedStudent(s || null);
                        setNoteText(s?.progressNote || "");
                      }}
                    >
                      <option value="">Select a student...</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {selectedStudent && (
                    <div className="card" style={{ marginTop: 0, border: "1px solid var(--gray-200)" }}>
                      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{selectedStudent.name}</h3>
                      <div className="form-group">
                        <label>Progress Note</label>
                        <textarea
                          rows={4}
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add notes about this student's progress..."
                          style={{
                            width: "100%", padding: "10px 14px", border: "1px solid var(--gray-300)",
                            borderRadius: 8, fontSize: 14, fontFamily: "var(--font)", resize: "vertical",
                          }}
                        />
                      </div>
                      <button className="btn btn-primary" onClick={handleSaveNote} disabled={savingNote}>
                        {savingNote ? "Saving..." : "Save Note"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {view === "schedule" && (
            <div className="card">
              <h2>Weekly Schedule</h2>
              <div className="form-row" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label>Day</label>
                  <select value={scheduleDay} onChange={(e) => { setScheduleDay(e.target.value); setScheduleText(schedule[e.target.value] || ""); }}>
                    {weekDays.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Schedule Info</label>
                  <input value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} placeholder="e.g. 10:00 AM - Beginner Lesson" />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSaveSchedule} style={{ marginBottom: 20 }}>
                Save Schedule
              </button>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekDays.map((d) => (
                      <tr key={d}>
                        <td className="td-name">{d}</td>
                        <td>{schedule[d] || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
