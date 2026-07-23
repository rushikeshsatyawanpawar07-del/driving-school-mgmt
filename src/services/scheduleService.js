import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const SCHEDULES = "schedules";

export async function getSchedulesByDate(branchId, date) {
  const q = query(
    collection(db, SCHEDULES),
    where("branchId", "==", branchId),
    where("date", "==", date)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSchedulesForStudent(studentId, date) {
  const q = query(
    collection(db, SCHEDULES),
    where("studentId", "==", studentId),
    where("date", "==", date)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function saveSchedules(schedules, branchId, date) {
  const existingSnap = await getDocs(
    query(collection(db, SCHEDULES), where("branchId", "==", branchId), where("date", "==", date))
  );
  const existingMap = {};
  existingSnap.docs.forEach((d) => { existingMap[d.data().studentId] = d.id; });

  const batch = writeBatch(db);

  for (const s of schedules) {
    const data = {
      studentId: s.studentId,
      studentName: s.studentName,
      branchId,
      date,
      time: s.time || "",
      session: s.session || "",
      updatedAt: serverTimestamp(),
    };

    if (existingMap[s.studentId]) {
      batch.set(doc(db, SCHEDULES, existingMap[s.studentId]), data, { merge: true });
    } else {
      const ref = doc(collection(db, SCHEDULES));
      batch.set(ref, { ...data, createdAt: serverTimestamp() });
    }
  }

  await batch.commit();
}
