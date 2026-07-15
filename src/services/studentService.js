import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, getDoc, query, orderBy, where, serverTimestamp, setDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { SCHOOL } from "../config/schoolConfig";

const STUDENTS = "students";
const TEACHERS = "teachers";
const USERS = "user";
const API_KEY = "AIzaSyC2TuLS8tZv-7n_1K23-2RlGBGojXf52ik";
const PREFIX = SCHOOL.studentIdPrefix;

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

export async function getNextStudentId() {
  const q = query(collection(db, STUDENTS), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  if (snap.empty) return `${PREFIX}1001`;
  const last = snap.docs[0].data().studentId;
  if (!last) return `${PREFIX}1001`;
  const num = parseInt(last.replace(PREFIX, ""), 10);
  return `${PREFIX}${num + 1}`;
}

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
  const studentId = await getNextStudentId();
  const password = studentId;

  let authUid = null;
  if (data.email) {
    try {
      const authUser = await createAuthUser(data.email, password);
      authUid = authUser.uid;
    } catch (e) {
      throw new Error(e.message || "Failed to create client login account");
    }
  }

  let teacherName = null;
  let teacherPhone = null;
  if (data.assignedTeacherId) {
    const tSnap = await getDoc(doc(db, TEACHERS, data.assignedTeacherId));
    if (tSnap.exists()) {
      teacherName = tSnap.data().name || null;
      teacherPhone = tSnap.data().phone || null;
    }
  }

  const studentData = {
    studentId,
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
    teacherName,
    teacherPhone,
    batch: data.batch || "",
    vehicleType: data.vehicleType || "",
    createdAt: serverTimestamp(),
    clientAuthUid: authUid || null,
  };

  const docRef = await addDoc(collection(db, STUDENTS), studentData);

  if (authUid) {
    await setDoc(doc(db, USERS, authUid), {
      uid: authUid,
      name: data.name,
      email: data.email,
      role: "client",
      studentId,
      studentDocId: docRef.id,
      createdAt: serverTimestamp(),
    });
  }

  return { id: docRef.id, studentId, password };
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
  } catch (e) {
    throw new Error(e.message || "Failed to update student");
  }
}

export async function deleteStudent(id) {
  const snap = await getDoc(doc(db, STUDENTS, id));
  const s = snap.data();
  if (s?.clientAuthUid) {
    await deleteDoc(doc(db, USERS, s.clientAuthUid));
  }
  await deleteDoc(doc(db, STUDENTS, id));
}

export async function recordPayment(id, amount) {
  const student = await getStudent(id);
  if (!student) throw new Error("Student not found");
  const feesPaid = student.feesPaid + Number(amount);
  const remainingFees = student.totalFees - feesPaid;
  await updateDoc(doc(db, STUDENTS, id), {
    feesPaid,
    pendingFees: remainingFees,
    remainingFees,
    status: remainingFees <= 0 ? "active" : student.status,
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

  const newStudentId = await getNextStudentId();
  const newPassword = newStudentId;

  await updateDoc(doc(db, STUDENTS, docSnap.id), { studentId: newStudentId });

  if (data.clientAuthUid) {
    await updateDoc(doc(db, USERS, data.clientAuthUid), { studentId: newStudentId });
  }

  return { newStudentId, newPassword };
}
