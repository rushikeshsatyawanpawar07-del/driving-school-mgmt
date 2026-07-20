import {
  collection, addDoc, setDoc, updateDoc, deleteDoc, doc,
  getDocs, getDoc, query, orderBy, where, serverTimestamp, runTransaction
} from "firebase/firestore";
import { db } from "../firebase";
import { SCHOOL } from "../config/schoolConfig";
import { generateStudentReminders } from "./licenseReminderService";

const STUDENTS = "students";
const TEACHERS = "teachers";
const USERS = "user";
const PREFIX = SCHOOL.studentIdPrefix;
const BRANCH_PREFIXES = SCHOOL.branchPrefixes || {};
const API_KEY = "AIzaSyC2TuLS8tZv-7n_1K23-2RlGBGojXf52ik";

function getPrefixForBranch(branchId) {
  return BRANCH_PREFIXES[branchId] || PREFIX;
}

function getCounterDocId(branchId) {
  return `studentCounter_${getPrefixForBranch(branchId)}`;
}

export async function getNextStudentId(branchId) {
  const prefix = getPrefixForBranch(branchId);
  const counterRef = doc(db, "counters", getCounterDocId(branchId));
  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    if (!snap.exists()) {
      transaction.set(counterRef, { value: 1002 });
      return `${prefix}1001`;
    }
    const val = snap.data().value;
    transaction.update(counterRef, { value: val + 1 });
    return `${prefix}${val}`;
  });
}

export async function getStudents(branchId) {
  let constraints = [orderBy("name")];
  if (branchId) constraints = [where("branchId", "==", branchId), orderBy("name")];
  try {
    const snap = await getDocs(query(collection(db, STUDENTS), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function getStudentsByTeacher(teacherUid, branchId) {
  let constraints = [where("assignedTeacherId", "==", teacherUid)];
  if (branchId) constraints = [where("assignedTeacherId", "==", teacherUid), where("branchId", "==", branchId)];
  try {
    const snap = await getDocs(query(collection(db, STUDENTS), ...constraints));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } catch {
    return [];
  }
}

export async function getStudent(id) {
  const snap = await getDoc(doc(db, STUDENTS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getStudentByAuthUid(authUid) {
  const q = query(collection(db, STUDENTS), where("clientAuthUid", "==", authUid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getStudentByEmail(email) {
  const q = query(collection(db, STUDENTS), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function addStudent(data) {
  const studentId = await getNextStudentId(data.branchId);
  const authEmail = `${studentId.toLowerCase()}@s.drive`;

  let teacherName = null;
  let teacherPhone = null;
  if (data.assignedTeacherId) {
    const tSnap = await getDoc(doc(db, TEACHERS, data.assignedTeacherId));
    if (tSnap.exists()) {
      teacherName = tSnap.data().name || null;
      teacherPhone = tSnap.data().phone || null;
    }
  }

  // Create Firebase Auth account for client login
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail, password: data.phone, returnSecureToken: true }),
    }
  );
  const authData = await authRes.json();
  if (authData.error) throw new Error(`Failed to create student auth: ${authData.error.message}`);
  const clientAuthUid = authData.localId;

  // Create user doc with client role
  await setDoc(doc(db, USERS, clientAuthUid), {
    uid: clientAuthUid,
    name: data.name,
    email: authEmail,
    role: "client",
    studentId,
    phone: data.phone,
    branchId: data.branchId || null,
  });

  const studentData = {
    studentId,
    name: data.name,
    phone: data.phone,
    altPhone: data.altPhone || "",
    email: data.email || "",
    address: data.permanentAddress || data.address || "",
    permanentAddress: data.permanentAddress || "",
    temporaryAddress: data.temporaryAddress || "",
    bloodGroup: data.bloodGroup || "",
    dob: data.dob || "",
    llNumber: data.llNumber || "",
    llValidFrom: data.llValidFrom || "",
    llValidTo: data.llValidTo || "",
    dlNumber: data.dlNumber || "",
    dlValidTill: data.dlValidTill || "",
    course: data.course,
    joiningDate: data.joiningDate,
    courseCompletionDate: data.courseCompletionDate || "",
    courseFees: Number(data.courseFees),
    finalFee: Number(data.finalFee) || Number(data.courseFees),
    feesPaid: Number(data.feesPaid),
    pendingFees: Number(data.pendingFees),
    totalFees: Number(data.totalFees),
    remainingFees: Number(data.remainingFees),
    discountType: data.discountType || "",
    discountValue: Number(data.discountValue) || 0,
    feeNote: data.feeNote || "",
    attendanceDays: 0,
    status: "active",
    assignedTeacherId: data.assignedTeacherId || null,
    teacherName,
    teacherPhone,
    batch: data.batch || "",
    batchTime: data.batchTime || "",
    vehicleType: data.vehicleType || "",
    selectedVehicles: data.selectedVehicles || [],
    branchId: data.branchId || null,
    clientAuthUid,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, STUDENTS), studentData);

  generateStudentReminders({ id: docRef.id, ...studentData }).catch(() => {});

  return { id: docRef.id, studentId };
}

export async function updateStudent(id, data) {
  try {
    const oldSnap = await getDoc(doc(db, STUDENTS, id));
    if (oldSnap.exists()) {
      const oldData = oldSnap.data();

      // Update auth email if changed
      if (data.email && data.email !== oldData.email) {
        const oldEmail = oldData.email;
        const studentId = oldData.studentId;
        if (oldEmail && studentId) {
          try {
            const signInRes = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: oldEmail, password: studentId, returnSecureToken: true }),
              }
            );
            const signInData = await signInRes.json();
            if (!signInData.error) {
              await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ idToken: signInData.idToken, email: data.email, returnSecureToken: true }),
                }
              );
            }
          } catch { /* auth update failed but Firestore update proceeds */ }
        }
      }

      // Update auth password if phone changed (client uses phone as password)
      if (data.phone && data.phone !== oldData.phone && oldData.clientAuthUid) {
        try {
          const signInRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: `${oldData.studentId.toLowerCase()}@s.drive`, password: oldData.phone, returnSecureToken: true }),
            }
          );
          const signInData = await signInRes.json();
          if (!signInData.error) {
            await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: signInData.idToken, password: data.phone, returnSecureToken: true }),
              }
            );
          }
        } catch { /* password update best-effort */ }
      }

      // Update teacher info if assignedTeacherId changed
      if (data.assignedTeacherId !== undefined && data.assignedTeacherId !== oldData.assignedTeacherId) {
        if (data.assignedTeacherId) {
          const tSnap = await getDoc(doc(db, TEACHERS, data.assignedTeacherId));
          if (tSnap.exists()) {
            data.teacherName = tSnap.data().name || null;
            data.teacherPhone = tSnap.data().phone || null;
          }
        } else {
          data.teacherName = null;
          data.teacherPhone = null;
        }
      }
    }
    await updateDoc(doc(db, STUDENTS, id), data);

    const freshSnap = await getDoc(doc(db, STUDENTS, id));
    if (freshSnap.exists()) {
      generateStudentReminders({ id: freshSnap.id, ...freshSnap.data() }).catch(() => {});
    }
  } catch (e) {
    throw new Error(e.message || "Failed to update student");
  }
}

