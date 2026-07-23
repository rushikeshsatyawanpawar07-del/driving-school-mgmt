import { useState, useEffect, useRef, useMemo } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useBranch } from "../context/BranchContext";
import {
  getInquiries, addInquiry, updateInquiry, deleteInquiry, checkFollowUps, markFollowUpSent,
} from "../services/inquiryService";
import {
  getStudents, addStudent, updateStudent, deleteStudent, getStudent, recordPayment, assignStudentToTeacher,
} from "../services/studentService";
import {
  getTeachers,
} from "../services/teacherService";
import { generateInvoicePDF } from "../services/invoiceService";
import { getSchedulesByDate, saveSchedules } from "../services/scheduleService";
import {
  LayoutDashboard, Car, User, Wallet, Building2, ClipboardList, Phone, Calendar, BookOpen,
  Eye, Pencil, Trash2, Bell, TriangleAlert, BadgeAlert, CheckCircle, Link2, GraduationCap,
  Users, Mail, CreditCard, Copy, Fingerprint, Sunrise, Sun, Sunset, Bike, CircleOff, Clock, Gauge,
  Menu, X, CalendarCheck,
} from "lucide-react";
import StudentForm from "./StudentForm";
import LicenseReminderSection from "./LicenseReminderSection";
import ConfirmModal from "./ConfirmModal";
import { SCHOOL } from "../config/schoolConfig";

