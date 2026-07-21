import { useState, useEffect, useRef, useMemo } from "react";
import {
  User, BookOpen, Clock, Calendar, Gauge, Sunrise, Sunset, ClipboardList, Search,
} from "lucide-react";
import { SCHOOL } from "../config/schoolConfig";
import { searchInquiriesByName } from "../services/inquiryService";

export default function StudentForm({ initialData, branchId, teachers, onSave, onCancel, saving }) {
  const courseOptions = SCHOOL.courses;
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
    courseType: "", totalClasses: "", duration: "", classDuration: "",
  });
  const [courseSearch, setCourseSearch] = useState("");
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const courseDropdownRef = useRef(null);

  const [matchedInquiryId, setMatchedInquiryId] = useState(null);
  const [inquiryResults, setInquiryResults] = useState([]);
  const [showInquiryDropdown, setShowInquiryDropdown] = useState(false);
  const inquiryTimerRef = useRef(null);
  const inquiryDropdownRef = useRef(null);

  const filteredCourses = useMemo(
    () => courseOptions.filter((c) => c.label.toLowerCase().includes(courseSearch.toLowerCase())),
    [courseSearch]
  );

  useEffect(() => {
    if (initialData) {
      const course = courseOptions.find((c) => c.id === initialData.course) || null;
      setForm({
        name: initialData.name || "",
        phone: initialData.phone || "",
        altPhone: initialData.altPhone || "",
        email: initialData.email || "",
        permanentAddress: initialData.permanentAddress || initialData.address || "",
        temporaryAddress: initialData.temporaryAddress || "",
        bloodGroup: initialData.bloodGroup || "",
        dob: initialData.dob || "",
        llNumber: initialData.llNumber || "",
        llValidFrom: initialData.llValidFrom || "",
        llValidTo: initialData.llValidTo || "",
        dlNumber: initialData.dlNumber || "",
        dlValidTill: initialData.dlValidTill || "",
        course: initialData.course || "",
        joiningDate: initialData.joiningDate || "",
        courseCompletionDate: initialData.courseCompletionDate || "",
        assignedTeacherId: initialData.assignedTeacherId || "",
        batch: initialData.batch || "",
        vehicleType: initialData.vehicleType || "",
        selectedVehicles: initialData.selectedVehicles || [],
        twoWheelerType: initialData.twoWheelerType || "",
        twoWheelerName: initialData.twoWheelerName || "",
        twoWheelerPrice: initialData.twoWheelerPrice || 0,
        courseFees: initialData.courseFees || initialData.totalFees || 0,
        finalFee: initialData.finalFee || 0,
        feesPaid: initialData.feesPaid || 0,
        pendingFees: initialData.pendingFees || initialData.remainingFees || 0,
        discountType: initialData.discountType || "",
        discountValue: initialData.discountValue || 0,
        feeNote: initialData.feeNote || "",
        batchTime: initialData.batchTime || "",
        courseType: course ? course.label : (initialData.course || ""),
        totalClasses: course ? course.totalClasses : (initialData.totalClasses || ""),
        duration: course ? course.duration : (initialData.duration || ""),
        classDuration: course ? course.classDuration : (initialData.classDuration || ""),
      });
      setSelectedCourse(course);
      setCourseSearch(course ? course.label : "");
    }
  }, [initialData]);

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

  const handleNameChange = (e) => {
    const val = e.target.value;
    setForm((prev) => ({ ...prev, name: val }));
    if (initialData) { setMatchedInquiryId(null); return; }
    clearTimeout(inquiryTimerRef.current);
    if (!val.trim() || !branchId) {
      setInquiryResults([]); setShowInquiryDropdown(false); setMatchedInquiryId(null);
      return;
    }
    inquiryTimerRef.current = setTimeout(async () => {
      const results = await searchInquiriesByName(val, branchId);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      courseFees: Number(form.courseFees) || 0,
      finalFee: Number(form.finalFee) || Number(form.courseFees) || 0,
      feesPaid: Number(form.feesPaid) || 0,
      pendingFees: (Number(form.finalFee) || Number(form.courseFees) || 0) - (Number(form.feesPaid) || 0),
      totalFees: Number(form.finalFee) || Number(form.courseFees) || 0,
      remainingFees: (Number(form.finalFee) || Number(form.courseFees) || 0) - (Number(form.feesPaid) || 0),
      branchId: branchId || null,
      matchedInquiryId,
    };
    delete payload.courseType; delete payload.totalClasses; delete payload.duration; delete payload.classDuration;
    onSave(payload);
  };

  const handleClearInquiryMatch = () => {
    setMatchedInquiryId(null);
    setInquiryResults([]);
    setShowInquiryDropdown(false);
  };

  const computedFinalFee = (() => {
    const cf = Number(form.courseFees) || 0;
    if (form.discountType === "percentage") return cf - (cf * (Number(form.discountValue) || 0) / 100);
    if (form.discountType === "flat") return Math.max(0, cf - (Number(form.discountValue) || 0));
    return cf;
  })();

  return (
    <div className="card form-card">
      <h2>{initialData ? "Edit Student" : "Add New Student"}</h2>
      <form onSubmit={handleSubmit} className="student-form">
        <div className="form-sections">
          {/* Section 1: PERSONAL INFORMATION */}
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
                        <Search size={12} style={{ marginRight: 4 }} /> Matching inquiries
                      </div>
                      {inquiryResults.map((inq) => (
                        <div key={inq.id} className="inquiry-dropdown-item" onClick={() => handleSelectInquiry(inq)}>
                          <div className="inquiry-dropdown-name">
                            {inq.name}
                            {inq.courseInterested && <span className="inquiry-badge">{inq.courseInterested}</span>}
                          </div>
                          <div className="inquiry-dropdown-detail">{inq.phone} {inq.email ? `· ${inq.email}` : ""}</div>
                        </div>
                      ))}
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

          {/* Section 2: LICENSE INFORMATION */}
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

          {/* Section 3: COURSE INFORMATION */}
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
                  onChange={(e) => { setCourseSearch(e.target.value); setSelectedCourse(null); setForm({ ...form, course: "", selectedVehicles: [], courseFees: 0, twoWheelerType: "", twoWheelerName: "", twoWheelerPrice: 0 }); setShowCourseDropdown(true); }}
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
                          setForm({ ...form, course: c.id, courseFees: 0, pendingFees: 0, courseType: c.label, totalClasses: c.totalClasses, duration: c.duration, classDuration: c.classDuration, selectedVehicles: [], discountType: "", discountValue: 0, twoWheelerType: "", twoWheelerName: "", twoWheelerPrice: 0 });
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

          {/* Section 4: ADMISSION INFORMATION */}
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
                  <select className="form-input" value={form.batchTime} onChange={(e) => setForm({ ...form, batchTime: e.target.value })}>
                    <option value="">— Select time —</option>
                    {(form.batch === "Morning"
                      ? ["06:00 AM – 06:30 AM","06:30 AM – 07:00 AM","07:00 AM – 07:30 AM","07:30 AM – 08:00 AM","08:00 AM – 08:30 AM","08:30 AM – 09:00 AM","09:00 AM – 09:30 AM","09:30 AM – 10:00 AM","10:00 AM – 10:30 AM","10:30 AM – 11:00 AM","11:00 AM – 11:30 AM","11:30 AM – 12:00 PM","12:00 PM – 12:30 PM","12:30 PM – 01:00 PM"]
                      : ["04:00 PM – 04:30 PM","04:30 PM – 05:00 PM","05:00 PM – 05:30 PM","05:30 PM – 06:00 PM","06:00 PM – 06:30 PM","06:30 PM – 07:00 PM","07:00 PM – 07:30 PM","07:30 PM – 08:00 PM","08:00 PM – 08:30 PM","08:30 PM – 09:00 PM","09:00 PM – 09:30 PM"]
                    ).map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
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
            {saving ? <><span className="spinner-sm" /> Saving...</> : initialData ? "Update Student" : "Add Student"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
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
