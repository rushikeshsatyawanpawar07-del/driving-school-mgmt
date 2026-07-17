import {
  collection, updateDoc, deleteDoc, doc,
  getDocs, getDoc, query, orderBy, where, setDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const TEACHERS = "teachers";
const USERS = "user";
const API_KEY = "AIzaSyC2TuLS8tZv-7n_1K23-2RlGBGojXf52ik";

async function createAuthUser(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { uid: data.localId, email: data.email };
}

async function signInAsTeacher(email, storedPassword, newPassword) {
  const passwordsToTry = [...new Set([storedPassword, newPassword].filter(Boolean))];
  let lastError = null;
  for (const pw of passwordsToTry) {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw, returnSecureToken: true }),
      }
    );
    const d = await r.json();
    if (!d.error) return d.idToken;
    lastError = d.error.message;
  }
  throw new Error(lastError || "Could not sign in");
}

async function updateAuthAccount(idToken, newEmail, newPassword) {
  const body = { idToken, returnSecureToken: true };
  if (newEmail) body.email = newEmail;
  if (newPassword) body.password = newPassword;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
}

export async function getTeachers(branchId) {
  let constraints = [orderBy("name")];
  if (branchId) constraints = [where("branchId", "==", branchId), orderBy("name")];
  try {
    const snap = await getDocs(query(collection(db, TEACHERS), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    if (branchId) return getTeachers();
    return [];
  }
}

export async function addTeacher(data) {
  const { uid } = await createAuthUser(data.email, data.password);

  await setDoc(doc(db, TEACHERS, uid), {
    uid,
    name: data.name,
    phone: data.phone || "",
    address: data.address || "",
    experience: data.experience || "",
    licenseNumber: data.licenseNumber || "",
    email: data.email,
    password: data.password,
    branchId: data.branchId || null,
    role: "teacher",
    status: "active",
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, USERS, uid), {
    uid,
    name: data.name,
    email: data.email,
    role: "teacher",
    branchId: data.branchId || null,
    accessibleBranchIds: data.branchId ? [data.branchId] : [],
  });

  return uid;
}

export async function updateTeacher(id, data) {
  const updateFields = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.phone !== undefined) updateFields.phone = data.phone;
  if (data.address !== undefined) updateFields.address = data.address;
  if (data.experience !== undefined) updateFields.experience = data.experience;
  if (data.licenseNumber !== undefined) updateFields.licenseNumber = data.licenseNumber;
  if (data.status !== undefined) updateFields.status = data.status;

  const emailChanged = data.email !== undefined;
  const passwordChanged = data.password !== undefined && data.password !== "";

  if (emailChanged) {
    updateFields.email = data.email;
  }

  const oldSnap = await getDoc(doc(db, TEACHERS, id));
  if (!oldSnap.exists()) throw new Error("Teacher not found");
  const oldData = oldSnap.data();
  const oldEmail = oldData.email;
  const oldPassword = oldData.password;

  if (emailChanged || passwordChanged) {
    let idToken;
    try {
      idToken = await signInAsTeacher(oldEmail, oldPassword, data.password || undefined);
    } catch (e) {
      throw new Error("Failed to sign in as teacher: " + (e.message || "check password"));
    }
    try {
      await updateAuthAccount(idToken, emailChanged ? data.email : null, passwordChanged ? data.password : null);
      if (emailChanged) updateFields.email = data.email;
      if (passwordChanged) updateFields.password = data.password;
    } catch (e) {
      throw new Error("Failed to update login account: " + (e.message || "unknown error"));
    }
  }

  await updateDoc(doc(db, TEACHERS, id), updateFields);

  if (emailChanged) {
    await updateDoc(doc(db, USERS, id), { email: data.email });
  }
}

export async function deleteTeacher(id) {
  await deleteDoc(doc(db, TEACHERS, id));
  await deleteDoc(doc(db, USERS, id));
}

export async function toggleTeacherStatus(id, currentStatus) {
  const newStatus = currentStatus === "active" ? "inactive" : "active";
  await updateDoc(doc(db, TEACHERS, id), { status: newStatus });
  return newStatus;
}