export default function ReceptionDashboard() {
  const { user } = useAuth();
  const { branches } = useBranch();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState("dashboard");

  // Inquiry state
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [savingInquiry, setSavingInquiry] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [inquirySearch, setInquirySearch] = useState("");
  const [searchAllBranches, setSearchAllBranches] = useState(false);
  const [followUpsDue, setFollowUpsDue] = useState([]);
  const [inquiryForm, setInquiryForm] = useState({
    name: "", phone: "", email: "", courseInterested: "", inquiryDate: new Date().toISOString().split("T")[0], notes: "",
  });
  const [inquiryCourseSearch, setInquiryCourseSearch] = useState("");
  const [inquiryShowCourseDropdown, setInquiryShowCourseDropdown] = useState(false);
  const [inquirySelectedCourse, setInquirySelectedCourse] = useState(null);
  const inquiryCourseDropdownRef = useRef(null);

  // Student state
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [studentDeleting, setStudentDeleting] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [sortDir, setSortDir] = useState("asc");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [editingStudent, setEditingStudent] = useState(null);

  // Assign student state
  const [teachers, setTeachers] = useState([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignTeacherFilter, setAssignTeacherFilter] = useState("");

  // Schedule state
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [scheduleData, setScheduleData] = useState({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const SCHEDULE_TIME_SLOTS = [
    "06:00 AM – 06:30 AM","06:30 AM – 07:00 AM","07:00 AM – 07:30 AM",
    "07:30 AM – 08:00 AM","08:00 AM – 08:30 AM","08:30 AM – 09:00 AM",
    "09:00 AM – 09:30 AM","09:30 AM – 10:00 AM","10:00 AM – 10:30 AM",
    "10:30 AM – 11:00 AM","11:00 AM – 11:30 AM","11:30 AM – 12:00 PM",
    "12:00 PM – 12:30 PM","12:30 PM – 01:00 PM",
    "04:00 PM – 04:30 PM","04:30 PM – 05:00 PM","05:00 PM – 05:30 PM",
    "05:30 PM – 06:00 PM","06:00 PM – 06:30 PM","06:30 PM – 07:00 PM",
    "07:00 PM – 07:30 PM","07:30 PM – 08:00 PM","08:00 PM – 08:30 PM",
    "08:30 PM – 09:00 PM","09:00 PM – 09:30 PM",
  ];

  const courseOptions = SCHOOL.courses;
  const filteredInquiryCourses = useMemo(
    () => courseOptions.filter((c) => c.label.toLowerCase().includes(inquiryCourseSearch.toLowerCase())),
    [inquiryCourseSearch]
  );

  useEffect(() => {
    const handleClick = (e) => {
      if (inquiryCourseDropdownRef.current && !inquiryCourseDropdownRef.current.contains(e.target))
        setInquiryShowCourseDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (user?.uid) {
      getDoc(doc(db, "receptionists", user.uid)).then((snap) => {
        if (snap.exists()) setProfile(snap.data());
      }).catch(() => addNotification("Failed to load profile", "error"));
    }
  }, [user]);

  const branchId = profile?.branchId;

  const loadInquiries = async () => {
    setInquiriesLoading(true);
    try {
      const data = await getInquiries(searchAllBranches ? null : branchId);
      setInquiries(data);
    } catch { addNotification("Failed to load inquiries", "error"); }
    setInquiriesLoading(false);
  };

  useEffect(() => {
    if (["inquiries", "addInquiry", "viewInquiry", "dashboard"].includes(view)) {
      loadInquiries();
    }
  }, [view, branchId, searchAllBranches]);

  const filteredInquiries = inquiries.filter((inq) => {
    const search = inquirySearch.toLowerCase();
    return inq.name?.toLowerCase().includes(search) || inq.phone?.includes(search);
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const thisMonth = todayStr.slice(0, 7);
  const inquiryStats = {
    total: inquiries.length,
    followUpRequired: inquiries.filter((i) => {
      if (!i.inquiryDate) return false;
      const d = new Date(i.inquiryDate);
      d.setHours(0, 0, 0, 0);
      const diff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
      if (diff < 7) return false;
      if (i.lastFollowUpSent) {
        const sent = i.lastFollowUpSent.toDate ? i.lastFollowUpSent.toDate() : new Date(i.lastFollowUpSent);
        sent.setHours(0, 0, 0, 0);
        const daysSinceSent = Math.floor((new Date() - sent) / (1000 * 60 * 60 * 24));
        if (daysSinceSent < 7) return false;
      }
      return true;
    }).length,
    today: inquiries.filter((i) => i.inquiryDate === todayStr).length,
    thisMonth: inquiries.filter((i) => i.inquiryDate?.startsWith(thisMonth)).length,
  };

  useEffect(() => {
    const check = async () => {
      if (inquiries.length > 0) {
        const due = await checkFollowUps(inquiries);
        setFollowUpsDue(due);
      }
    };
    if (view === "dashboard") check();
  }, [inquiries, view]);

  const handleSaveInquiry = async (e) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.phone) {
      addNotification("Name and phone are required", "error");
      return;
    }
    setSavingInquiry(true);
    try {
      if (selectedInquiry) {
        await updateInquiry(selectedInquiry, inquiryForm);
        addNotification("Inquiry updated");
      } else {
        await addInquiry({ ...inquiryForm, branchId: branchId || null });
        addNotification("Inquiry added");
      }
      setInquiryForm({ name: "", phone: "", email: "", courseInterested: "", inquiryDate: new Date().toISOString().split("T")[0], notes: "" });
      setInquirySelectedCourse(null);
      setInquiryCourseSearch("");
      setSelectedInquiry(null);
      setView("inquiries");
      loadInquiries();
    } catch (err) { addNotification(err.message || "Failed to save inquiry", "error"); }
    setSavingInquiry(false);
  };

  const handleEditInquiry = (id) => {
    const inq = inquiries.find((x) => x.id === id);
    if (!inq) return;
    setInquiryForm({
      name: inq.name || "",
      phone: inq.phone || "",
      email: inq.email || "",
      courseInterested: inq.courseInterested || "",
      inquiryDate: inq.inquiryDate || "",
      notes: inq.notes || "",
    });
    const match = courseOptions.find((c) => c.label === inq.courseInterested);
    setInquirySelectedCourse(match || null);
    setInquiryCourseSearch(match ? match.label : inq.courseInterested || "");
    setSelectedInquiry(id);
    setView("addInquiry");
  };

  const handleDeleteInquiry = async (id) => {
    setDeleting(id);
    try {
      await deleteInquiry(id);
      addNotification("Inquiry deleted");
      loadInquiries();
    } catch { addNotification("Failed to delete inquiry", "error"); }
    setDeleting(null);
  };

  const handleViewInquiry = (id) => {
    const inq = inquiries.find((x) => x.id === id);
    if (!inq) return;
    setSelectedInquiry(inq);
    setView("viewInquiry");
  };

  const isFollowUpDue = (inq) => {
    if (!inq.inquiryDate) return false;
    const daysSince = Math.floor((new Date() - new Date(inq.inquiryDate)) / (1000 * 60 * 60 * 24));
    if (daysSince < 7) return false;
    if (inq.lastFollowUpSent) {
      const sent = inq.lastFollowUpSent.toDate ? inq.lastFollowUpSent.toDate() : new Date(inq.lastFollowUpSent);
      const daysSinceSent = Math.floor((new Date() - sent) / (1000 * 60 * 60 * 24));
      if (daysSinceSent < 7) return false;
    }
    return true;
  };

  const handleSendFollowUp = async (inq) => {
    if (!inq.phone) return;
    try {
      await markFollowUpSent(inq.id);
      setFollowUpsDue((prev) => prev.filter((f) => f.id !== inq.id));
      loadInquiries();
    } catch { /* silent */ }
    const phone = inq.phone.toString().replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(SCHOOL.whatsappMessage(inq.name))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const loadTeachers = async () => {
    try {
      const data = await getTeachers(branchId);
      setTeachers(data);
    } catch { addNotification("Failed to load teachers", "error"); }
  };

  useEffect(() => {
    if (view === "assign" || view === "addStudent") {
      if (view === "assign") loadStudents();
      loadTeachers();
    }
    if (view === "schedule") {
      loadStudents();
      loadSchedule();
    }
  }, [view, branchId]);

  const loadSchedule = async () => {
    if (!branchId) return;
    setScheduleLoading(true);
    try {
      const existing = await getSchedulesByDate(branchId, scheduleDate);
      const map = {};
      existing.forEach((s) => { map[s.studentId] = { time: s.time || "", session: s.session || "" }; });
      setScheduleData(map);
    } catch { addNotification("Failed to load schedules", "error"); }
    setScheduleLoading(false);
  };

  useEffect(() => {
    if (view === "schedule") loadSchedule();
  }, [scheduleDate]);

  const handleScheduleChange = (studentId, field, value) => {
    setScheduleData((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    try {
      const entries = students.map((s) => ({
        studentId: s.id,
        studentName: s.name,
        time: scheduleData[s.id]?.time || "",
        session: scheduleData[s.id]?.session || "",
      }));
      await saveSchedules(entries, branchId, scheduleDate);
      addNotification("Schedule saved");
    } catch { addNotification("Failed to save schedule", "error"); }
    setScheduleSaving(false);
  };

  const handleAssignTeacher = async (studentId, teacherId) => {
    try {
      await assignStudentToTeacher(studentId, teacherId);
      addNotification(teacherId ? "Teacher assigned" : "Assignment removed");
      loadStudents();
    } catch { addNotification("Assignment failed", "error"); }
  };

  const loadStudents = async () => {
    setStudentsLoading(true);
    try {
      const data = await getStudents(branchId);
      setStudents(data);
    } catch { addNotification("Failed to load students", "error"); }
    setStudentsLoading(false);
  };

  useEffect(() => {
    if (["students", "addStudent", "viewStudent", "dashboard"].includes(view)) loadStudents();
  }, [view, branchId]);

  const handleSaveStudent = async (payload) => {
    setSaving(true);
    try {
      let studentId;
      if (editingStudent) {
        await updateStudent(editingStudent.id, payload);
        studentId = editingStudent.id;
        addNotification("Student updated");
      } else {
        const inquiryId = payload.matchedInquiryId;
        delete payload.matchedInquiryId;
        const saved = await addStudent(payload);
        studentId = saved.id;
        if (inquiryId) {
          await deleteInquiry(inquiryId).catch(() => {});
        }
        addNotification("Student added");
      }
      try {
        const latest = await getStudent(studentId);
        if (latest) await generateInvoicePDF(latest, teachers, profile?.branchId ? (branches.find((b) => b.id === profile.branchId)?.name) : undefined);
      } catch { addNotification("Invoice download failed, student was saved", "error"); }
      setEditingStudent(null);
      setView("students");
      loadStudents();
    } catch (err) { addNotification(err?.message || "Failed to save student", "error"); }
    setSaving(false);
  };

  const handleEditStudent = async (id) => {
    const s = students.find((x) => x.id === id);
    if (s) { setEditingStudent(s); setView("addStudent"); }
  };

  const handleViewStudent = async (id) => {
    const s = await getStudent(id);
    setSelectedStudent(s);
    setView("viewStudent");
  };

  const handleDeleteStudent = async (id) => {
    setStudentDeleting(id);
    try {
      await deleteStudent(id);
      addNotification("Student deleted");
      loadStudents();
    } catch { addNotification("Failed to delete student", "error"); }
    setStudentDeleting(null);
  };

  const handlePayment = async () => {
    const amt = Number(paymentAmount);
    if (!paymentAmount || isNaN(amt) || amt <= 0) {
      addNotification("Enter a valid amount", "error");
      return;
    }
    setSaving(true);
    try {
      await recordPayment(selectedStudent.id, paymentAmount);
      addNotification("Payment recorded");
      setPaymentAmount("");
      const updated = await getStudent(selectedStudent.id);
      setSelectedStudent(updated);
      loadStudents();
    } catch { addNotification("Payment failed", "error"); }
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  const branchName = branches.find((b) => b.id === profile?.branchId)?.name || "—";

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "students", label: "Students", icon: Users },
    { key: "inquiries", label: "Inquiries", icon: ClipboardList },
    { key: "assign", label: "Assign Student", icon: Link2 },
    { key: "schedule", label: "Schedule", icon: CalendarCheck },
  ];

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo"><Car size={28} /></span>
          <span>{SCHOOL.name}</span>
        </div>
        <div style={{ padding: "8px 16px", fontSize: 13, color: "var(--gray-500)" }}>
          Branch: <strong>{branchName}</strong>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-link ${item.key === "dashboard" && view === "dashboard" ? "active" : ""} ${item.key === "students" && (view === "students" || view === "addStudent" || view === "viewStudent") ? "active" : ""} ${item.key === "inquiries" && (view === "inquiries" || view === "addInquiry" || view === "viewInquiry") ? "active" : ""} ${item.key === "assign" && view === "assign" ? "active" : ""} ${item.key === "schedule" && view === "schedule" ? "active" : ""}`}
              onClick={() => setView(item.key)}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="user-badge" style={{ background: "var(--primary)", color: "#fff" }}>Reception</span>
            <span className="sidebar-user-name">{user?.name || user?.email}</span>
          </div>
          <button className="logout-btn sidebar-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
          <h1>
            {view === "dashboard" && "Reception Dashboard"}
            {view === "students" && "Students"}
            {view === "addStudent" && (editingStudent ? "Edit Student" : "Add Student")}
            {view === "viewStudent" && "Student Details"}
            {view === "inquiries" && "Inquiries"}
            {view === "addInquiry" && (selectedInquiry ? "Edit Inquiry" : "Add Inquiry")}
            {view === "viewInquiry" && "Inquiry Details"}
            {view === "assign" && "Assign Student to Teacher"}
            {view === "schedule" && "Schedule"}
          </h1>
          <div className="topbar-right">
            <span className="user-badge" style={{ background: "var(--primary)", color: "#fff" }}>Reception</span>
          </div>
        </header>

        <main className="main-content">
          {view === "dashboard" && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon stat-icon-blue"><User size={24} /></div>
                  <div className="stat-body">
                    <h3>{profile?.name || user?.name || "Receptionist"}</h3>
                    <p className="stat-number" style={{ fontSize: 16 }}>{profile?.email || user?.email}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-purple"><Building2 size={24} /></div>
                  <div className="stat-body">
                    <h3>Branch</h3>
                    <p className="stat-number" style={{ fontSize: 16 }}>{branchName}</p>
                  </div>
                </div>
                {profile?.salary && (
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-green"><Wallet size={24} /></div>
                    <div className="stat-body">
                      <h3>Monthly Salary</h3>
                      <p className="stat-number">₹{Number(profile.salary).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon stat-icon-blue"><ClipboardList size={24} /></div>
                  <div className="stat-body">
                    <h3>Total Inquiries</h3>
                    <p className="stat-number">{inquiryStats.total}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-red"><Bell size={24} /></div>
                  <div className="stat-body">
                    <h3>Follow-up Required</h3>
                    <p className="stat-number">{inquiryStats.followUpRequired}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-blue"><Calendar size={24} /></div>
                  <div className="stat-body">
                    <h3>Today's Inquiries</h3>
                    <p className="stat-number">{inquiryStats.today}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-green"><Calendar size={24} /></div>
                  <div className="stat-body">
                    <h3>This Month's Inquiries</h3>
                    <p className="stat-number">{inquiryStats.thisMonth}</p>
                  </div>
                </div>
              </div>

              <div className="card" style={{ borderLeft: "4px solid #e74c3c" }}>
                <div className="card-header">
                  <h2 style={{ color: "#e74c3c", display: "flex", alignItems: "center", gap: 6 }}><TriangleAlert size={20} /> Follow-Up Required</h2>
                </div>
                {followUpsDue.length === 0 ? (
                  <p style={{ color: "var(--gray-500)", padding: "16px 0", textAlign: "center" }}>
                    No Follow-Ups Pending
                  </p>
                ) : (
                  <div className="followup-grid">
                    {followUpsDue.map((inq) => (
                      <div key={inq.id} className="followup-card">
                        <div className="followup-header">
                          <strong>{inq.name}</strong>
                        </div>
                        <div className="followup-details">
                          <div className="followup-row">
                            <span className="followup-label"><Phone size={14} /></span>
                            <span>{inq.phone}</span>
                          </div>
                          <div className="followup-row">
                            <span className="followup-label"><Calendar size={14} /></span>
                            <span>{inq.inquiryDate}</span>
                          </div>
                        </div>
                        <div className="followup-actions">
                          <button
                            className="btn btn-sm btn-whatsapp"
                            title="Send WhatsApp"
                            onClick={() => handleSendFollowUp(inq)}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <LicenseReminderSection branchId={profile?.branchId} />

              <div className="card">
                <h2>Welcome, {profile?.name || "Receptionist"}!</h2>
                <p>Manage inquiries for <strong>{branchName}</strong> branch.</p>
              </div>
            </>
          )}

          {view === "students" && (
            <div className="card">
              <div className="card-header">
                <h2>All Students</h2>
                <button className="btn btn-primary" onClick={() => { setEditingStudent(null); setView("addStudent"); }}>
                  + Add Student
                </button>
              </div>

              <div className="search-bar">
                <input type="text" placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                  <option value="all">All Courses</option>
                  <option value="pending_fees">Pending Fees</option>
                  {[...new Set(students.map((s) => s.course).filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button className="btn btn-sm" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
                  Sort {sortDir === "asc" ? "Z-A" : "A-Z"}
                </button>
              </div>

              {(() => {
                const sorted = [...students].sort((a, b) => {
                  const cmp = (a.name || "").localeCompare(b.name || "");
                  return sortDir === "asc" ? cmp : -cmp;
                });
                const filtered = sorted.filter((s) => {
                  const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search);
                  const matchCourse = courseFilter === "all" || (courseFilter === "pending_fees" ? (s.pendingFees > 0 || s.remainingFees > 0) : s.course === courseFilter);
                  return matchSearch && matchCourse;
                });

                return studentsLoading ? (
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
                              <th>Student ID</th>
                              <th>Name</th>
                              <th>Email</th>
                              <th>Phone</th>
                              <th>Course</th>
                              <th>Fees Paid</th>
                              <th>Pending Fees</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((s) => (
                              <tr key={s.id}>
                                <td><span className="badge badge-course" style={{ fontFamily: "monospace" }}>{s.studentId || "—"}</span></td>
                                <td className="td-name">{s.name}</td>
                                <td style={{ fontSize: 13, color: "var(--gray-500)" }}>{s.email || "—"}</td>
                                <td>{s.phone}</td>
                                <td><span className="badge badge-course">{s.course}</span></td>
                                <td>₹{(s.feesPaid || 0).toLocaleString()}</td>
                                <td>
                                  <span className={`badge ${(s.remainingFees || 0) <= 0 ? "badge-success" : "badge-danger"}`}>
                                    ₹{(s.remainingFees || 0).toLocaleString()}
                                  </span>
                                </td>
                                <td>
                                  <div className="action-btns">
                                    <button className="btn btn-icon btn-view" title="View" onClick={() => handleViewStudent(s.id)}><Eye size={18} /></button>
                                    <button className="btn btn-icon btn-edit" title="Edit" onClick={() => handleEditStudent(s.id)}><Pencil size={18} /></button>
                                    {s.studentId && (
                                      <button className="btn btn-icon" title="Copy Student ID" onClick={() => { navigator.clipboard.writeText(s.studentId).catch(() => {}); addNotification("Student ID copied!"); }}><Copy size={18} /></button>
                                    )}
                                    <button className="btn btn-icon btn-delete" title="Delete" disabled={deleting === s.id} onClick={() => setConfirm({ message: `Delete ${s.name}?`, onConfirm: () => handleDeleteStudent(s.id) })}><Trash2 size={18} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="mobile-cards">
                      {filtered.map((s) => {
                        const tr = teachers.find((x) => x.id === s.assignedTeacherId || x.uid === s.assignedTeacherId);
                        return (
                          <div key={s.id} className="data-card">
                            <div className="data-card-row"><span className="data-card-label"><Fingerprint size={14} /></span><span className="data-card-value" style={{ fontFamily: "monospace" }}>{s.studentId || "—"}</span></div>
                            <div className="data-card-row"><span className="data-card-label"><User size={14} /></span><span className="data-card-value">{s.name}</span></div>
                            <div className="data-card-row"><span className="data-card-label"><Mail size={14} /></span><span className="data-card-value" style={{ fontSize: 13 }}>{s.email || "—"}</span></div>
                            <div className="data-card-row"><span className="data-card-label"><Phone size={14} /></span><span className="data-card-value">{s.phone}</span></div>
                            <div className="data-card-row"><span className="data-card-label"><BookOpen size={14} /></span><span className="data-card-value">{s.course}</span></div>
                            <div className="data-card-row"><span className="data-card-label"><GraduationCap size={14} /></span><span className="data-card-value">{tr ? tr.name : "—"}</span></div>
                            <div className="data-card-row"><span className="data-card-label"><Wallet size={14} /></span><span className="data-card-value">₹{(s.feesPaid || 0).toLocaleString()}</span></div>
                            <div className="data-card-row"><span className="data-card-label"><CreditCard size={14} /></span><span className={`data-card-value ${(s.remainingFees || 0) > 0 ? "text-danger" : "text-success"}`}>₹{(s.remainingFees || 0).toLocaleString()}</span></div>
                            <div className="data-card-actions">
                              <button className="btn btn-sm btn-secondary" onClick={() => handleViewStudent(s.id)}><Eye size={16} /> View</button>
                              <button className="btn btn-sm btn-primary" onClick={() => handleEditStudent(s.id)}><Pencil size={16} /> Edit</button>
                              {s.studentId && (
                                <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(s.studentId).catch(() => {}); addNotification("Student ID copied!"); }}><Copy size={16} /> Copy ID</button>
                              )}
                              <button className="btn btn-sm btn-danger" disabled={deleting === s.id} onClick={() => setConfirm({ message: `Delete ${s.name}?`, onConfirm: () => handleDeleteStudent(s.id) })}><Trash2 size={16} /> Delete</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {view === "addStudent" && (
            <StudentForm
              initialData={editingStudent}
              branchId={branchId}
              branches={branches}
              teachers={teachers}
              onSave={handleSaveStudent}
              onCancel={() => { setEditingStudent(null); setView("students"); }}
              saving={saving}
            />
          )}

          {view === "viewStudent" && selectedStudent && (
            <div className="card">
              <div className="card-header">
                <h2>{selectedStudent.name}</h2>
                <div className="action-btns">
                  <button className="btn btn-secondary" onClick={() => { setView("students"); setSelectedStudent(null); }}>
                    Back
                  </button>
                  <button className="btn btn-primary" onClick={() => handleEditStudent(selectedStudent.id)}>
                    Edit
                  </button>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Student ID</span>
                  <span className="detail-value" style={{ fontFamily: "monospace" }}>{selectedStudent.studentId || "—"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{selectedStudent.email || "—"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Phone</span>
                  <span className="detail-value">{selectedStudent.phone}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Course</span>
                  <span className="detail-value"><span className="badge badge-course">{selectedStudent.course}</span></span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Joining Date</span>
                  <span className="detail-value">{selectedStudent.joiningDate}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span className={`badge ${selectedStudent.status === "active" ? "badge-success" : "badge-danger"}`}>
                    {selectedStudent.status}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Total Fees</span>
                  <span className="detail-value">₹{(selectedStudent.totalFees || 0).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Fees Paid</span>
                  <span className="detail-value">₹{(selectedStudent.feesPaid || 0).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Remaining Balance</span>
                  <span className={`detail-value ${(selectedStudent.remainingFees || 0) <= 0 ? "text-success" : "text-danger"}`}>
                    ₹{(selectedStudent.remainingFees || 0).toLocaleString()}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Attendance Days</span>
                  <span className="detail-value">{selectedStudent.attendanceDays || 0}</span>
                </div>
              </div>

              <div className="payment-section">
                <h3>Assign Teacher</h3>
                <div className="payment-row">
                  <select
                    value={selectedStudent.assignedTeacherId || ""}
                    onChange={(e) => handleAssignTeacher(selectedStudent.id, e.target.value)}
                    style={{
                      flex: 1, padding: "9px 14px", border: "1px solid var(--gray-300)",
                      borderRadius: 8, fontSize: 14, fontFamily: "var(--font)", background: "white",
                    }}
                  >
                    <option value="">— Not assigned —</option>
                    {teachers.filter((t) => t.status !== "inactive").map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="payment-section">
                <h3>Record Payment</h3>
                <div className="payment-row">
                  <input type="number" placeholder="Amount (₹)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} min="0" />
                  <button className="btn btn-success" onClick={handlePayment} disabled={saving}>
                    {saving ? "Processing..." : "Record Payment"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === "inquiries" && (
            <div className="card">
              <div className="card-header">
                <h2>All Inquiries</h2>
                <button className="btn btn-primary" onClick={() => {
                  setInquiryForm({ name: "", phone: "", email: "", courseInterested: "", inquiryDate: new Date().toISOString().split("T")[0], notes: "" });
                  setInquirySelectedCourse(null);
                  setInquiryCourseSearch("");
                  setSelectedInquiry(null);
                  setView("addInquiry");
                }}>
                  + Add Inquiry
                </button>
              </div>

              <div className="search-bar">
                <input type="text" placeholder="Search by name or phone..." value={inquirySearch} onChange={(e) => setInquirySearch(e.target.value)} />
                <button
                  className={`btn btn-sm ${searchAllBranches ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setSearchAllBranches((v) => !v)}
                  style={{ whiteSpace: "nowrap" }}
                >
                  <Building2 size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {searchAllBranches ? "All Branches" : "This Branch"}
                </button>
              </div>

              {inquiriesLoading ? (
                <div className="table-loader"><div className="spinner" /></div>
              ) : filteredInquiries.length === 0 ? (
                <div className="empty-state">No inquiries found.</div>
              ) : (
                <div className="responsive-table-container">
                  <div className="desktop-table">
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            {searchAllBranches && <th>Branch</th>}
                            <th>Course</th>
                            <th>Inquiry Date</th>
                            <th>Follow-up</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInquiries.map((inq) => {
                            const due = isFollowUpDue(inq);
                            return (
                            <tr key={inq.id} className={due ? "row-followup-due" : ""}>
                              <td className="td-name">{inq.name}</td>
                              <td>{inq.phone}</td>
                              {searchAllBranches && (
                                <td><span className="inquiry-badge" style={{ background: "#E0E7FF", color: "#4338CA" }}>
                                  {branches.find((b) => b.id === inq.branchId)?.name || "—"}
                                </span></td>
                              )}
                              <td><span className="badge badge-course">{inq.courseInterested || "—"}</span></td>
                              <td>{inq.inquiryDate}</td>
                              <td>
                                {due ? (
                                  <span style={{ color: "#d97706", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", display: "inline-block" }} /> Follow-up Due</span>
                                ) : (
                                  <span style={{ color: "#059669", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669", display: "inline-block" }} /> New</span>
                                )}
                              </td>
                              <td>
                                <div className="action-btns">
                                  <button className="btn btn-icon btn-view" title="View" onClick={() => handleViewInquiry(inq.id)}><Eye size={18} /></button>
                                  <button className="btn btn-icon btn-edit" title="Edit" onClick={() => handleEditInquiry(inq.id)}><Pencil size={18} /></button>
                                  <button className="btn btn-icon btn-delete" title="Delete" disabled={deleting === inq.id} onClick={() => setConfirm({ message: `Delete inquiry from ${inq.name}?`, onConfirm: () => handleDeleteInquiry(inq.id) })}><Trash2 size={18} /></button>
                                  {inq.phone && (
                                    <button
                                      className="btn btn-sm btn-whatsapp"
                                      title="Send WhatsApp"
                                      onClick={() => handleSendFollowUp(inq)}
                                    >
                                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mobile-cards">
                    {filteredInquiries.map((inq) => {
                      const due = isFollowUpDue(inq);
                      return (
                        <div key={inq.id} className="data-card" style={due ? { borderLeft: "4px solid #d97706" } : {}}>
                          <div className="data-card-row"><span className="data-card-label"><User size={14} /></span><span className="data-card-value">{inq.name}</span></div>
                          <div className="data-card-row"><span className="data-card-label"><Phone size={14} /></span><span className="data-card-value">{inq.phone}</span></div>
                          {searchAllBranches && (
                            <div className="data-card-row"><span className="data-card-label"><Building2 size={14} /></span><span className="data-card-value"><span className="inquiry-badge" style={{ background: "#E0E7FF", color: "#4338CA" }}>{branches.find((b) => b.id === inq.branchId)?.name || "—"}</span></span></div>
                          )}
                          <div className="data-card-row"><span className="data-card-label"><BookOpen size={14} /></span><span className="data-card-value">{inq.courseInterested || "—"}</span></div>
                          <div className="data-card-row"><span className="data-card-label"><Calendar size={14} /></span><span className="data-card-value">{inq.inquiryDate}</span></div>
                          <div className="data-card-row">
                            <span className="data-card-label">Follow-up</span>
                            <span className="data-card-value" style={{ color: due ? "#d97706" : "#059669", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                              {due ? <><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", display: "inline-block" }} /> Follow-up Due</> : <><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669", display: "inline-block" }} /> New</>}
                            </span>
                          </div>
                          <div className="data-card-actions">
                            <button className="btn btn-sm btn-secondary" onClick={() => handleViewInquiry(inq.id)}><Eye size={16} /> View</button>
                            <button className="btn btn-sm btn-primary" onClick={() => handleEditInquiry(inq.id)}><Pencil size={16} /> Edit</button>
                            {inq.phone && (
                              <button className="btn btn-sm btn-whatsapp" title="Send WhatsApp" onClick={() => handleSendFollowUp(inq)}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              </button>
                            )}
                            <button className="btn btn-sm btn-danger" disabled={deleting === inq.id} onClick={() => setConfirm({ message: `Delete inquiry from ${inq.name}?`, onConfirm: () => handleDeleteInquiry(inq.id) })}><Trash2 size={16} /> Delete</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "addInquiry" && (
            <div className="card form-card">
              <h2>{selectedInquiry ? "Edit Inquiry" : "Add New Inquiry"}</h2>
              <form onSubmit={handleSaveInquiry}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input value={inquiryForm.name} onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })} placeholder="Full name" />
                  </div>
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input value={inquiryForm.phone} onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })} placeholder="Phone number" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email (optional)</label>
                    <input type="email" value={inquiryForm.email} onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })} placeholder="Email" />
                  </div>
                  <div className="form-group">
                    <label>Course Interested</label>
                    <div className="course-select-wrapper" ref={inquiryCourseDropdownRef}>
                      <input
                        className="form-input"
                        value={inquirySelectedCourse ? inquirySelectedCourse.label : inquiryCourseSearch}
                        onChange={(e) => { setInquiryCourseSearch(e.target.value); setInquirySelectedCourse(null); setInquiryForm({ ...inquiryForm, courseInterested: "" }); setInquiryShowCourseDropdown(true); }}
                        onFocus={() => setInquiryShowCourseDropdown(true)}
                        placeholder="Search or select a course..."
                      />
                      {inquiryShowCourseDropdown && (
                        <div className="course-dropdown">
                          {filteredInquiryCourses.length === 0 ? (
                            <div className="course-dropdown-empty">No courses found</div>
                          ) : (
                            filteredInquiryCourses.map((c) => (
                              <div key={c.id} className="course-dropdown-item" onClick={() => {
                                setInquirySelectedCourse(c);
                                setInquiryCourseSearch(c.label);
                                setInquiryForm({ ...inquiryForm, courseInterested: c.label });
                                setInquiryShowCourseDropdown(false);
                              }}>
                                <div className="course-dropdown-label">{c.label}</div>
                                <div className="course-dropdown-meta">{c.duration} · {c.totalClasses} classes</div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Inquiry Date</label>
                  <input type="date" value={inquiryForm.inquiryDate} onChange={(e) => setInquiryForm({ ...inquiryForm, inquiryDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={inquiryForm.notes} onChange={(e) => setInquiryForm({ ...inquiryForm, notes: e.target.value })} placeholder="Additional notes..." rows={3} style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--gray-300)", borderRadius: 8, fontSize: 14, fontFamily: "var(--font)", resize: "vertical" }} />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={savingInquiry}>
                    {savingInquiry ? "Saving..." : selectedInquiry ? "Update Inquiry" : "Add Inquiry"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setView("inquiries")}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {view === "viewInquiry" && selectedInquiry && (
            <div className="card">
              <div className="card-header">
                <h2>{selectedInquiry.name}</h2>
                <div className="action-btns">
                  <button className="btn btn-secondary" onClick={() => { setView("inquiries"); setSelectedInquiry(null); }}>
                    Back
                  </button>
                  <button className="btn btn-primary" onClick={() => handleEditInquiry(selectedInquiry.id)}>
                    Edit
                  </button>
                  {selectedInquiry.phone && (
                    <button
                      className="btn btn-whatsapp"
                      title="Send WhatsApp"
                      onClick={() => handleSendFollowUp(selectedInquiry)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Phone</span>
                  <span className="detail-value">{selectedInquiry.phone}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{selectedInquiry.email || "—"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Course Interested</span>
                  <span className="detail-value"><span className="badge badge-course">{selectedInquiry.courseInterested || "—"}</span></span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Inquiry Date</span>
                  <span className="detail-value">{selectedInquiry.inquiryDate}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Days Since Inquiry</span>
                  <span className="detail-value" style={{ color: selectedInquiry.inquiryDate && Math.floor((new Date() - new Date(selectedInquiry.inquiryDate)) / (1000 * 60 * 60 * 24)) >= 7 ? "#d97706" : "#059669", fontWeight: 600 }}>
                    {selectedInquiry.inquiryDate ? Math.floor((new Date() - new Date(selectedInquiry.inquiryDate)) / (1000 * 60 * 60 * 24)) : "—"} days
                  </span>
                </div>
              </div>
              {selectedInquiry.notes && (
                <div className="card" style={{ marginTop: 16, border: "1px solid var(--gray-200)" }}>
                  <h3 style={{ fontSize: 15, marginBottom: 8 }}>Notes</h3>
                  <p style={{ color: "var(--gray-600)", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selectedInquiry.notes}</p>
                </div>
              )}
            </div>
          )}

          {view === "assign" && (
            <div className="card">
              <h2>Assign Student to Teacher</h2>
              <p style={{ marginBottom: 20, color: "var(--gray-500)" }}>Select a student and assign them to a teacher.</p>

              <div className="search-bar" style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                />
                <select value={assignTeacherFilter} onChange={(e) => setAssignTeacherFilter(e.target.value)}>
                  <option value="">All Teachers</option>
                  {teachers.filter((t) => t.status !== "inactive").map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {(() => {
                const filtered = students.filter((s) => {
                  const matchSearch = s.name?.toLowerCase().includes(assignSearch.toLowerCase()) ||
                                      s.phone?.includes(assignSearch);
                  const matchTeacher = !assignTeacherFilter || s.assignedTeacherId === assignTeacherFilter;
                  return matchSearch && matchTeacher;
                });

                return studentsLoading ? (
                  <div className="table-loader"><div className="spinner" /></div>
                ) : filtered.length === 0 ? (
                  <div className="empty-state">No students match your filters.</div>
                ) : (
                  <div className="responsive-table-container">
                    <div className="desktop-table">
                      <div className="table-wrapper">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Student Name</th>
                              <th>Course</th>
                              <th>Current Teacher</th>
                              <th>Assign Teacher</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((s) => {
                              const assignedTeacher = teachers.find((x) => x.id === s.assignedTeacherId || x.uid === s.assignedTeacherId);
                              return (
                                <tr key={s.id}>
                                  <td className="td-name">{s.name}</td>
                                  <td><span className="badge badge-course">{s.course}</span></td>
                                  <td>{assignedTeacher ? assignedTeacher.name : <span style={{ color: "var(--gray-400)" }}>Not assigned</span>}</td>
                                  <td>
                                    <select
                                      value={s.assignedTeacherId || ""}
                                      onChange={(e) => handleAssignTeacher(s.id, e.target.value)}
                                      style={{
                                        padding: "6px 10px", border: "1px solid var(--gray-300)",
                                        borderRadius: 6, fontSize: 13, fontFamily: "var(--font)", background: "white",
                                        maxWidth: 180,
                                      }}
                                    >
                                      <option value="">— None —</option>
                                      {teachers.filter((t) => t.status !== "inactive").map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                      ))}
                                    </select>
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
                        const assignedTeacher = teachers.find((x) => x.id === s.assignedTeacherId || x.uid === s.assignedTeacherId);
                        return (
                          <div key={s.id} className="data-card">
                            <div className="data-card-row"><span className="data-card-label"><User size={14} /></span><span className="data-card-value">{s.name}</span></div>
                            <div className="data-card-row"><span className="data-card-label"><BookOpen size={14} /></span><span className="data-card-value">{s.course}</span></div>
                            <div className="data-card-row"><span className="data-card-label"><GraduationCap size={14} /></span><span className="data-card-value">{assignedTeacher ? assignedTeacher.name : <span style={{ color: "var(--gray-400)" }}>Not assigned</span>}</span></div>
                            <div className="data-card-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                              <span className="data-card-label">Assign Teacher</span>
                              <select
                                value={s.assignedTeacherId || ""}
                                onChange={(e) => handleAssignTeacher(s.id, e.target.value)}
                                style={{
                                  padding: "10px 12px", border: "1px solid var(--gray-300)",
                                  borderRadius: 8, fontSize: 14, fontFamily: "var(--font)", background: "white",
                                  width: "100%",
                                }}
                              >
                                <option value="">— None —</option>
                                {teachers.filter((t) => t.status !== "inactive").map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {view === "schedule" && (
            <div className="card">
              <h2><CalendarCheck size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Schedule Classes</h2>
              <p style={{ marginBottom: 16, color: "var(--gray-500)" }}>Set time and session for each student.</p>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13 }}>Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    style={{ width: 180 }}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveSchedule}
                  disabled={scheduleSaving}
                  style={{ marginTop: 18 }}
                >
                  {scheduleSaving ? "Saving..." : "Save All"}
                </button>
              </div>

              {scheduleLoading ? (
                <div className="table-loader"><div className="spinner" /></div>
              ) : students.length === 0 ? (
                <div className="empty-state">No students in this branch.</div>
              ) : (
                <div className="responsive-table-container">
                  <div className="desktop-table">
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Student Name</th>
                            <th>Course</th>
                            <th>Time</th>
                            <th>Session</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s) => (
                            <tr key={s.id}>
                              <td className="td-name">{s.name}</td>
                              <td><span className="badge badge-course">{s.course}</span></td>
                              <td style={{ minWidth: 200 }}>
                                <div style={{ display: "flex", gap: 0 }}>
                                  <select
                                    className="form-input"
                                    value={scheduleData[s.id]?.time || ""}
                                    onChange={(e) => handleScheduleChange(s.id, "time", e.target.value)}
                                    style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, fontSize: 13, padding: "6px 8px" }}
                                  >
                                    <option value="">Select...</option>
                                    {SCHEDULE_TIME_SLOTS.map((slot) => (
                                      <option key={slot} value={slot}>{slot}</option>
                                    ))}
                                  </select>
                                  <input
                                    className="form-input"
                                    placeholder="Or type..."
                                    value={scheduleData[s.id]?.time || ""}
                                    onChange={(e) => handleScheduleChange(s.id, "time", e.target.value)}
                                    style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "none", fontSize: 13, padding: "6px 8px", minWidth: 80 }}
                                  />
                                </div>
                              </td>
                              <td>
                                <input
                                  className="form-input"
                                  placeholder="e.g. Session 5"
                                  value={scheduleData[s.id]?.session || ""}
                                  onChange={(e) => handleScheduleChange(s.id, "session", e.target.value)}
                                  style={{ fontSize: 13, padding: "6px 8px", minWidth: 120 }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mobile-cards">
                    {students.map((s) => (
                      <div key={s.id} className="data-card">
                        <div className="data-card-row"><span className="data-card-label"><User size={14} /></span><span className="data-card-value">{s.name}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><BookOpen size={14} /></span><span className="data-card-value">{s.course}</span></div>
                        <div className="data-card-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                          <span className="data-card-label">Time</span>
                          <select
                            className="form-input"
                            value={scheduleData[s.id]?.time || ""}
                            onChange={(e) => handleScheduleChange(s.id, "time", e.target.value)}
                            style={{ fontSize: 14 }}
                          >
                            <option value="">Select...</option>
                            {SCHEDULE_TIME_SLOTS.map((slot) => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
                          </select>
                          <input
                            className="form-input"
                            placeholder="Or type custom time..."
                            value={scheduleData[s.id]?.time || ""}
                            onChange={(e) => handleScheduleChange(s.id, "time", e.target.value)}
                            style={{ fontSize: 14 }}
                          />
                        </div>
                        <div className="data-card-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                          <span className="data-card-label">Session</span>
                          <input
                            className="form-input"
                            placeholder="e.g. Session 5"
                            value={scheduleData[s.id]?.session || ""}
                            onChange={(e) => handleScheduleChange(s.id, "session", e.target.value)}
                            style={{ fontSize: 14 }}
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveSchedule}
                      disabled={scheduleSaving}
                      style={{ width: "100%", marginTop: 12 }}
                    >
                      {scheduleSaving ? "Saving..." : "Save All"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <ConfirmModal
        open={!!confirm}
        title="Confirm Delete"
        message={confirm?.message || ""}
        onConfirm={() => { const fn = confirm?.onConfirm; setConfirm(null); if (fn) fn(); }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
