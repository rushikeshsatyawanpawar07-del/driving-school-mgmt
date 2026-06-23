import {
  collection, addDoc, getDocs, query, where,
  getDoc, doc, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const ATTENDANCE = "attendance";
const STUDENTS = "students";

export async function markAttendance(studentId, date, present) {
  const q = query(
    collection(db, ATTENDANCE),
    where("studentId", "==", studentId),
    where("date", "==", date)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    await addDoc(collection(db, ATTENDANCE), {
      studentId,
      date,
      present,
      createdAt: serverTimestamp(),
    });
  } else {
    const attDoc = snap.docs[0];
    await updateDoc(doc(db, ATTENDANCE, attDoc.id), { present });
  }

  const studentSnap = await getDoc(doc(db, STUDENTS, studentId));
  if (studentSnap.exists()) {
    const allAtt = query(collection(db, ATTENDANCE), where("studentId", "==", studentId));
    const allSnap = await getDocs(allAtt);
    const presentDays = allSnap.docs.filter((d) => d.data().present === true).length;
    await updateDoc(doc(db, STUDENTS, studentId), { attendanceDays: presentDays });
  }
}

export async function getAttendance(studentId) {
  const q = query(
    collection(db, ATTENDANCE),
    where("studentId", "==", studentId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAttendanceForDate(studentId, date) {
  const q = query(
    collection(db, ATTENDANCE),
    where("studentId", "==", studentId),
    where("date", "==", date)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}
