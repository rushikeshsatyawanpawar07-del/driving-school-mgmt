import {
  collection, addDoc, getDocs, getDoc, setDoc, query, where, updateDoc, doc,
  writeBatch, serverTimestamp, limit
} from "firebase/firestore";
import { db } from "../firebase";
import { TRAINING_DAYS, getCourseTotalClasses } from "../config/schoolConfig";

const REMINDERS = "licenseReminders";

export async function generateStudentReminders(student) {
  if (!student?.id) return;

  const batch = writeBatch(db);

  const existing = await getDocs(
    query(collection(db, REMINDERS), where("studentId", "==", student.id))
  );
  existing.docs.forEach((d) => batch.delete(d.ref));

  if (student.llValidFrom) {
    const issueDate = new Date(student.llValidFrom);
    const applyReminder = new Date(issueDate);
    applyReminder.setDate(applyReminder.getDate() + 30);
    const ref = doc(collection(db, REMINDERS));
    batch.set(ref, {
      studentId: student.id,
      studentName: student.name || "",
      studentPhone: student.phone || "",
      reminderType: "ll_apply_permanent",
      reminderDate: applyReminder.toISOString().split("T")[0],
      message: "Student is now eligible to apply for Permanent Driving License. Please contact the student.",
      status: "pending",
      branchId: student.branchId || null,
      createdAt: serverTimestamp(),
    });
  }

  if (student.llValidTo) {
    const validTill = new Date(student.llValidTo);
    const expiringSoon = new Date(validTill);
    expiringSoon.setDate(expiringSoon.getDate() - 30);
    const ref1 = doc(collection(db, REMINDERS));
    batch.set(ref1, {
      studentId: student.id,
      studentName: student.name || "",
      studentPhone: student.phone || "",
      reminderType: "ll_expiring_soon",
      reminderDate: expiringSoon.toISOString().split("T")[0],
      message: "Learning License will expire in one month. Please schedule the Driving Test and apply for Permanent License.",
      status: "pending",
      branchId: student.branchId || null,
      createdAt: serverTimestamp(),
    });

    const ref2 = doc(collection(db, REMINDERS));
    batch.set(ref2, {
      studentId: student.id,
      studentName: student.name || "",
      studentPhone: student.phone || "",
      reminderType: "ll_expires_today",
      reminderDate: student.llValidTo,
      message: "Learning License expires today. Please contact the student immediately.",
      status: "pending",
      branchId: student.branchId || null,
      createdAt: serverTimestamp(),
    });
  }

  if (student.dlNumber && student.dlValidTill) {
    const ref = doc(collection(db, REMINDERS));
    batch.set(ref, {
      studentId: student.id,
      studentName: student.name || "",
      studentPhone: student.phone || "",
      reminderType: "dl_renewal",
      reminderDate: student.dlValidTill,
      message: "Driving License expires today. Contact the student for DL Renewal.",
      status: "pending",
      branchId: student.branchId || null,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function getPendingReminders(branchId) {
  const today = new Date().toISOString().split("T")[0];
  let constraints = [
    where("reminderDate", "<=", today),
    where("status", "==", "pending"),
  ];
  if (branchId) {
    constraints = [
      where("branchId", "==", branchId),
      where("reminderDate", "<=", today),
      where("status", "==", "pending"),
    ];
  }
  const snap = await getDocs(query(collection(db, REMINDERS), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllReminders(studentId) {
  if (!studentId) return [];
  const snap = await getDocs(
    query(collection(db, REMINDERS), where("studentId", "==", studentId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateReminderStatus(id, status) {
  await updateDoc(doc(db, REMINDERS, id), { status });
}

export async function checkCourseCompletion(studentId) {
  if (!studentId) return;
  const snap = await getDoc(doc(db, "students", studentId));
  if (!snap.exists()) return;
  const s = { id: snap.id, ...snap.data() };
  const totalClasses = getCourseTotalClasses(s.courseId);
  if (s.trainingProgress == null || Number(s.trainingProgress) < totalClasses) return;

  const existing = await getDocs(query(
    collection(db, REMINDERS),
    where("studentId", "==", studentId)
  ));
  if (existing.docs.some((d) => d.data().reminderType === "course_completed" && d.data().status === "pending")) return;

  const ref = doc(collection(db, REMINDERS));
  await setDoc(ref, {
    studentId: studentId,
    studentName: s.name || "",
    studentPhone: s.phone || "",
    reminderType: "course_completed",
    reminderDate: new Date().toISOString().split("T")[0],
    message: `Student has completed ${totalClasses}/${totalClasses} training days. Contact student for further license procedure.`,
    status: "pending",
    branchId: s.branchId || null,
    createdAt: serverTimestamp(),
  });
}

export async function generateAllStudentReminders(branchId) {
  const studentsSnap = await getDocs(query(
    collection(db, "students"),
    where("branchId", "==", branchId || "__none__"),
    limit(500)
  ));
  const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  for (const student of students) {
    if (student.llValidFrom || student.llValidTo || (student.dlNumber && student.dlValidTill)) {
      try {
        await generateStudentReminders(student);
      } catch (e) { console.error("Failed to generate reminders for", student.id, e); }
    }
    try {
      await checkCourseCompletion(student.id);
    } catch (e) { console.error("Failed to check completion for", student.id, e); }
  }
  return students.length;
}
