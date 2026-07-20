import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, getDoc, query, orderBy, where, serverTimestamp, onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

const INQUIRIES = "inquiries";

export function subscribeInquiries(branchId, callback) {
  function buildQuery(withBranch) {
    if (withBranch && branchId) {
      return query(collection(db, INQUIRIES), where("branchId", "==", branchId), orderBy("createdAt", "desc"));
    }
    return query(collection(db, INQUIRIES), orderBy("createdAt", "desc"));
  }
  const q = buildQuery(true);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, async () => {
    if (branchId) {
      try {
        const snap = await getDocs(buildQuery(false));
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch { callback([]); }
    } else {
      callback([]);
    }
  });
}

export async function getInquiries(branchId) {
  let constraints = [orderBy("createdAt", "desc")];
  if (branchId) constraints = [where("branchId", "==", branchId), orderBy("createdAt", "desc")];
  try {
    const snap = await getDocs(query(collection(db, INQUIRIES), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function getInquiry(id) {
  const snap = await getDoc(doc(db, INQUIRIES, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function searchInquiriesByName(name, branchId) {
  if (!name || !branchId) return [];
  const q = query(
    collection(db, INQUIRIES),
    where("branchId", "==", branchId)
  );
  const snap = await getDocs(q);
  const inquiries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const search = name.toLowerCase().trim();
  return inquiries.filter(
    (inq) => inq.name && inq.name.toLowerCase().includes(search)
  );
}

export async function addInquiry(data) {
  const inquiryDate = data.inquiryDate || new Date().toISOString().split("T")[0];
  const docRef = await addDoc(collection(db, INQUIRIES), {
    name: data.name,
    phone: data.phone,
    email: data.email || "",
    courseInterested: data.courseInterested || "",
    inquiryDate,
    notes: data.notes || "",
    branchId: data.branchId || null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateInquiry(id, data) {
  await updateDoc(doc(db, INQUIRIES, id), { ...data });
}

export async function deleteInquiry(id) {
  await deleteDoc(doc(db, INQUIRIES, id));
}

export async function markFollowUpSent(id) {
  await updateDoc(doc(db, INQUIRIES, id), { lastFollowUpSent: serverTimestamp() });
}

export async function checkFollowUps(inquiries) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return inquiries.filter((inq) => {
    if (!inq.inquiryDate) return false;
    const d = new Date(inq.inquiryDate);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    if (diff < 7) return false;
    if (inq.lastFollowUpSent) {
      const sent = inq.lastFollowUpSent.toDate ? inq.lastFollowUpSent.toDate() : new Date(inq.lastFollowUpSent);
      sent.setHours(0, 0, 0, 0);
      const daysSinceSent = Math.floor((today - sent) / (1000 * 60 * 60 * 24));
      if (daysSinceSent < 7) return false;
    }
    return true;
  });
}