export async function deleteStudent(id) {
  const snap = await getDoc(doc(db, STUDENTS, id));
  const s = snap.data();
  if (s?.clientAuthUid) {
    try {
      // Sign in to get idToken, then delete
      const signInRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: `${s.studentId.toLowerCase()}@s.drive`, password: s.phone, returnSecureToken: true }),
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
    try {
      await deleteDoc(doc(db, USERS, s.clientAuthUid));
    } catch { /* user doc delete best-effort */ }
  }
  await deleteDoc(doc(db, STUDENTS, id));
}

export async function recordPayment(id, amount) {
  const student = await getStudent(id);
  if (!student) throw new Error("Student not found");
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) throw new Error("Invalid payment amount");
  const feesPaid = student.feesPaid + amt;
  const remainingFees = student.totalFees - feesPaid;
  const newStatus = student.status === "completed" || student.status === "expired" ? student.status : (remainingFees <= 0 ? "active" : student.status);
  await updateDoc(doc(db, STUDENTS, id), {
    feesPaid,
    pendingFees: remainingFees,
    remainingFees,
    status: newStatus,
  });
}

export async function assignStudentToTeacher(studentId, teacherId) {
  let teacherName = null;
  let teacherPhone = null;
  if (teacherId) {
    const tSnap = await getDoc(doc(db, TEACHERS, teacherId));
    if (tSnap.exists()) {
      teacherName = tSnap.data().name || null;
      teacherPhone = tSnap.data().phone || null;
    }
  }
  await updateDoc(doc(db, STUDENTS, studentId), {
    assignedTeacherId: teacherId || null,
    teacherName,
    teacherPhone,
  });
}

export async function resetStudentPassword(studentId) {
  const q = query(collection(db, STUDENTS), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Student not found");
  const docSnap = snap.docs[0];
  const data = docSnap.data();

  const newStudentId = await getNextStudentId(data.branchId);
  const newPassword = newStudentId;

  await updateDoc(doc(db, STUDENTS, docSnap.id), { studentId: newStudentId });

  if (data.clientAuthUid) {
    await updateDoc(doc(db, USERS, data.clientAuthUid), { studentId: newStudentId });
  }

  // Update auth email to match new studentId
  try {
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${data.studentId.toLowerCase()}@s.drive`, password: newPassword, returnSecureToken: true }),
      }
    );
    const signInData = await signInRes.json();
    if (!signInData.error) {
      await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: signInData.idToken, email: `${newStudentId.toLowerCase()}@s.drive`, password: newPassword, returnSecureToken: true }),
        }
      );
    }
  } catch { /* auth update best-effort */ }

  return { newStudentId, newPassword };
}
