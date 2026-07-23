import { TRAINING_DAYS, VALIDITY_DAYS, getCourseTotalClasses } from "../config/schoolConfig";
import { checkCourseCompletion } from "./licenseReminderService";
import { db } from "../firebase";
import { doc, getDoc, getDocs, updateDoc, addDoc, collection, query, where, serverTimestamp } from "firebase/firestore";

const ATTENDANCE = "attendance";
const STUDENTS = "students";

export function isMonday(dateStr) {
  return new Date(dateStr + "T00:00:00").getDay() === 1;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function computeStatus(student) {
  const progress = Number(student.trainingProgress) || 0;
  const maxDate = student.maximumValidDate;
  const today = new Date().toISOString().split("T")[0];
  const totalClasses = getCourseTotalClasses(student.course, student.totalClasses);

  if (!student.trainingStartDate) return "not_started";
  if (progress >= totalClasses) return "completed";
  if (today > maxDate) return "expired";
  return "active";
}

export async function startTraining(studentId, startDate) {
  const maxDate = addDays(startDate, VALIDITY_DAYS);
  await updateDoc(doc(db, STUDENTS, studentId), {
    trainingStartDate: startDate,
    maximumValidDate: maxDate,
    trainingProgress: 0,
    trainingStatus: "active",
  });
}

export async function markAttendance(studentId, date, present, branchId) {
  if (isMonday(date)) throw new Error("Mondays are holidays. Cannot mark attendance.");

  const studentSnap = await getDoc(doc(db, STUDENTS, studentId));
  if (!studentSnap.exists()) throw new Error("Student not found");
  const student = studentSnap.data();

  if (!student.trainingStartDate) throw new Error("Training has not started yet.");

  const totalClasses = getCourseTotalClasses(student.course, student.totalClasses);
  const status = computeStatus(student);
  if (status === "completed") throw new Error("Course already completed.");
  if (status === "expired") throw new Error("Training validity expired. Penalty required.");

  const q = query(
    collection(db, ATTENDANCE),
    where("studentId", "==", studentId)
  );
  const snap = await getDocs(q);
  const todaysRecord = snap.docs.find((d) => d.data().date === date);

  if (todaysRecord) {
    await updateDoc(doc(db, ATTENDANCE, todaysRecord.id), { present, branchId: branchId || null });
  } else {
    await addDoc(collection(db, ATTENDANCE), {
      studentId, date, present, branchId: branchId || null, clientAuthUid: student.clientAuthUid || null,
      createdAt: serverTimestamp(),
    });
  }

  let presentDays;
  if (todaysRecord) {
    presentDays = snap.docs.filter((d) => {
      if (d.id === todaysRecord.id) return present;
      return d.data().present === true;
    }).length;
  } else {
    presentDays = snap.docs.filter((d) => d.data().present === true).length + (present ? 1 : 0);
  }

  const newProgress = Math.min(presentDays, totalClasses);
  const newStatus = newProgress >= totalClasses ? "completed" : computeStatus({ ...student, trainingProgress: newProgress });

  await updateDoc(doc(db, STUDENTS, studentId), {
    trainingProgress: newProgress,
    trainingStatus: newStatus,
  });

  checkCourseCompletion(studentId).catch(() => {});
}

export async function getAttendance(studentId, branchId) {
  const q = query(
    collection(db, ATTENDANCE),
    where("studentId", "==", studentId),
    where("branchId", "==", branchId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAttendanceForDate(studentId, date, branchId) {
  const q = query(
    collection(db, ATTENDANCE),
    where("studentId", "==", studentId),
    where("date", "==", date),
    where("branchId", "==", branchId)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function migrateAttendanceClientAuth() {
  const snap = await getDocs(collection(db, ATTENDANCE));
  const batch = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.clientAuthUid) continue;
    if (!data.studentId) continue;
    try {
      const studentSnap = await getDoc(doc(db, STUDENTS, data.studentId));
      if (studentSnap.exists() && studentSnap.data().clientAuthUid) {
        batch.push(
          updateDoc(doc(db, ATTENDANCE, docSnap.id), { clientAuthUid: studentSnap.data().clientAuthUid })
        );
      }
    } catch { /* skip */ }
  }
  await Promise.all(batch);
}
