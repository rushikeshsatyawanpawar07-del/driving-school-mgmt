import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useBranch } from "../context/BranchContext";
import {
  getStudents, addStudent, updateStudent, deleteStudent, getStudent, recordPayment, assignStudentToTeacher,
} from "../services/studentService";
import {
  getTeachers, addTeacher, updateTeacher, deleteTeacher, toggleTeacherStatus,
} from "../services/teacherService";
import {
  getReceptionists, addReceptionist, updateReceptionist, deleteReceptionist, toggleReceptionistStatus,
} from "../services/receptionistService";
import { generateInvoicePDF } from "../services/invoiceService";
import { migrateAttendanceClientAuth } from "../services/attendanceService";
import { addComplaint, subscribeComplaints, markComplaintRead } from "../services/complaintService";
import { SCHOOL, getCourseTotalClasses } from "../config/schoolConfig";
import {
  getInquiries, addInquiry, updateInquiry, deleteInquiry, checkFollowUps, markFollowUpSent,
  searchInquiriesByName, subscribeInquiries,
} from "../services/inquiryService";
import LicenseReminderSection from "./LicenseReminderSection";
import ConfirmModal from "./ConfirmModal";

const MORNING_SLOTS = [
  "06:00 AM – 06:30 AM","06:30 AM – 07:00 AM","07:00 AM – 07:30 AM",
  "07:30 AM – 08:00 AM","08:00 AM – 08:30 AM","08:30 AM – 09:00 AM",
  "09:00 AM – 09:30 AM","09:30 AM – 10:00 AM","10:00 AM – 10:30 AM",
  "10:30 AM – 11:00 AM","11:00 AM – 11:30 AM","11:30 AM – 12:00 PM",
  "12:00 PM – 12:30 PM","12:30 PM – 01:00 PM",
];
const EVENING_SLOTS = [
  "04:00 PM – 04:30 PM","04:30 PM – 05:00 PM","05:00 PM – 05:30 PM",
  "05:30 PM – 06:00 PM","06:00 PM – 06:30 PM","06:30 PM – 07:00 PM",
  "07:00 PM – 07:30 PM","07:30 PM – 08:00 PM","08:00 PM – 08:30 PM",
  "08:30 PM – 09:00 PM","09:00 PM – 09:30 PM",
];
import {
  LayoutDashboard, Users, GraduationCap, Link2, ClipboardList, Car, Wallet, BadgeAlert,
  CheckCircle, Bell, Calendar, TriangleAlert, Phone, Eye, Pencil, Trash2, User,
  Mail, BookOpen, CreditCard, Star, Sunrise, Sun, Sunset, Bike, CircleOff,
  Copy, Fingerprint, Clock, Gauge, Search, MessageCircle, Building2, Plus
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
  // All vehicles loaded from Firestore for checkboxes in the form
  const [allVehicles, setAllVehicles] = useState([]);

  const [form, setForm] = useState({
    name: "", phone: "", altPhone: "", email: "",
    permanentAddress: "", temporaryAddress: "", bloodGroup: "", dob: "",
    llNumber: "", llValidFrom: "", llValidTo: "", dlNumber: "", dlValidTill: "",
    course: "", joiningDate: "", courseCompletionDate: "",
    assignedTeacherId: "", batch: "", vehicleType: "",
    selectedVehicles: [], courseFees: 0, finalFee: 0, feesPaid: 0, pendingFees: 0,
    discountType: "", discountValue: 0, feeNote: "",
    batchTime: "",
    twoWheelerType: "", twoWheelerName: "", twoWheelerPrice: 0,
    // editable course fields
    courseType: "", totalClasses: "", duration: "", classDuration: "",
  });
  const [courseSearch, setCourseSearch] = useState("");
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const courseDropdownRef = useRef(null);
  const courseOptions = SCHOOL.courses;
  const filteredCourses = useMemo(
    () => courseOptions.filter((c) => c.label.toLowerCase().includes(courseSearch.toLowerCase())),
    [courseSearch]
  );

  const [matchedInquiryId, setMatchedInquiryId] = useState(null);
  const [inquiryResults, setInquiryResults] = useState([]);
  const [showInquiryDropdown, setShowInquiryDropdown] = useState(false);
  const [searchAllBranches, setSearchAllBranches] = useState(true);
  const inquiryTimerRef = useRef(null);
  const inquiryDropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target)) setShowCourseDropdown(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  useEffect(() => {
    const handleClick = (e) => { if (inquiryDropdownRef.current && !inquiryDropdownRef.current.contains(e.target)) setShowInquiryDropdown(false); };
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
  const [confirm, setConfirm] = useState(null);

  // Teacher state
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    name: "", phone: "", address: "", experience: "", licenseNumber: "",
    email: "", password: "", status: "active", salary: "", currentPassword: "",
  });

  // Reception state
  const [receptionists, setReceptionists] = useState([]);
  const [receptionistsLoading, setReceptionistsLoading] = useState(true);
  const [selectedReceptionist, setSelectedReceptionist] = useState(null);
  const [savingReceptionist, setSavingReceptionist] = useState(false);
  const [receptionForm, setReceptionForm] = useState({
    name: "", phone: "", address: "", email: "", password: "", salary: "", branchId: "", status: "active", currentPassword: "",
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
  const [complaints, setComplaints] = useState([]);
  const [complaintsUnread, setComplaintsUnread] = useState(0);
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

  // Load vehicles reactively so checkboxes and VehicleMaster stay in sync
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vehicles"), (snap) => {
      setAllVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

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

  useEffect(() => {
    if (!localStorage.getItem("attClientAuthMigrated")) {
      migrateAttendanceClientAuth().then(() => {
        localStorage.setItem("attClientAuthMigrated", "1");
      }).catch(() => {});
    }
  }, []);

  // 🔽 Pending Fees filter: when "pending_fees" is selected, show students with remaining dues
  const filtered = students
    .filter((s) => {
      const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) ||
                          s.phone?.includes(search);
      const matchCourse = courseFilter === "all"
        || (courseFilter === "pending_fees" ? (s.pendingFees > 0 || s.remainingFees > 0) : s.course === courseFilter);
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

  // Computed final fee after discount (only when user hasn't manually overridden finalFee)
  const computedFinalFee = (() => {
    const cf = Number(form.courseFees) || 0;
    if (form.discountType === "percentage") {
      return cf - (cf * (Number(form.discountValue) || 0) / 100);
    } else if (form.discountType === "flat") {
      return Math.max(0, cf - (Number(form.discountValue) || 0));
    }
    return cf;
  })();

  const handleNameChange = (e) => {
    const val = e.target.value;
    setForm((prev) => ({ ...prev, name: val }));
    if (selectedStudent) { setMatchedInquiryId(null); return; }
    clearTimeout(inquiryTimerRef.current);
    if (!val.trim()) {
      setInquiryResults([]); setShowInquiryDropdown(false); setMatchedInquiryId(null);
      return;
    }
    inquiryTimerRef.current = setTimeout(async () => {
      const results = await searchInquiriesByName(val, selectedBranch?.id, searchAllBranches);
      setInquiryResults(results);
      setShowInquiryDropdown(results.length > 0);
    }, 400);
  };

  const handleSelectInquiry = (inq) => {
    setMatchedInquiryId(inq.id);
    const matchedCourse = courseOptions.find(
      (c) => c.label.toLowerCase() === (inq.courseInterested || "").toLowerCase()
    ) || courseOptions.find(
      (c) => c.label.toLowerCase().includes((inq.courseInterested || "").toLowerCase()) ||
            (inq.courseInterested || "").toLowerCase().includes(c.label.toLowerCase())
    );
    setForm((prev) => ({
      ...prev,
      name: inq.name || "",
      phone: inq.phone || "",
      email: inq.email || prev.email,
      feeNote: inq.notes || prev.feeNote,
      ...(matchedCourse ? {
        course: matchedCourse.id,
        courseType: matchedCourse.label,
        totalClasses: matchedCourse.totalClasses,
        duration: matchedCourse.duration,
        classDuration: matchedCourse.classDuration,
        selectedVehicles: [],
        discountType: "",
        discountValue: 0,
        twoWheelerType: "",
        twoWheelerName: "",
        twoWheelerPrice: 0,
      } : {}),
    }));
    if (matchedCourse) {
      setSelectedCourse(matchedCourse);
      setCourseSearch(matchedCourse.label);
    }
    setShowInquiryDropdown(false);
  };

  const handleClearInquiryMatch = () => {
    setMatchedInquiryId(null);
    setInquiryResults([]);
    setShowInquiryDropdown(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { addNotification("Student name is required", "error"); return; }
    if (!form.phone || form.phone.replace(/\D/g, "").length !== 10) { addNotification("Phone must be exactly 10 digits", "error"); return; }
    if (!form.course) { addNotification("Course selection is required", "error"); return; }
    if (!form.joiningDate) { addNotification("Joining date is required", "error"); return; }
    const effectiveFee = Number(form.finalFee) || computedFinalFee;
    if (Number(form.feesPaid) > effectiveFee) { addNotification("Fees paid cannot exceed final course fees", "error"); return; }
    setSaving(true);
    const cf = effectiveFee;
    const fp = Number(form.feesPaid);
    const pf = cf - fp;
    const inquiryId = matchedInquiryId;
    const payload = {
      ...form,
      courseFees: Number(form.courseFees) || 0,
      finalFee: cf,
      feesPaid: fp,
      pendingFees: pf,
      totalFees: cf,
      remainingFees: pf,
      branchId: selectedBranch?.id || null,
    };
    delete payload.courseType;
    delete payload.matchedInquiryId;
    try {
      let studentId;
      if (selectedStudent) {
        await updateStudent(selectedStudent, payload);
        studentId = selectedStudent;
        addNotification("Student updated");
      } else {
        const saved = await addStudent(payload);
        studentId = saved.id;
        if (inquiryId) {
          await deleteInquiry(inquiryId).catch(() => {});
        }
        addNotification("Student added");
      }
      try {
        const latest = await getStudent(studentId);
        if (latest) await generateInvoicePDF(latest, teachers, selectedBranch?.name);
      } catch { addNotification("Invoice download failed, student was saved", "error"); }
      setForm({ name: "", phone: "", altPhone: "", email: "", permanentAddress: "", temporaryAddress: "", bloodGroup: "", dob: "", llNumber: "", llValidFrom: "", llValidTo: "", dlNumber: "", dlValidTill: "", course: "", joiningDate: "", courseCompletionDate: "", assignedTeacherId: "", batch: "", vehicleType: "", selectedVehicles: [], courseFees: 0, finalFee: 0, feesPaid: 0, pendingFees: 0, discountType: "", discountValue: 0, feeNote: "", batchTime: "", twoWheelerType: "", twoWheelerName: "", twoWheelerPrice: 0, courseType: "", totalClasses: "", duration: "", classDuration: "" });
      setSelectedCourse(null);
      setCourseSearch("");
      setSelectedStudent(null);
      setMatchedInquiryId(null);
      setInquiryResults([]);
      setShowInquiryDropdown(false);
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
      permanentAddress: s.permanentAddress || s.address || "",
      temporaryAddress: s.temporaryAddress || "",
      bloodGroup: s.bloodGroup || "",
      dob: s.dob || "",
      llNumber: s.llNumber || "",
      llValidFrom: s.llValidFrom || "",
      llValidTo: s.llValidTo || "",
      dlNumber: s.dlNumber || "",
      dlValidTill: s.dlValidTill || "",
      course: s.course || "",
      joiningDate: s.joiningDate || "",
      courseCompletionDate: s.courseCompletionDate || "",
      assignedTeacherId: s.assignedTeacherId || "",
      batch: s.batch || "",
      vehicleType: s.vehicleType || "",
      selectedVehicles: s.selectedVehicles || [],
      twoWheelerType: s.twoWheelerType || "",
      twoWheelerName: s.twoWheelerName || "",
      twoWheelerPrice: s.twoWheelerPrice || 0,
      courseFees: s.courseFees || s.totalFees || 0,
      finalFee: s.finalFee || 0,
      feesPaid: s.feesPaid || 0,
      pendingFees: s.pendingFees || s.remainingFees || 0,
      discountType: s.discountType || "",
      discountValue: s.discountValue || 0,
      feeNote: s.feeNote || "",
      batchTime: s.batchTime || "",
      courseType: s.courseType || (course ? course.label : (s.course || "")),
      totalClasses: s.totalClasses || (course ? course.totalClasses : ""),
      duration: s.duration || (course ? course.duration : ""),
      classDuration: s.classDuration || (course ? course.classDuration : ""),
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
      setTeacherForm({ name: "", phone: "", address: "", experience: "", licenseNumber: "", email: "", password: "", status: "active", salary: "", currentPassword: "" });
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
      salary: t.salary || "",
      currentPassword: "",
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

  // ── Reception handlers ──

  const loadReceptionists = useCallback(async () => {
    setReceptionistsLoading(true);
    try {
      const data = await getReceptionists(selectedBranch?.id);
      setReceptionists(data);
    } catch { addNotification("Failed to load receptionists", "error"); }
    setReceptionistsLoading(false);
  }, [addNotification, selectedBranch]);

  useEffect(() => {
    if (["reception", "addReception"].includes(view))
      loadReceptionists();
  }, [view, loadReceptionists]);

  const handleSaveReceptionist = async (e) => {
    e.preventDefault();
    if (!receptionForm.name) {
      addNotification("Name is required", "error");
      return;
    }
    if (!receptionForm.email) {
      addNotification("Email is required", "error");
      return;
    }
    if (!selectedReceptionist && !receptionForm.password) {
      addNotification("Password is required", "error");
      return;
    }
    setSavingReceptionist(true);
    try {
      if (selectedReceptionist) {
        await updateReceptionist(selectedReceptionist, receptionForm);
        addNotification("Receptionist updated");
      } else {
        await addReceptionist({ ...receptionForm, branchId: receptionForm.branchId || null });
        addNotification("Receptionist added");
      }
      setReceptionForm({ name: "", phone: "", address: "", email: "", password: "", salary: "", branchId: "", status: "active", currentPassword: "" });
      setSelectedReceptionist(null);
      setView("reception");
      loadReceptionists();
    } catch (err) {
      addNotification(err.message || "Failed to save receptionist", "error");
    }
    setSavingReceptionist(false);
  };

  const handleEditReceptionist = (id) => {
    const r = receptionists.find((x) => x.id === id);
    if (!r) return;
    setReceptionForm({
      name: r.name || "",
      phone: r.phone || "",
      address: r.address || "",
      email: r.email || "",
      password: "",
      salary: r.salary || "",
      branchId: r.branchId || "",
      status: r.status || "active",
      currentPassword: "",
    });
    setSelectedReceptionist(id);
    setView("addReception");
  };

  const handleViewReceptionist = (id) => {
    const r = receptionists.find((x) => x.id === id);
    if (!r) return;
    setSelectedReceptionist(id);
    setView("viewReception");
  };

  const handleDeleteReceptionist = async (id) => {
    setDeleting(id);
    try {
      await deleteReceptionist(id);
      addNotification("Receptionist deleted");
      loadReceptionists();
    } catch { addNotification("Failed to delete receptionist", "error"); }
    setDeleting(null);
  };

  const handleToggleReceptionStatus = async (id, current) => {
    try {
      const newStatus = await toggleReceptionistStatus(id, current);
      addNotification(`Receptionist ${newStatus === "active" ? "enabled" : "disabled"}`);
      loadReceptionists();
    } catch { addNotification("Failed to update status", "error"); }
  };

  // ── Inquiry handlers ──

  useEffect(() => {
    if (!["inquiries", "addInquiry", "viewInquiry", "dashboard"].includes(view)) return;
    setInquiriesLoading(true);
    const unsub = subscribeInquiries(searchAllBranches ? null : selectedBranch?.id, (data) => {
      setInquiries(data);
      setInquiriesLoading(false);
    });
    return unsub;
  }, [view, selectedBranch, searchAllBranches]);

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

  useEffect(() => {
    if (!selectedBranch?.id || !["dashboard", "complaints"].includes(view)) return;
    const unsub = subscribeComplaints(selectedBranch.id, (data) => {
      setComplaints(data);
      setComplaintsUnread(data.filter((c) => !c.read).length);
    });
    return unsub;
  }, [view, selectedBranch]);

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
    { key: "reception", label: "Reception", icon: Users },
    { key: "complaints", label: "Complaints", icon: MessageCircle },
  ];

  const isTeachersActive = view === "teachers" || view === "addTeacher";
  const isReceptionActive = view === "reception" || view === "addReception" || view === "viewReception";

  return (
    <div className="app-layout">
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-brand">
            <span className="sidebar-logo"><Car size={28} /></span>
            <span>{SCHOOL.name}</span>
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
              className={`sidebar-link ${item.key === "dashboard" && view === "dashboard" ? "active" : ""} ${item.key === "students" && (view === "students" || view === "addStudent" || view === "viewStudent") ? "active" : ""} ${item.key === "teachers" && isTeachersActive ? "active" : ""} ${item.key === "assign" && view === "assign" ? "active" : ""} ${item.key === "inquiries" && (view === "inquiries" || view === "addInquiry" || view === "viewInquiry") ? "active" : ""} ${item.key === "reception" && isReceptionActive ? "active" : ""} ${item.key === "complaints" && view === "complaints" ? "active" : ""}`}
              onClick={() => { setView(item.key); setSidebarOpen(false); }}
              style={{ position: "relative" }}
            >
              <item.icon size={18} />
              {item.label}
              {item.key === "complaints" && complaintsUnread > 0 && (
                <span style={{
                  position: "absolute", right: 12, top: "50%", marginTop: -6,
                  width: 12, height: 12, borderRadius: "50%",
                  background: "#DC2626",
                  boxShadow: "0 0 8px rgba(220,38,38,0.6)",
                  animation: "pulse 2s infinite",
                }} />
              )}
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
            {view === "reception" && "Reception"}
            {view === "addReception" && (selectedReceptionist ? "Edit Receptionist" : "Add Receptionist")}
            {view === "viewReception" && "Receptionist Details"}
            {view === "inquiries" && "Inquiries"}
            {view === "addInquiry" && (selectedInquiry ? "Edit Inquiry" : "Add Inquiry")}
            {view === "viewInquiry" && "Inquiry Details"}
            {view === "complaints" && "Complaints"}
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

              <div className="card">
                <h2>Welcome back, {user?.name || "Owner"}!</h2>
                <p>Manage NEW BHARATIS MOTOR DRIVING SCHOOL from this dashboard.</p>
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

              <LicenseReminderSection branchId={selectedBranch?.id} />

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
                    setForm({ name: "", phone: "", altPhone: "", email: "", permanentAddress: "", temporaryAddress: "", bloodGroup: "", dob: "", llNumber: "", llValidFrom: "", llValidTo: "", dlNumber: "", dlValidTill: "", course: "", joiningDate: "", courseCompletionDate: "", assignedTeacherId: "", batch: "", vehicleType: "", selectedVehicles: [], courseFees: 0, finalFee: 0, feesPaid: 0, pendingFees: 0, discountType: "", discountValue: 0, feeNote: "", batchTime: "", twoWheelerType: "", twoWheelerName: "", twoWheelerPrice: 0, courseType: "", totalClasses: "", duration: "", classDuration: "" });
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
                  {/* 🔽 Pending Fees filter option – shows students with pendingFees > 0 or remainingFees > 0 */}
                  <option value="pending_fees">Pending Fees</option>
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
                                  <button className="btn btn-icon btn-delete" title="Delete" disabled={deleting === s.id} onClick={() => setConfirm({ message: `Delete ${s.name}?`, onConfirm: () => handleDelete(s.id) })}><Trash2 size={18} /></button>
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
                            <button className="btn btn-sm btn-danger" disabled={deleting === s.id}                                         onClick={() => setConfirm({ message: `Delete ${s.name}?`, onConfirm: () => handleDelete(s.id) })}><Trash2 size={16} /> Delete</button>
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
                  {/* ── Section 1: PERSONAL INFORMATION ── */}
                  <div className="form-section">
                    <div className="form-section-header">
                      <User size={20} />
                      <h3>Personal Information</h3>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Student Name *</label>
                        <div className="inquiry-name-wrapper">
                          <input className="form-input" value={form.name} onChange={handleNameChange} placeholder="Full name" />
                          {showInquiryDropdown && inquiryResults.length > 0 && (
                            <div className="inquiry-dropdown" ref={inquiryDropdownRef}>
                              <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--gray-400)", borderBottom: "1px solid var(--gray-200)" }}>
                                <Search size={12} style={{ marginRight: 4 }} /> {searchAllBranches ? "All branches" : "This branch"} — {inquiryResults.length} match{inquiryResults.length !== 1 ? "es" : ""}
                              </div>
                              {inquiryResults.map((inq) => {
                                const branch = branches?.find((b) => b.id === inq.branchId);
                                return (
                                  <div key={inq.id} className="inquiry-dropdown-item" onClick={() => handleSelectInquiry(inq)}>
                                    <div className="inquiry-dropdown-name">
                                      {inq.name}
                                      {inq.courseInterested && <span className="inquiry-badge">{inq.courseInterested}</span>}
                                      {branch && <span className="inquiry-badge" style={{ background: "#E0E7FF", color: "#4338CA" }}>{branch.name}</span>}
                                    </div>
                                    <div className="inquiry-dropdown-detail">{inq.phone} {inq.email ? `· ${inq.email}` : ""}</div>
                                    {inq.notes && <div className="inquiry-dropdown-detail" style={{ fontStyle: "italic" }}>{inq.notes.length > 60 ? inq.notes.slice(0, 60) + "..." : inq.notes}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {matchedInquiryId && (
                          <div style={{ marginTop: 4, fontSize: 12, color: "var(--success)" }}>
                            Auto-filled from inquiry
                            <button type="button" onClick={handleClearInquiryMatch} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>
                              Clear
                            </button>
                          </div>
                        )}
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
                      <div className="form-group">
                        <label>Date of Birth</label>
                        <input className="form-input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Blood Group</label>
                        <select className="form-input" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                          <option value="">— Select —</option>
                          {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((bg) => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                        <label>Permanent Address</label>
                        <textarea className="form-input" rows={2} value={form.permanentAddress} onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })} placeholder="Permanent address" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                        <label>Temporary Address</label>
                        <textarea className="form-input" rows={2} value={form.temporaryAddress} onChange={(e) => setForm({ ...form, temporaryAddress: e.target.value })} placeholder="Temporary / current address" />
                      </div>
                    </div>
                  </div>

                  {/* ── Section 2: LICENSE INFORMATION ── */}
                  <div className="form-section">
                    <div className="form-section-header">
                      <Gauge size={20} />
                      <h3>License Information</h3>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Learning License (LL) No.</label>
                        <input className="form-input" value={form.llNumber} onChange={(e) => setForm({ ...form, llNumber: e.target.value })} placeholder="LL number" />
                      </div>
                      <div className="form-group">
                        <label>Issue Date</label>
                        <input className="form-input" type="date" value={form.llValidFrom} onChange={(e) => {
                          const v = e.target.value;
                          const next = { ...form, llValidFrom: v };
                          if (v && !form.llValidTo) {
                            const d = new Date(v);
                            d.setMonth(d.getMonth() + 6);
                            next.llValidTo = d.toISOString().split("T")[0];
                          }
                          setForm(next);
                        }} />
                      </div>
                      <div className="form-group">
                        <label>LL Valid To</label>
                        <input className="form-input" type="date" value={form.llValidTo} onChange={(e) => setForm({ ...form, llValidTo: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Driving License (DL) No.</label>
                        <input className="form-input" value={form.dlNumber} onChange={(e) => setForm({ ...form, dlNumber: e.target.value })} placeholder="DL number" />
                      </div>
                      <div className="form-group">
                        <label>DL Valid Until</label>
                        <input className="form-input" type="date" value={form.dlValidTill} onChange={(e) => setForm({ ...form, dlValidTill: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  {/* ── Section 3: COURSE INFORMATION ── */}
                  <div className="form-section">
                    <div className="form-section-header">
                      <BookOpen size={20} />
                      <h3>Course Information</h3>
                    </div>
                    <div className="form-group">
                      <label>Select Course *</label>
                      <div className="course-select-wrapper" ref={courseDropdownRef}>
                        <div className="course-input-row">
                          <input
                            className="form-input"
                            value={selectedCourse ? selectedCourse.label : courseSearch}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCourseSearch(val);
                              setSelectedCourse(null);
                              setForm({ ...form, course: val || "", courseType: val || "", selectedVehicles: [], courseFees: 0, twoWheelerType: "", twoWheelerName: "", twoWheelerPrice: 0 });
                              setShowCourseDropdown(true);
                            }}
                            onFocus={() => { setShowCourseDropdown(true); setShowAddCourse(false); }}
                            placeholder="Search or type a custom course..."
                          />
                          <button type="button" className="course-add-btn" title="Add custom course" onClick={() => { setShowAddCourse(!showAddCourse); setShowCourseDropdown(false); setNewCourseName(""); }}>
                            <Plus size={16} />
                          </button>
                        </div>
                        {showAddCourse && (
                          <div className="course-add-bar">
                            <input
                              className="form-input"
                              placeholder="Enter custom course name..."
                              value={newCourseName}
                              onChange={(e) => setNewCourseName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newCourseName.trim()) {
                                  const name = newCourseName.trim();
                                  setForm({ ...form, course: name, courseType: name });
                                  setSelectedCourse({ id: name, label: name, duration: "", totalClasses: "", classDuration: "" });
                                  setCourseSearch(name);
                                  setShowAddCourse(false);
                                }
                              }}
                              autoFocus
                            />
                            <button type="button" className="course-add-confirm" onClick={() => {
                              if (newCourseName.trim()) {
                                const name = newCourseName.trim();
                                setForm({ ...form, course: name, courseType: name });
                                setSelectedCourse({ id: name, label: name, duration: "", totalClasses: "", classDuration: "" });
                                setCourseSearch(name);
                                setShowAddCourse(false);
                              }
                            }}>Add</button>
                          </div>
                        )}
                        {showCourseDropdown && (
                          <div className="course-dropdown">
                            {filteredCourses.length === 0 && !courseSearch.trim() ? (
                              <div className="course-dropdown-empty">No courses found</div>
                            ) : (
                              <>
                                {courseSearch.trim() && filteredCourses.length === 0 && (
                                  <div className="course-dropdown-item" onClick={() => {
                                    setForm({ ...form, course: courseSearch.trim(), courseType: courseSearch.trim() });
                                    setSelectedCourse({ id: courseSearch.trim(), label: courseSearch.trim(), duration: "", totalClasses: "", classDuration: "" });
                                    setShowCourseDropdown(false);
                                  }}>
                                    <div className="course-dropdown-label">Use "{courseSearch}" as custom course</div>
                                  </div>
                                )}
                                {filteredCourses.map((c) => (
                                  <div key={c.id} className="course-dropdown-item" onClick={() => {
                                    setSelectedCourse(c);
                                    setCourseSearch(c.label);
                                    const fp = Number(form.feesPaid) || 0;
                                    setForm({ ...form, course: c.id, courseFees: 0, pendingFees: 0, courseType: c.label, totalClasses: c.totalClasses, duration: c.duration, classDuration: c.classDuration, selectedVehicles: [], discountType: "", discountValue: 0, twoWheelerType: "", twoWheelerName: "", twoWheelerPrice: 0 });
                                    setShowCourseDropdown(false);
                                  }}>
                                    <div className="course-dropdown-label">{c.label}</div>
                                    <div className="course-dropdown-meta">{c.duration} · {c.totalClasses} classes</div>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedCourse && (
                      <>
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
                        {selectedCourse?.label?.startsWith("Two Wheeler") ? (
                          <div className="form-group" style={{ marginTop: 12 }}>
                            <label>Bike Details</label>
                            <div className="form-row" style={{ gap: 8 }}>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label>Type</label>
                                <select className="form-input" value={form.twoWheelerType} onChange={(e) => setForm({ ...form, twoWheelerType: e.target.value })}>
                                  <option value="">— Select —</option>
                                  <option value="Gear">Gear</option>
                                  <option value="Non Gear">Non Gear</option>
                                </select>
                              </div>
                              <div className="form-group" style={{ flex: 2 }}>
                                <label>Bike Name</label>
                                <input className="form-input" value={form.twoWheelerName} onChange={(e) => setForm({ ...form, twoWheelerName: e.target.value })} placeholder="e.g. Splendor" />
                              </div>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label>Bike Price (₹)</label>
                                <input className="form-input" type="number" value={form.twoWheelerPrice} onChange={(e) => {
                                  const p = Math.max(0, Number(e.target.value) || 0);
                                  const fp = Number(form.feesPaid) || 0;
                                  let ff = 0;
                                  if (form.discountType === "percentage") {
                                    ff = p - (p * (Number(form.discountValue) || 0) / 100);
                                  } else if (form.discountType === "flat") {
                                    ff = Math.max(0, p - (Number(form.discountValue) || 0));
                                  }
                                  setForm({ ...form, twoWheelerPrice: p, courseFees: p, finalFee: ff, pendingFees: Math.max(0, (ff || p) - fp) });
                                }} placeholder="4500" min="0" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="form-group" style={{ marginTop: 12 }}>
                              <label>Select Vehicles <span style={{ fontWeight: 400, color: "var(--gray-500)", fontSize: 12 }}>(multi-select)</span></label>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                                {[
                                  { name: "WagonR", id: "wagonr", defaultPrice: 5500, allowExtra: true },
                                  { name: "Brezza", id: "brezza", defaultPrice: 7500 },
                                  { name: "Swift Dzire", id: "swift-dzire", defaultPrice: 6500 },
                                ].map((v) => {
                                  const checked = (form.selectedVehicles || []).some((sv) => sv.id === v.id);
                                  const sv = form.selectedVehicles?.find((x) => x.id === v.id);
                                  const extras = (form.selectedVehicles || []).filter((x) => x.id.startsWith(`${v.id}_extra_`));
                                  const recalc = (next) => {
                                    const totalFee = next.reduce((sum, x) => sum + (Number(x.price) || 0), 0);
                                    const fp = Number(form.feesPaid) || 0;
                                    let ff = 0;
                                    if (form.discountType === "percentage") {
                                      ff = totalFee - (totalFee * (Number(form.discountValue) || 0) / 100);
                                    } else if (form.discountType === "flat") {
                                      ff = Math.max(0, totalFee - (Number(form.discountValue) || 0));
                                    }
                                    setForm({ ...form, selectedVehicles: next, courseFees: totalFee, finalFee: ff, pendingFees: Math.max(0, (ff || totalFee) - fp) });
                                  };
                                  return (
                                    <div key={v.id}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        <label className={`radio-label ${checked ? "active" : ""}`} style={{ padding: "6px 14px", cursor: "pointer" }}>
                                          <input type="checkbox" checked={checked}
                                            onChange={() => {
                                              const prev = form.selectedVehicles || [];
                                              const next = checked
                                                ? prev.filter((x) => x.id !== v.id && !x.id.startsWith(`${v.id}_extra_`))
                                                : [...prev, { id: v.id, name: v.name, price: v.defaultPrice }];
                                              recalc(next);
                                            }}
                                            style={{ marginRight: 6 }}
                                          />
                                          {v.name}
                                        </label>
                                        {checked && (
                                          <input type="number" placeholder="Price"
                                            value={sv?.price ?? ""}
                                            onChange={(e) => {
                                              const p = Math.max(0, Number(e.target.value) || 0);
                                              const updated = (form.selectedVehicles || []).map((x) =>
                                                x.id === v.id || x.id.startsWith(`${v.id}_extra_`) ? { ...x, price: p } : x
                                              );
                                              recalc(updated);
                                            }}
                                            style={{ width: 100, padding: "4px 8px", border: "1px solid var(--gray-300)", borderRadius: 6, fontSize: 13 }}
                                          />
                                        )}
                                      </div>
                                      {checked && v.allowExtra && (
                                        <ExtraCarList
                                          parentId={v.id}
                                          extras={extras}
                                          svPrice={sv?.price ?? v.defaultPrice}
                                          onAdd={(name, price) => {
                                            const newId = `${v.id}_extra_${Date.now()}`;
                                            const updated = [...(form.selectedVehicles || []), { id: newId, name, price }];
                                            recalc(updated);
                                          }}
                                          onRemove={(id) => {
                                            const updated = (form.selectedVehicles || []).filter((x) => x.id !== id);
                                            recalc(updated);
                                          }}
                                          onPriceChange={(id, p) => {
                                            const updated = (form.selectedVehicles || []).map((x) => x.id === id ? { ...x, price: p } : x);
                                            recalc(updated);
                                          }}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                                {/* Custom Car */}
                                <CustomCarSection
                                  onAdd={(name, price) => {
                                    const newId = `custom_${Date.now()}`;
                                    const updated = [...(form.selectedVehicles || []), { id: newId, name, price }];
                                    const totalFee = updated.reduce((sum, x) => sum + (Number(x.price) || 0), 0);
                                    const fp = Number(form.feesPaid) || 0;
                                    let ff = 0;
                                    if (form.discountType === "percentage") {
                                      ff = totalFee - (totalFee * (Number(form.discountValue) || 0) / 100);
                                    } else if (form.discountType === "flat") {
                                      ff = Math.max(0, totalFee - (Number(form.discountValue) || 0));
                                    }
                                    setForm({ ...form, selectedVehicles: updated, courseFees: totalFee, finalFee: ff, pendingFees: Math.max(0, (ff || totalFee) - fp) });
                                  }}
                                  onRemove={(id) => {
                                    const updated = (form.selectedVehicles || []).filter((x) => x.id !== id);
                                    const totalFee = updated.reduce((sum, x) => sum + (Number(x.price) || 0), 0);
                                    const fp = Number(form.feesPaid) || 0;
                                    let ff = 0;
                                    if (form.discountType === "percentage") {
                                      ff = totalFee - (totalFee * (Number(form.discountValue) || 0) / 100);
                                    } else if (form.discountType === "flat") {
                                      ff = Math.max(0, totalFee - (Number(form.discountValue) || 0));
                                    }
                                    setForm({ ...form, selectedVehicles: updated, courseFees: totalFee, finalFee: ff, pendingFees: Math.max(0, (ff || totalFee) - fp) });
                                  }}
                                  onPriceChange={(id, p) => {
                                    const updated = (form.selectedVehicles || []).map((x) => x.id === id ? { ...x, price: p } : x);
                                    const totalFee = updated.reduce((sum, x) => sum + (Number(x.price) || 0), 0);
                                    const fp = Number(form.feesPaid) || 0;
                                    let ff = 0;
                                    if (form.discountType === "percentage") {
                                      ff = totalFee - (totalFee * (Number(form.discountValue) || 0) / 100);
                                    } else if (form.discountType === "flat") {
                                      ff = Math.max(0, totalFee - (Number(form.discountValue) || 0));
                                    }
                                    setForm({ ...form, selectedVehicles: updated, courseFees: totalFee, finalFee: ff, pendingFees: Math.max(0, (ff || totalFee) - fp) });
                                  }}
                                  customVehicles={(form.selectedVehicles || []).filter((x) => x.id.startsWith("custom_"))}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Section 4: ADMISSION INFORMATION ── */}
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
                        <label>Course Completion Date</label>
                        <input className="form-input" type="date" value={form.courseCompletionDate} onChange={(e) => setForm({ ...form, courseCompletionDate: e.target.value })} />
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
                            <input type="radio" name="batch" value="Morning" checked={form.batch === "Morning"} onChange={(e) => { setForm({ ...form, batch: e.target.value, batchTime: "" }); }} /> <Sunrise size={16} /> Morning
                          </label>
                          <label className={`radio-label ${form.batch === "Evening" ? "active" : ""}`}>
                            <input type="radio" name="batch" value="Evening" checked={form.batch === "Evening"} onChange={(e) => { setForm({ ...form, batch: e.target.value, batchTime: "" }); }} /> <Sunset size={16} /> Evening
                          </label>
                        </div>
                      </div>
                      {form.batch && (
                        <div className="form-group">
                          <label>{form.batch} Time Slot</label>
                          <input className="form-input" list="ownerBatchTimeOptions" value={form.batchTime} onChange={(e) => setForm({ ...form, batchTime: e.target.value })} placeholder="Type or select a time slot" />
                          <datalist id="ownerBatchTimeOptions">
                            {(form.batch === "Morning" ? MORNING_SLOTS : EVENING_SLOTS).map((slot) => (
                              <option key={slot} value={slot} />
                            ))}
                          </datalist>
                        </div>
                      )}
                    </div>
                    <div className="form-row fees-row">
                      <div className="form-group">
                        <label>Course Fees (₹)</label>
                        <input className="form-input" type="number" value={form.courseFees} onChange={(e) => {
                          const cf = Math.max(0, Number(e.target.value) || 0);
                          setForm({ ...form, courseFees: cf, pendingFees: Math.max(0, cf - Number(form.feesPaid)) });
                        }} placeholder="Auto-calculated from vehicles" min="0" />
                      </div>
                      <div className="form-group">
                        <label>Discount Type</label>
                        <select className="form-input" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value, discountValue: 0, finalFee: 0 })}>
                          <option value="">No Discount</option>
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Flat Amount (₹)</option>
                        </select>
                      </div>
                      {form.discountType && (
                        <div className="form-group">
                          <label>{form.discountType === "percentage" ? "Discount %" : "Discount ₹"}</label>
                          <input className="form-input" type="number" value={form.discountValue} onChange={(e) => {
                            const dv = Math.max(0, Number(e.target.value) || 0);
                            const cf = Number(form.courseFees) || 0;
                            let computed = cf;
                            if (form.discountType === "percentage") computed = cf - (cf * dv / 100);
                            else if (form.discountType === "flat") computed = Math.max(0, cf - dv);
                            setForm({ ...form, discountValue: dv, finalFee: computed });
                          }} placeholder="0" min="0" />
                        </div>
                      )}
                    </div>
                    {form.discountType && Number(form.finalFee) !== Number(form.courseFees) && (
                      <div className="form-row fees-row">
                        <div className="form-group">
                          <label>Final Fee (after discount)</label>
                          <input className="form-input" type="number" value={form.finalFee} onChange={(e) => {
                            const ff = Math.max(0, Number(e.target.value) || 0);
                            setForm({ ...form, finalFee: ff, pendingFees: Math.max(0, ff - Number(form.feesPaid)) });
                          }} placeholder="Auto-calculated" min="0" />
                        </div>
                      </div>
                    )}
                    <div className="form-row fees-row">
                      <div className="form-group">
                        <label>Fees Paid (₹)</label>
                        <input className="form-input" type="number" value={form.feesPaid} onChange={(e) => {
                          const fp = Math.max(0, Number(e.target.value) || 0);
                          const cf = Number(form.finalFee) || Number(form.courseFees) || 0;
                          if (fp > cf) { addNotification("Fees paid cannot exceed final fees", "error"); return; }
                          setForm({ ...form, feesPaid: fp, pendingFees: cf - fp });
                        }} placeholder="0" min="0" />
                      </div>
                      <div className="form-group">
                        <label>Pending Fees (₹)</label>
                        <input className="form-input" type="number" value={form.pendingFees} readOnly tabIndex={-1} style={{ background: "var(--gray-100)", cursor: "not-allowed", color: Number(form.pendingFees) > 0 ? "var(--danger)" : "var(--success)" }} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                        <label>Fee Note</label>
                        <textarea className="form-input" rows={2} value={form.feeNote} onChange={(e) => setForm({ ...form, feeNote: e.target.value })} placeholder="e.g. Paid in 2 installments, Special discount approved, Pending after LL..." />
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
                  <span className="detail-label">Vehicle</span>
                  <span className="detail-value">
                    {selectedStudent.selectedVehicles?.length
                      ? selectedStudent.selectedVehicles.map((v) => v.name).join(", ")
                      : selectedStudent.twoWheelerName || selectedStudent.vehicleType || "—"}
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
      setTeacherForm({ name: "", phone: "", address: "", experience: "", licenseNumber: "", email: "", password: "", status: "active", salary: "" });
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
                                  <button className="btn btn-icon btn-delete" title="Delete" disabled={deleting === t.id} onClick={() => setConfirm({ message: `Delete teacher ${t.name}? This also removes their login access.`, onConfirm: () => handleDeleteTeacher(t.id) })}><Trash2 size={18} /></button>
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
                          <button className="btn btn-sm btn-danger" disabled={deleting === t.id} onClick={() => setConfirm({ message: `Delete teacher ${t.name}?`, onConfirm: () => handleDeleteTeacher(t.id) })}><Trash2 size={16} /> Delete</button>
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

          {view === "reception" && (
            <div className="card">
              <div className="card-header">
                <h2>All Receptionists</h2>
                <button className="btn btn-primary" onClick={() => {
      setReceptionForm({ name: "", phone: "", address: "", email: "", password: "", salary: "", branchId: "", status: "active", currentPassword: "" });
                  setSelectedReceptionist(null);
                  setView("addReception");
                }}>
                  + Add Receptionist
                </button>
              </div>

              {receptionistsLoading ? (
                <div className="table-loader"><div className="spinner" /></div>
              ) : receptionists.length === 0 ? (
                <div className="empty-state">No receptionists added yet.</div>
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
                            <th>Salary</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receptionists.map((r) => (
                            <tr key={r.id}>
                              <td className="td-name">{r.name}</td>
                              <td>{r.phone || "—"}</td>
                              <td style={{ fontSize: 13, color: "var(--gray-500)" }}>{r.email || "—"}</td>
                              <td>{r.salary ? `₹${Number(r.salary).toLocaleString()}` : "—"}</td>
                              <td>
                                <span className={`badge ${r.status === "active" ? "badge-success" : "badge-danger"}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td>
                                <div className="action-btns">
                                  <button className="btn btn-icon btn-view" title="View" onClick={() => handleViewReceptionist(r.id)}><Eye size={18} /></button>
                                  <button className="btn btn-icon btn-edit" title="Edit" onClick={() => handleEditReceptionist(r.id)}><Pencil size={18} /></button>
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: r.status === "active" ? "var(--warning-bg)" : "var(--success-bg)", color: r.status === "active" ? "#92400e" : "#065f46", border: "none" }}
                                    onClick={() => handleToggleReceptionStatus(r.id, r.status)}
                                  >
                                    {r.status === "active" ? "Disable" : "Enable"}
                                  </button>
                                  <button className="btn btn-icon btn-delete" title="Delete" disabled={deleting === r.id} onClick={() => setConfirm({ message: `Delete receptionist ${r.name}?`, onConfirm: () => handleDeleteReceptionist(r.id) })}><Trash2 size={18} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mobile-cards">
                    {receptionists.map((r) => (
                      <div key={r.id} className="data-card">
                        <div className="data-card-row"><span className="data-card-label"><User size={14} /></span><span className="data-card-value">{r.name}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><Phone size={14} /></span><span className="data-card-value">{r.phone || "—"}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><Mail size={14} /></span><span className="data-card-value">{r.email || "—"}</span></div>
                        <div className="data-card-row"><span className="data-card-label"><Wallet size={14} /></span><span className="data-card-value">{r.salary ? `₹${Number(r.salary).toLocaleString()}` : "—"}</span></div>
                        <div className="data-card-row"><span className="data-card-label">Status</span><span className={`badge ${r.status === "active" ? "badge-success" : "badge-danger"}`}>{r.status}</span></div>
                        <div className="data-card-actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => handleViewReceptionist(r.id)}><Eye size={16} /> View</button>
                          <button className="btn btn-sm btn-primary" onClick={() => handleEditReceptionist(r.id)}><Pencil size={16} /> Edit</button>
                          <button className="btn btn-sm" style={{ background: r.status === "active" ? "var(--warning-bg)" : "var(--success-bg)", color: r.status === "active" ? "#92400e" : "#065f46", border: "none" }} onClick={() => handleToggleReceptionStatus(r.id, r.status)}>
                            {r.status === "active" ? <><CircleOff size={16} /> Disable</> : <><CheckCircle size={16} /> Enable</>}
                          </button>
                          <button className="btn btn-sm btn-danger" disabled={deleting === r.id} onClick={() => setConfirm({ message: `Delete receptionist ${r.name}?`, onConfirm: () => handleDeleteReceptionist(r.id) })}><Trash2 size={16} /> Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "addReception" && (
            <div className="card form-card">
              <h2>{selectedReceptionist ? "Edit Receptionist" : "Add New Receptionist"}</h2>
              <form onSubmit={handleSaveReceptionist}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input className="form-input" value={receptionForm.name} onChange={(e) => setReceptionForm({ ...receptionForm, name: e.target.value })} placeholder="Full name" />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input className="form-input" value={receptionForm.phone} onChange={(e) => setReceptionForm({ ...receptionForm, phone: e.target.value })} placeholder="Phone number" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input className="form-input" type="email" value={receptionForm.email} onChange={(e) => setReceptionForm({ ...receptionForm, email: e.target.value })} placeholder="Email address" />
                  </div>
                  <div className="form-group">
                    <label>Password {selectedReceptionist ? "(leave blank to keep current)" : "*"}</label>
                    <input className="form-input" type="password" value={receptionForm.password} onChange={(e) => setReceptionForm({ ...receptionForm, password: e.target.value })} placeholder={selectedReceptionist ? "New password" : "Password"} />
                  </div>
                  {selectedReceptionist && (
                    <div className="form-group">
                      <label>Current Password (required to change email/password)</label>
                      <input className="form-input" type="password" value={receptionForm.currentPassword} onChange={(e) => setReceptionForm({ ...receptionForm, currentPassword: e.target.value })} placeholder="Current password" />
                    </div>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Branch</label>
                    <select className="form-input" value={receptionForm.branchId} onChange={(e) => setReceptionForm({ ...receptionForm, branchId: e.target.value })}>
                      <option value="">— Select Branch —</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Salary (₹)</label>
                    <input className="form-input" type="number" value={receptionForm.salary} onChange={(e) => setReceptionForm({ ...receptionForm, salary: e.target.value })} placeholder="e.g. 15000" min="0" />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select className="form-input" value={receptionForm.status} onChange={(e) => setReceptionForm({ ...receptionForm, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Address</label>
                    <input className="form-input" value={receptionForm.address} onChange={(e) => setReceptionForm({ ...receptionForm, address: e.target.value })} placeholder="Address" />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={savingReceptionist}>
                    {savingReceptionist ? "Saving..." : selectedReceptionist ? "Update Receptionist" : "Add Receptionist"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setView("reception")}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {view === "viewReception" && (() => {
            const r = receptionists.find((x) => x.id === selectedReceptionist);
            if (!r) return null;
            return (
              <div className="card">
                <div className="card-header">
                  <h2>{r.name}</h2>
                  <div className="action-btns">
                    <button className="btn btn-secondary" onClick={() => { setView("reception"); setSelectedReceptionist(null); }}>
                      Back
                    </button>
                    <button className="btn btn-primary" onClick={() => handleEditReceptionist(r.id)}>
                      Edit
                    </button>
                  </div>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name</span>
                    <span className="detail-value">{r.name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{r.phone || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{r.email || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">{r.address || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Branch</span>
                    <span className="detail-value">{branches.find((b) => b.id === r.branchId)?.name || "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Salary</span>
                    <span className="detail-value">{r.salary ? `₹${Number(r.salary).toLocaleString()}` : "—"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className={`badge ${r.status === "active" ? "badge-success" : "badge-danger"}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

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
                  {selectedTeacher && (
                    <div className="form-group">
                      <label>Current Password (required to change email/password)</label>
                      <input type="password" value={teacherForm.currentPassword} onChange={(e) => setTeacherForm({ ...teacherForm, currentPassword: e.target.value })} placeholder="Current password" />
                    </div>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Salary (₹)</label>
                    <input type="number" className="form-input" value={teacherForm.salary} onChange={(e) => setTeacherForm({ ...teacherForm, salary: e.target.value })} placeholder="e.g. 25000" min="0" />
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
          {view === "complaints" && (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MessageCircle size={20} style={{ color: "var(--primary)" }} />
                <h3 style={{ margin: 0 }}>Client Complaints</h3>
                {complaintsUnread > 0 && (
                  <span className="badge badge-danger">{complaintsUnread} unread</span>
                )}
              </div>
              {complaints.length === 0 ? (
                <p style={{ color: "var(--gray-500)", padding: "24px 0", textAlign: "center" }}>No complaints yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {complaints.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: 16, borderRadius: 8,
                        border: "1px solid var(--gray-200)",
                        background: c.read ? "#fff" : "#FEF2F2",
                        borderLeft: c.read ? "4px solid var(--gray-300)" : "4px solid #DC2626",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <strong style={{ fontSize: 15 }}>{c.studentName}</strong>
                          <span style={{ fontSize: 12, color: "var(--gray-500)", marginLeft: 8 }}>
                            ({c.studentId})
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--gray-500)" }}>
                            {c.createdAt?.toDate?.()?.toLocaleDateString() || ""}
                          </span>
                              {!c.read && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={async () => { await markComplaintRead(c.id); }}
                              style={{ fontSize: 11, padding: "2px 8px" }}
                            >Mark Read</button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <span className="badge" style={{ background: "#E0E7FF", color: "#4338CA" }}>
                          Regarding: {c.targetType}
                        </span>
                        <span className="badge" style={{ background: "#FEF3C7", color: "#B45309" }}>
                          {c.targetName}
                        </span>
                      </div>
                      <p style={{ fontSize: 14, color: "var(--gray-700)", margin: 0, whiteSpace: "pre-wrap" }}>
                        {c.message}
                      </p>
                    </div>
                  ))}
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

function ExtraCarList({ extras, svPrice, onAdd, onRemove, onPriceChange }) {
  const [input, setInput] = useState("");
  return (
    <div style={{ marginLeft: 32, marginTop: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input className="form-input" type="text" placeholder="Add car name at same price"
          value={input} onChange={(e) => setInput(e.target.value)}
          style={{ width: 200, padding: "4px 8px", fontSize: 13 }}
        />
        <button type="button" className="btn btn-sm btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}
          onClick={() => {
            if (!input.trim()) return;
            onAdd(input.trim(), svPrice);
            setInput("");
          }}
        >+ Add</button>
      </div>
      {extras.map((extra) => (
        <div key={extra.id} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 13, minWidth: 120 }}>• {extra.name}</span>
          <input type="number" placeholder="Price"
            value={extra.price ?? ""}
            onChange={(e) => onPriceChange(extra.id, Math.max(0, Number(e.target.value) || 0))}
            style={{ width: 80, padding: "2px 6px", border: "1px solid var(--gray-300)", borderRadius: 4, fontSize: 12 }}
          />
          <button type="button" className="btn btn-sm btn-secondary" style={{ padding: "2px 6px", fontSize: 11, lineHeight: "1.2" }}
            onClick={() => onRemove(extra.id)}
          >✕</button>
        </div>
      ))}
    </div>
  );
}

function CustomCarSection({ onAdd, onRemove, onPriceChange, customVehicles }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  return (
    <div style={{ borderTop: "1px solid var(--gray-200)", paddingTop: 10 }}>
      <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: "block" }}>Custom Car</label>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input className="form-input" type="text" placeholder="Car name"
          value={name} onChange={(e) => setName(e.target.value)}
          style={{ width: 160, padding: "4px 8px", fontSize: 13 }}
        />
        <input className="form-input" type="number" placeholder="Price"
          value={price || ""}
          onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
          style={{ width: 100, padding: "4px 8px", fontSize: 13 }}
        />
        <button type="button" className="btn btn-sm btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}
          onClick={() => {
            if (!name.trim()) return;
            onAdd(name.trim(), price || 0);
            setName("");
            setPrice(0);
          }}
        >Add Car</button>
      </div>
      {customVehicles.map((cc) => (
        <div key={cc.id} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 13, minWidth: 120 }}>• {cc.name}</span>
          <input type="number" placeholder="Price"
            value={cc.price ?? ""}
            onChange={(e) => onPriceChange(cc.id, Math.max(0, Number(e.target.value) || 0))}
            style={{ width: 80, padding: "2px 6px", border: "1px solid var(--gray-300)", borderRadius: 4, fontSize: 12 }}
          />
          <button type="button" className="btn btn-sm btn-secondary" style={{ padding: "2px 6px", fontSize: 11, lineHeight: "1.2" }}
            onClick={() => onRemove(cc.id)}
          >✕</button>
        </div>
      ))}
    </div>
  );
}
