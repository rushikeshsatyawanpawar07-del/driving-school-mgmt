import {
  collection, updateDoc, deleteDoc, doc,
  getDocs, getDoc, query, orderBy, setDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const RECEPTIONISTS = "receptionists";
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

async function signInAsReceptionist(email, currentPassword) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: currentPassword, returnSecureToken: true }),
    }
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.idToken;
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

export async function getReceptionists(branchId) {
  try {
    const snap = await getDocs(query(collection(db, RECEPTIONISTS), orderBy("name")));
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (branchId) list = list.filter((r) => r.branchId === branchId);
    return list;
  } catch {
    return [];
  }
}

export async function addReceptionist(data) {
  const { uid } = await createAuthUser(data.email, data.password);

  await setDoc(doc(db, RECEPTIONISTS, uid), {
    uid,
    name: data.name,
    phone: data.phone || "",
    address: data.address || "",
    email: data.email,
    salary: data.salary || "",
    branchId: data.branchId || null,
    role: "reception",
    status: "active",
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, USERS, uid), {
    uid,
    name: data.name,
    email: data.email,
    role: "reception",
    branchId: data.branchId || null,
    accessibleBranchIds: data.branchId ? [data.branchId] : [],
  });

  return uid;
}

export async function updateReceptionist(id, data) {
  const updateFields = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.phone !== undefined) updateFields.phone = data.phone;
  if (data.address !== undefined) updateFields.address = data.address;
  if (data.salary !== undefined) updateFields.salary = data.salary;
  if (data.status !== undefined) updateFields.status = data.status;

  const emailChanged = data.email !== undefined;
  const passwordChanged = data.password !== undefined && data.password !== "";

  if (emailChanged) {
    updateFields.email = data.email;
  }

  if (emailChanged || passwordChanged) {
    const oldSnap = await getDoc(doc(db, RECEPTIONISTS, id));
    if (!oldSnap.exists()) throw new Error("Receptionist not found");
    const oldEmail = oldSnap.data().email;

    if (!data.currentPassword) {
      throw new Error("Current password is required to update email or password");
    }
    let idToken;
    try {
      idToken = await signInAsReceptionist(oldEmail, data.currentPassword);
    } catch {
      throw new Error("Current password is incorrect");
    }
    try {
      await updateAuthAccount(idToken, emailChanged ? data.email : null, passwordChanged ? data.password : null);
    } catch (e) {
      throw new Error("Failed to update login account: " + (e.message || "unknown error"));
    }
  }

  await updateDoc(doc(db, RECEPTIONISTS, id), updateFields);

  if (emailChanged) {
    await updateDoc(doc(db, USERS, id), { email: data.email });
  }
}

export async function deleteReceptionist(id) {
  const snap = await getDoc(doc(db, RECEPTIONISTS, id));
  if (!snap.exists()) throw new Error("Receptionist not found");
  const data = snap.data();
  try {
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.email, returnSecureToken: true }),
      }
    );
    const signInData = await signInRes.json();
    if (!signInData.error) {
      await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: signInData.idToken }),
        }
      );
    }
  } catch { /* auth delete best-effort */ }
  await deleteDoc(doc(db, RECEPTIONISTS, id));
  await deleteDoc(doc(db, USERS, id));
}

export async function toggleReceptionistStatus(id, currentStatus) {
  const newStatus = currentStatus === "active" ? "inactive" : "active";
  await updateDoc(doc(db, RECEPTIONISTS, id), { status: newStatus });
  return newStatus;
}
