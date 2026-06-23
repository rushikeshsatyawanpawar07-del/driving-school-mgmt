import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, getDoc, query, orderBy, where, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const STUDENTS = "students";

export async function getStudents() {
  const q = query(collection(db, STUDENTS), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getStudentsByTeacher(teacherUid) {
  const q = query(
    collection(db, STUDENTS),
    where("assignedTeacherId", "==", teacherUid)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function getStudent(id) {
  const snap = await getDoc(doc(db, STUDENTS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addStudent(data) {
  const docRef = await addDoc(collection(db, STUDENTS), {
    name: data.name,
    phone: data.phone,
    altPhone: data.altPhone || "",
    email: data.email || "",
    address: data.address || "",
    course: data.course,
    joiningDate: data.joiningDate,
    courseFees: Number(data.courseFees),
    feesPaid: Number(data.feesPaid),
    pendingFees: Number(data.pendingFees),
    totalFees: Number(data.totalFees),
    remainingFees: Number(data.remainingFees),
    attendanceDays: 0,
    status: "active",
    assignedTeacherId: data.assignedTeacherId || null,
    batch: data.batch || "",
    vehicleType: data.vehicleType || "",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateStudent(id, data) {
  await updateDoc(doc(db, STUDENTS, id), data);
}

export async function deleteStudent(id) {
  await deleteDoc(doc(db, STUDENTS, id));
}

export async function recordPayment(id, amount) {
  const student = await getStudent(id);
  if (!student) throw new Error("Student not found");
  const feesPaid = student.feesPaid + Number(amount);
  const remainingFees = student.totalFees - feesPaid;
  await updateDoc(doc(db, STUDENTS, id), {
    feesPaid,
    remainingFees,
    status: remainingFees <= 0 ? "active" : student.status,
  });
}

export async function assignStudentToTeacher(studentId, teacherId) {
  await updateDoc(doc(db, STUDENTS, studentId), { assignedTeacherId: teacherId || null });
}
