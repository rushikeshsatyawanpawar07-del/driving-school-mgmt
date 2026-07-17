import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useBranch } from "../context/BranchContext";
import {
  getStudents, addStudent, updateStudent, deleteStudent, getStudent, recordPayment, assignStudentToTeacher,
} from "../services/studentService";
import {
  getTeachers, addTeacher, updateTeacher, deleteTeacher, toggleTeacherStatus,
} from "../services/teacherService";
import { generateInvoicePDF } from "../services/invoiceService";
import { SCHOOL } from "../config/schoolConfig";
import SeedBranches from "./SeedBranches";
import {
  getInquiries, addInquiry, updateInquiry, deleteInquiry, checkFollowUps, markFollowUpSent,
} from "../services/inquiryService";
import {
  LayoutDashboard, Users, GraduationCap, Link2, ClipboardList, Car, Wallet, BadgeAlert,
  CheckCircle, Bell, Calendar, TriangleAlert, Phone, Eye, Pencil, Trash2, User,
  Mail, BookOpen, CreditCard, Star, Sunrise, Sun, Sunset, Bike, CircleOff,
  Copy, Fingerprint, Clock
} from "lucide-react";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const { selectedBranch, setSelectedBranch, branches, branchesLoaded } = useBranch();
  const navigate = useNavigate();
  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Student state
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [form, setForm] = useState({
    name: "", phone: "", altPhone: "", email: "", address: "",
    course: "", joiningDate: "",
    assignedTeacherId: "", batch: "", vehicleType: "",
    courseFees: 0, feesPaid: 0, pendingFees: 0,
    // editable course fields
    courseType: "", totalClasses: "", duration: "", classDuration: "",
  });
  const [courseSearch, setCourseSearch] = useState("");
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const courseDropdownRef = useRef(null);
  const courseOptions = SCHOOL.courses;
  const filteredCourses = useMemo(
    () => courseOptions.filter((c) => c.label.toLowerCase().includes(courseSearch.toLowerCase())),
    [courseSearch]
  );

  useEffect(() => {
    const handleClick = (e) => { if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target)) setShowCourseDropdown(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  useEffect(() => {
    const handleClick = (e) => { if (inquiryCourseDropdownRef.current && !inquiryCourseDropdownRef.current.contains(e.target)) setInquiryShowCourseDropdown(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Teacher state
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    name: "", phone: "", address: "", experience: "", licenseNumber: "",
    email: "", password: "", status: "active",
  });

  // Inquiry state
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [savingInquiry, setSavingInquiry] = useState(false);
  const [inquirySearch, setInquirySearch] = useState("");
  const [inquiryForm, setInquiryForm] = useState({
    name: "", phone: "", email: "", courseInterested: "", inquiryDate: new Date().toISOString().split("T")[0], notes: "",
  });
  const [followUpsDue, setFollowUpsDue] = useState([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignTeacherFilter, setAssignTeacherFilter] = useState("");
  const [inquiryCourseSearch, setInquiryCourseSearch] = useState("");
  const [inquiryShowCourseDropdown, setInquiryShowCourseDropdown] = useState(false);
  const [inquirySelectedCourse, setInquirySelectedCourse] = useState(null);
  const inquiryCourseDropdownRef = useRef(null);
  const filteredInquiryCourses = useMemo(
    () => courseOptions.filter((c) => c.label.toLowerCase().includes(inquiryCourseSearch.toLowerCase())),
    [inquiryCourseSearch]
  );

  // ── Student handlers ──

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStudents(selectedBranch?.id);
      setStudents(data);
    } catch { addNotification("Failed to load students", "error"); }
    setLoading(false);
  }, [addNotification, selectedBranch]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filtered = students
    .filter((s) => {
      const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) ||
                          s.phone?.includes(search);
      const matchCourse = courseFilter === "all" || s.course === courseFilter;
      return matchSearch && matchCourse;
    })
    .sort((a, b) =>
      sortDir === "asc"
        ? (a.name || "").localeCompare(b.name || "")
        : (b.name || "").localeCompare(a.name || "")
    );

  const courses = [...new Set(students.map((s) => s.course).filter(Boolean))].filter((c) => !["Beginner", "Advanced"].includes(c));

  const stats = {
    total: students.length,
    active: students.filter((s) => s.status === "active").length,
    feesCollected: students.reduce((s, x) => s + (x.feesPaid || 0), 0),
    pendingFees: students.reduce((s, x) => s + (x.remainingFees || 0), 0),
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { addNotification("Student name is required", "error"); return; }
    if (!form.phone || form.phone.replace(/\D/g, "").length !== 10) { addNotification("Phone must be exactly 10 digits", "error"); return; }
    if (!form.course) { addNotification("Course selection is required", "error"); return; }
    if (!form.joiningDate) { addNotification("Joining date is required", "error"); return; }
    if (Number(form.feesPaid) > Number(form.courseFees)) { addNotification("Fees paid cannot exceed course fees", "error"); return; }
    setSaving(true);
    const cf = Number(form.courseFees);
    const fp = Number(form.feesPaid);
    const pf = cf - fp;
    const payload = {
      ...form,
      courseFees: cf,
      feesPaid: fp,
      pendingFees: pf,
      totalFees: cf,
      remainingFees: pf,
      branchId: selectedBranch?.id || null,
    };
    delete payload.courseType; delete payload.totalClasses; delete payload.duration; delete payload.classDuration;
    try {
      let studentId;
      if (selectedStudent) {
        await updateStudent(selectedStudent, payload);
        studentId = selectedStudent;
        addNotification("Student updated");
      } else {
        const saved = await addStudent(payload);
        studentId = saved.id;
        addNotification("Student added");
      }
      try {
        const latest = await getStudent(studentId);
        if (latest) await generateInvoicePDF(latest, teachers);
      } catch { addNotification("Invoice download failed, student was saved", "error"); }
      setForm({ name: "", phone: "", altPhone: "", email: "", address: "", course: "", joiningDate: "", assignedTeacherId: "", batch: "", vehicleType: "", courseFees: 0, feesPaid: 0, pendingFees: 0, courseType: "", totalClasses: "", duration: "", classDuration: "" });
      setSelectedCourse(null);
      setCourseSearch("");
      setSelectedStudent(null);
      setView("students");
      loadStudents();
    } catch (e) { addNotification(e?.message || "Failed to save student", "error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteStudent(id);
      addNotification("Student deleted");
      loadStudents();
    } catch { addNotification("Failed to delete student", "error"); }
    setDeleting(null);
  };

  const handleEdit = async (id) => {
    const s = students.find((x) => x.id === id);
    if (!s) return;
    const course = courseOptions.find((c) => c.id === s.course) || null;
    setForm({
      name: s.name || "",
      phone: s.phone || "",
      altPhone: s.altPhone || "",
      email: s.email || "",
      address: s.address || "",
      course: s.course || "",
      joiningDate: s.joiningDate || "",
      assignedTeacherId: s.assignedTeacherId || "",
      batch: s.batch || "",
      vehicleType: s.vehicleType || "",
      courseFees: s.courseFees || s.totalFees || 0,
      feesPaid: s.feesPaid || 0,
      pendingFees: s.pendingFees || s.remainingFees || 0,
      courseType: course ? course.label : (s.course || ""),
      totalClasses: course ? course.totalClasses : (s.totalClasses || ""),
      duration: course ? course.duration : (s.duration || ""),
      classDuration: course ? course.classDuration : (s.classDuration || ""),
    });
    setSelectedCourse(course);
    setCourseSearch(course ? course.label : "");
    setSelectedStudent(id);
    setView("addStudent");
  };

  const handleView = async (id) => {
    const s = await getStudent(id);
    setSelectedStudent(s);
    setView("viewStudent");
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

  const handleAssignTeacher = async (studentId, teacherId) => {
    try {
      await assignStudentToTeacher(studentId, teacherId);
      addNotification(teacherId ? "Teacher assigned" : "Assignment removed");
      loadStudents();
      if (selectedStudent?.id === studentId) {
        setSelectedStudent((prev) => ({ ...prev, assignedTeacherId: teacherId || null }));
      }
    } catch { addNotification("Assignment failed", "error"); }
  };

  // ── Teacher handlers ──

  const loadTeachers = useCallback(async () => {
    setTeachersLoading(true);
    try {
      const data = await getTeachers(selectedBranch?.id);
      setTeachers(data);
    } catch { addNotification("Failed to load teachers", "error"); }
    setTeachersLoading(false);
  }, [addNotification, selectedBranch]);

  useEffect(() => {
    if (["teachers", "addTeacher", "students", "addStudent", "viewStudent", "assign"].includes(view))
      loadTeachers();
  }, [view, loadTeachers]);

  const handleSaveTeacher = async (e) => {
    e.preventDefault();
    if (!teacherForm.name || !teacherForm.email) {
      addNotification("Name and email are required", "error");
      return;
    }
    if (!selectedTeacher && !teacherForm.password) {
      addNotification("Password is required", "error");
      return;
    }
    setSavingTeacher(true);
    try {
      if (selectedTeacher) {
        await updateTeacher(selectedTeacher, teacherForm);
        addNotification("Teacher updated");
      } else {
        await addTeacher({ ...teacherForm, branchId: selectedBranch?.id || null });
        addNotification("Teacher registered successfully");
      }
      setTeacherForm({ name: "", phone: "", address: "", experience: "", licenseNumber: "", email: "", password: "", status: "active" });
      setSelectedTeacher(null);
      setView("teachers");
      loadTeachers();
    } catch (err) {
      addNotification(err.message || "Failed to save teacher", "error");
    }
    setSavingTeacher(false);
  };

  const handleEditTeacher = (id) => {
    const t = teachers.find((x) => x.id === id);
    if (!t) return;
    setTeacherForm({
      name: t.name || "",
      phone: t.phone || "",
      address: t.address || "",
      experience: t.experience || "",
      licenseNumber: t.licenseNumber || "",
      email: t.email || "",
      password: "",
      status: t.status || "active",
    });
    setSelectedTeacher(id);
    setView("addTeacher");
  };

  const handleViewTeacher = (id) => {
    const t = teachers.find((x) => x.id === id);
    if (!t) return;
    setSelectedTeacher(id);
    setView("viewTeacher");
  };

  const handleDeleteTeacher = async (id) => {
    setDeleting(id);
    try {
      await deleteTeacher(id);
      addNotification("Teacher deleted");
      loadTeachers();
    } catch { addNotification("Failed to delete teacher", "error"); }
    setDeleting(null);
  };

  const handleToggleStatus = async (id, current) => {
    try {
      const newStatus = await toggleTeacherStatus(id, current);
      addNotification(`Teacher ${newStatus === "active" ? "enabled" : "disabled"}`);
      loadTeachers();
    } catch { addNotification("Failed to update status", "error"); }
  };

  // ── Inquiry handlers ──

  const loadInquiries = useCallback(async () => {
    setInquiriesLoading(true);
    try {
      const data = await getInquiries(selectedBranch?.id);
      setInquiries(data);
    } catch { addNotification("Failed to load inquiries", "error"); }
    setInquiriesLoading(false);
  }, [addNotification, selectedBranch]);

  useEffect(() => {
    if (["inquiries", "addInquiry", "viewInquiry", "dashboard"].includes(view)) loadInquiries();
  }, [view, loadInquiries]);

  const filteredInquiries = inquiries
    .filter((inq) => {
      const matchSearch = inq.name?.toLowerCase().includes(inquirySearch.toLowerCase()) ||
                          inq.phone?.includes(inquirySearch);
      return matchSearch;
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
    const checkFollowUp = async () => {
      if (inquiries.length > 0) {
        const due = await checkFollowUps(inquiries);
        setFollowUpsDue(due);
      }
    };
    if (view === "dashboard") checkFollowUp();
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
        await addInquiry({ ...inquiryForm, branchId: selectedBranch?.id || null });
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

  const handleViewInquiry = (id) => {
    const inq = inquiries.find((x) => x.id === id);
    if (!inq) return;
    setSelectedInquiry(inq);
    setView("viewInquiry");
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "students", label: "Students", icon: Users },
    { key: "teachers", label: "Teacher Management", icon: GraduationCap },
    { key: "assign", label: "Assign Student", icon: Link2 },
    { key: "inquiries", label: "Inquiries", icon: ClipboardList },
  ];

  const isTeachersActive = view === "teachers" || view === "addTeacher";

  return (
    <div className="app-layout">
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-brand">
            <span className="sidebar-logo"><Car size={28} /></span>
            <span>{SCHOOL.shortName}</span>
          </div>
          {selectedBranch && (
            <div style={{ padding: "8px 16px", fontSize: 13, color: "var(--gray-500)" }}>
              Branch: <strong>{selectedBranch.name}</strong>
            </div>
          )}
          <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-link ${item.key === "dashboard" && view === "dashboard" ? "active" : ""} ${item.key === "students" && (view === "students" || view === "addStudent" || view === "viewStudent") ? "active" : ""} ${item.key === "teachers" && isTeachersActive ? "active" : ""} ${item.key === "assign" && view === "assign" ? "active" : ""} ${item.key === "inquiries" && (view === "inquiries" || view === "addInquiry" || view === "viewInquiry") ? "active" : ""}`}
              onClick={() => { setView(item.key); setSidebarOpen(false); }}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="user-badge owner-badge">Owner</span>
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
            {view === "dashboard" && "Dashboard"}
            {view === "students" && "Students"}
            {view === "addStudent" && (selectedStudent ? "Edit Student" : "Add Student")}
            {view === "viewStudent" && "Student Details"}
            {view === "teachers" && "Teacher Management"}
            {view === "viewTeacher" && "Teacher Details"}
            {view === "addTeacher" && (selectedTeacher ? "Edit Teacher" : "Register Teacher")}
            {view === "assign" && "Assign Student to Teacher"}
            {view === "inquiries" && "Inquiries"}
            {view === "addInquiry" && (selectedInquiry ? "Edit Inquiry" : "Add Inquiry")}
            {view === "viewInquiry" && "Inquiry Details"}
          </h1>
          <div className="topbar-right">
            {branches.length > 0 && (
              <select
                value={selectedBranch?.id || ""}
                onChange={(e) => {
                  const b = branches.find((x) => x.id === e.target.value);
                  if (b) setSelectedBranch(b);
                }}
                style={{ marginRight: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--gray-300)", fontSize: 14 }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <span className="user-badge owner-badge">Owner</span>
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
                    <p className="stat-number">{stats.total}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-green"><Wallet size={24} /></div>
                  <div className="stat-body">
                    <h3>Fees Collected</h3>
                    <p className="stat-number">₹{stats.feesCollected.toLocaleString()}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-red"><BadgeAlert size={24} /></div>
                  <div className="stat-body">
                    <h3>Pending Fees</h3>
                    <p className="stat-number">₹{stats.pendingFees.toLocaleString()}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-purple"><CheckCircle size={24} /></div>
                  <div className="stat-body">
                    <h3>Active Students</h3>
                    <p className="stat-number">{stats.active}</p>
                  </div>
                </div>
              </div>
              {branchesLoaded && (
                <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--warning)" }}>
                  <SeedBranches onDone={() => window.location.reload()} />
                </div>
              )}
              <div className="card">
                <h2>Welcome back, {user?.name || "Owner"}!</h2>
                <p>Manage your driving school from this dashboard.</p>
              </div>

              {/* Follow-Up Required Section */}
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

            </>
          )}

          {view === "students" && (
            <div className="card">
              <div className="card-header">
                <h2>All Students</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => {
                    setForm({ name: "", phone: "", altPhone: "", email: "", address: "", course: "", joiningDate: "", assignedTeacherId: "", batch: "", vehicleType: "", courseFees: 0, feesPaid: 0, pendingFees: 0, courseType: "", totalClasses: "", duration: "", classDuration: "" });
                    setSelectedStudent(null);
                    setView("addStudent");
                  }}>
                    + Add Student
                  </button>
                </div>
              </div>

              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                  <option value="all">All Courses</option>
                  {courses.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button className="btn btn-sm" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
                  Sort {sortDir === "asc" ? "Z-A" : "A-Z"}
                </button>
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
                                  <button className="btn btn-icon btn-view" title="View" onClick={() => handleView(s.id)}><Eye size={18} /></button>
                                  <button className="btn btn-icon btn-edit" title="Edit" onClick={() => handleEdit(s.id)}><Pencil size={18} /></button>
                                  {s.studentId && (
                                    <button className="btn btn-icon" title="Copy Student ID" onClick={() => { navigator.clipboard.writeText(s.studentId).catch(() => {}); addNotification("Student ID copied!"); }}><Copy size={18} /></button>
                                  )}
                                  <button className="btn btn-icon btn-delete" title="Delete" disabled={deleting === s.id} onClick={() => {
                                    if (window.confirm(`Delete ${s.name}?`)) handleDelete(s.id);
                                  }}><Trash2 size={18} /></button>
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
                            <button className="btn btn-sm btn-secondary" onClick={() => handleView(s.id)}><Eye size={16} /> View</button>
                            <button className="btn btn-sm btn-primary" onClick={() => handleEdit(s.id)}><Pencil size={16} /> Edit</button>
                            {s.studentId && (
                              <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(s.studentId).catch(() => {}); addNotification("Student ID copied!"); }}><Copy size={16} /> Copy ID</button>
                            )}
                            <button className="btn btn-sm btn-danger" disabled={deleting === s.id} onClick={() => { if (window.confirm(`Delete ${s.name}?`)) handleDelete(s.id); }}><Trash2 size={16} /> Delete</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "addStudent" && (
            <div className="card form-card">
              <h2>{selectedStudent ? "Edit Student" : "Add New Student"}</h2>
              <form onSubmit={handleSave} className="student-form">
                <div className="form-sections">
                  {/* Section 1: Student Information */}
                  <div className="form-section">
                    <div className="form-section-header">
                      <User size={20} />
                      <h3>Student Information</h3>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Student Name *</label>
                        <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                      </div>
                      <div className="form-group">
                        <label>Phone Number *</label>
                        <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit phone" maxLength={10} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Alternate Phone</label>
                        <input className="form-input" value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value })} placeholder="Alternate phone" />
                      </div>
                      <div className="form-group">
                        <label>Email Address</label>
                        <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                        <label>Address</label>
                        <textarea className="form-input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Course Information */}
                  <div className="form-section">
                    <div className="form-section-header">
                      <BookOpen size={20} />
                      <h3>Course Information</h3>
                    </div>
                    <div className="form-group">
                      <label>Select Course *</label>
                      <div className="course-select-wrapper" ref={courseDropdownRef}>
                        <input
                          className="form-input"
                          value={selectedCourse ? selectedCourse.label : courseSearch}
                          onChange={(e) => { setCourseSearch(e.target.value); setSelectedCourse(null); setForm({ ...form, course: "" }); setShowCourseDropdown(true); }}
                          onFocus={() => setShowCourseDropdown(true)}
                          placeholder="Search or select a course..."
                        />
                        {showCourseDropdown && (
                          <div className="course-dropdown">
                            {filteredCourses.length === 0 ? (
                              <div className="course-dropdown-empty">No courses found</div>
                            ) : (
                              filteredCourses.map((c) => (
                                <div key={c.id} className="course-dropdown-item" onClick={() => {
                                  setSelectedCourse(c);
                                  setCourseSearch(c.label);
                                  const fp = Number(form.feesPaid) || 0;
                                  const cf = c.price;
                                  setForm({ ...form, course: c.id, courseFees: cf, pendingFees: Math.max(0, cf - fp), courseType: c.label, totalClasses: c.totalClasses, duration: c.duration, classDuration: c.classDuration });
                                  setShowCourseDropdown(false);
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
                    {selectedCourse && (
                      <div className="course-details-card">
                        <div className="course-details-grid">
                          <div className="form-group">
                            <label><BookOpen size={14} /> Course Type</label>
                            <input className="form-input" value={form.courseType} onChange={(e) => setForm({ ...form, courseType: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label><Clock size={14} /> Duration (Days)</label>
                            <input className="form-input" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label><Calendar size={14} /> Total Classes</label>
                            <input className="form-input" type="number" value={form.totalClasses} onChange={(e) => setForm({ ...form, totalClasses: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label><Clock size={14} /> Class Duration (Minutes)</label>
                            <input className="form-input" value={form.classDuration} onChange={(e) => setForm({ ...form, classDuration: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Admission Information */}
                  <div className="form-section">
                    <div className="form-section-header">
                      <ClipboardList size={20} />
                      <h3>Admission Information</h3>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Joining Date *</label>
                        <input className="form-input" type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Assigned Teacher</label>
                        <select className="form-input" value={form.assignedTeacherId} onChange={(e) => setForm({ ...form, assignedTeacherId: e.target.value })}>
                          <option value="">— Select Teacher —</option>
                          {teachers.filter((t) => t.status !== "inactive").map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Batch</label>
                        <div className="radio-group">
                          <label className={`radio-label ${form.batch === "Morning" ? "active" : ""}`}>
                            <input type="radio" name="batch" value="Morning" checked={form.batch === "Morning"} onChange={(e) => setForm({ ...form, batch: e.target.value })} /> <Sunrise size={16} /> Morning
                          </label>
                          <label className={`radio-label ${form.batch === "Afternoon" ? "active" : ""}`}>
                            <input type="radio" name="batch" value="Afternoon" checked={form.batch === "Afternoon"} onChange={(e) => setForm({ ...form, batch: e.target.value })} /> <Sun size={16} /> Afternoon
                          </label>
                          <label className={`radio-label ${form.batch === "Evening" ? "active" : ""}`}>
                            <input type="radio" name="batch" value="Evening" checked={form.batch === "Evening"} onChange={(e) => setForm({ ...form, batch: e.target.value })} /> <Sunset size={16} /> Evening
                          </label>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Vehicle Type</label>
                        <div className="radio-group">
                          <label className={`radio-label ${form.vehicleType === "Two Wheeler" ? "active" : ""}`}>
                            <input type="radio" name="vehicleType" value="Two Wheeler" checked={form.vehicleType === "Two Wheeler"} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })} /> <Bike size={16} /> Two Wheeler
                          </label>
                          <label className={`radio-label ${form.vehicleType === "Four Wheeler" ? "active" : ""}`}>
                            <input type="radio" name="vehicleType" value="Four Wheeler" checked={form.vehicleType === "Four Wheeler"} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })} /> <Car size={16} /> Four Wheeler
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="form-row fees-row">
                      <div className="form-group">
                        <label>Course Fees (₹) *</label>
                        <input className="form-input" type="number" value={form.courseFees} readOnly tabIndex={-1} style={{ background: "var(--gray-100)", cursor: "not-allowed" }} />
                      </div>
                      <div className="form-group">
                        <label>Fees Paid (₹)</label>
                        <input className="form-input" type="number" value={form.feesPaid} onChange={(e) => {
                          const fp = Math.max(0, Number(e.target.value) || 0);
                          const cf = Number(form.courseFees);
                          if (fp > cf) { addNotification("Fees paid cannot exceed course fees", "error"); return; }
                          setForm({ ...form, feesPaid: fp, pendingFees: cf - fp });
                        }} placeholder="0" min="0" />
                      </div>
                      <div className="form-group">
                        <label>Pending Fees (₹)</label>
                        <input className="form-input" type="number" value={form.pendingFees} readOnly tabIndex={-1} style={{ background: "var(--gray-100)", cursor: "not-allowed", color: Number(form.pendingFees) > 0 ? "var(--danger)" : "var(--success)" }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <><span className="spinner-sm" /> Saving...</> : selectedStudent ? "Update Student" : "Add Student"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setView("students")}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {view === "viewStudent" && selectedStudent && (
            <div className="card">
              <div className="card-header">
                <h2>{selectedStudent.name}</h2>
                <div className="action-btns">
                  <button className="btn btn-secondary" onClick={() => { setView("students"); setSelectedStudent(null); }}>
                    Back
                  </button>
                  <button className="btn btn-primary" onClick={() => handleEdit(selectedStudent.id)}>
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
                  <input
                    type="number"
                    placeholder="Amount (₹)"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    min="0"
                  />
                  <button className="btn btn-success" onClick={handlePayment} disabled={saving}>
                    {saving ? "Processing..." : "Record Payment"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === "teachers" && (
            <div className="card">
              <div className="card-header">
                <h2>All Teachers</h2>
                <button className="btn btn-primary" onClick={() => {
                  setTeacherForm({ name: "", phone: "", address: "", experience: "", licenseNumber: "", email: "", password: "", status: "active" });
                  setSelectedTeacher(null);
                  setView("addTeacher");
                }}>
                  + Register Teacher
                </button>
              </div>

              {teachersLoading ? (
                <div className="table-loader"><div className="spinner" /></div>
              ) : teachers.length === 0 ? (
                <div className="empty-state">No teachers registered yet.</div>
              ) : (
                <div className="responsive-table-container">
                  <div className="desktop-table">
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Email</th>
                            <th>Experience</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teachers.map((t) => (
                            <tr key={t.id}>
                              <td className="td-name">{t.name}</td>
                              <td>{t.phone || "—"}</td>
                              <td>{t.email}</td>
                              <td>{t.experience || "—"}</td>
                              <td>
                                <span className={`badge ${t.status === "active" ? "badge-success" : "badge-danger"}`}>
                                  {t.status}
                                </span>
                              </td>
                              <td>
                                <div className="action-btns">
                                  <button className="btn btn-icon btn-view" title="View" onClick={() => handleViewTeacher(t.id)}><Eye size={18} /></button>
                                  <button className="btn btn-icon btn-edit" title="Edit" onClick={() => handleEditTeacher(t.id)}><Pencil size={18} /></button>
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: t.status === "active" ? "var(--warning-bg)" : "var(--success-bg)", color: t.status === "active" ? "#92400e" : "#065f46", border: "none" }}
                                    onClick={() => handleToggleStatus(t.id, t.status)}
                                  >
                                    {t.status === "active" ? "Disable" : "Enable"}
                                  </button>
                                  <button className="btn btn-icon btn-delete" title="Delete" disabled={deleting === t.id} onClick={() => {
                                    if (window.confirm(`Delete teacher ${t.name}? This also removes their login access.`)) handleDeleteTeacher(t.id);
                                  }}><Trash2 size={18} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mobile-cards">
                    {teachers.map((t) => (
                      <div key={t.id} className="data-card">
                        <div className="data-card-row"><span className="data-card-label"><User size={14} /></span><span className="data-card-value">{t.name}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><Phone size={14} /></span><span className="data-card-value">{t.phone || "—"}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><Mail size={14} /></span><span className="data-card-value">{t.email}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><Star size={14} /></span><span className="data-card-value">{t.experience || "—"}</span></div>
                        <div className="data-card-row"><span className="data-card-label">Status</span><span className={`badge ${t.status === "active" ? "badge-success" : "badge-danger"}`}>{t.status}</span></div>
                        <div className="data-card-actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => handleViewTeacher(t.id)}><Eye size={16} /> View</button>
                          <button className="btn btn-sm btn-primary" onClick={() => handleEditTeacher(t.id)}><Pencil size={16} /> Edit</button>
                          <button className="btn btn-sm" style={{ background: t.status === "active" ? "var(--warning-bg)" : "var(--success-bg)", color: t.status === "active" ? "#92400e" : "#065f46", border: "none" }} onClick={() => handleToggleStatus(t.id, t.status)}>
                            {t.status === "active" ? <><CircleOff size={16} /> Disable</> : <><CheckCircle size={16} /> Enable</>}
                          </button>
                          <button className="btn btn-sm btn-danger" disabled={deleting === t.id} onClick={() => { if (window.confirm(`Delete teacher ${t.name}?`)) handleDeleteTeacher(t.id); }}><Trash2 size={16} /> Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "viewTeacher" && (() => {
            const t = teachers.find((x) => x.id === selectedTeacher);
            if (!t) return null;
            return (
              <div className="card">
                <div className="card-header">
                  <h2>{t.name}</h2>
                  <div className="action-btns">
                    <button className="btn btn-secondary" onClick={() => { setView("teachers"); setSelectedTeacher(null); }}>
                      Back
                    </button>
                    <button className="btn btn-primary" onClick={() => handleEditTeacher(t.id)}>
                      Edit
                    </button>
                  </div>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{t.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{t.phone || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">{t.address || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Experience</span>
                    <span className="detail-value">{t.experience || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">License Number</span>
                    <span className="detail-value">{t.licenseNumber || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className={`badge ${t.status === "active" ? "badge-success" : "badge-danger"}`}>
                      {t.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

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

                return filtered.length === 0 ? (
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
                                  <button className="btn btn-icon btn-delete" title="Delete" disabled={deleting === inq.id} onClick={() => {
                                    if (window.confirm(`Delete inquiry from ${inq.name}?`)) handleDeleteInquiry(inq.id);
                                  }}><Trash2 size={18} /></button>
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
                            <button className="btn btn-sm btn-danger" disabled={deleting === inq.id} onClick={() => { if (window.confirm(`Delete inquiry from ${inq.name}?`)) handleDeleteInquiry(inq.id); }}><Trash2 size={16} /> Delete</button>
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

          {view === "addTeacher" && (
            <div className="card form-card">
              <h2>{selectedTeacher ? "Edit Teacher" : "Register New Teacher"}</h2>
              <form onSubmit={handleSaveTeacher}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} placeholder="Full name" />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input value={teacherForm.phone} onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })} placeholder="Phone number" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Address</label>
                    <input value={teacherForm.address} onChange={(e) => setTeacherForm({ ...teacherForm, address: e.target.value })} placeholder="Address" />
                  </div>
                  <div className="form-group">
                    <label>Experience</label>
                    <input value={teacherForm.experience} onChange={(e) => setTeacherForm({ ...teacherForm, experience: e.target.value })} placeholder="e.g. 5 years" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>License Number</label>
                    <input value={teacherForm.licenseNumber} onChange={(e) => setTeacherForm({ ...teacherForm, licenseNumber: e.target.value })} placeholder="License number" />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={teacherForm.status} onChange={(e) => setTeacherForm({ ...teacherForm, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} placeholder="teacher@example.com" />
                  </div>
                  <div className="form-group">
                    <label>Password {selectedTeacher ? "(leave blank to keep current)" : "*"}</label>
                    <input type="password" value={teacherForm.password} onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })} placeholder={selectedTeacher ? "New password" : "Password"} />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={savingTeacher}>
                    {savingTeacher ? "Creating..." : selectedTeacher ? "Update Teacher" : "Create Teacher"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setView("teachers")}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
