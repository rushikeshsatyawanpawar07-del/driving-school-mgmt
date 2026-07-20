import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export async function addComplaint({ branchId, clientId, studentName, studentId, targetType, targetName, message }) {
  const docRef = await addDoc(collection(db, "complaints"), {
    branchId,
    clientId,
    studentName,
    studentId,
    targetType,
    targetName,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeComplaints(branchId, callback) {
  const q = query(collection(db, "complaints"), where("branchId", "==", branchId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function getComplaints(branchId) {
  const q = query(collection(db, "complaints"), where("branchId", "==", branchId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function markComplaintRead(id) {
  await updateDoc(doc(db, "complaints", id), { read: true });
}
