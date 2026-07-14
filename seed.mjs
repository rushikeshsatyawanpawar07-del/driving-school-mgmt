import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, orderBy, getDocs, serverTimestamp } from "firebase/firestore";

const config = {
  apiKey: "AIzaSyC2TuLS8tZv-7n_1K23-2RlGBGojXf52ik",
  authDomain: "driving-catalog.firebaseapp.com",
  projectId: "driving-catalog",
  storageBucket: "driving-catalog.firebasestorage.app",
  messagingSenderId: "979140342078",
  appId: "1:979140342078:web:3616ee48d9f48bffb93c6f"
};

const app = initializeApp(config);
const db = getFirestore(app);

const first = ["Aarav","Priya","Rohit","Ananya","Vikram","Neha","Arjun","Kavita","Siddharth","Isha","Raj","Maya","Karan","Sara","Aditya","Nisha","Rahul","Pooja","Amit","Deepa"];
const last = ["Sharma","Patel","Singh","Gupta","Joshi","Verma","Kumar","Desai","Nair","Mehta","Reddy","Kapoor","Malhotra","Bose","Chopra","Agarwal","Sethi","Rao","Iyer","Menon"];
const courses = ["Two Wheeler Training Only","Two Wheeler Training + License","Four Wheeler Training Only","Four Wheeler Training + License"];
const batches = ["Morning", "Afternoon", "Evening"];

async function getLastStudentId() {
  const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  if (snap.empty) return 1000;
  const last = snap.docs[0]?.data()?.studentId;
  if (!last) return 1000;
  return parseInt(last.replace("DS", ""), 10);
}

async function seed() {
  console.log("Fetching last student ID...");
  let nextId = await getLastStudentId();
  console.log("Starting from DS" + (nextId + 1) + ", adding 1000 students (Firestore only, no auth)...\n");

  let count = 0;
  for (let i = 0; i < 1000; i++) {
    nextId++;
    const studentId = "DS" + nextId;
    const name = first[i % 20] + " " + last[Math.floor(i / 20) % 20];
    const email = name.toLowerCase().replace(/\s+/g, ".") + i + "@driveschool.com";
    const phone = (9000000000 + i).toString();
    const course = courses[i % 4];
    const feesPaid = Math.floor(Math.random() * 3001) + 1000;
    const totalFees = 7000;

    try {
      const studentData = {
        studentId,
        name,
        phone,
        altPhone: "",
        email,
        address: "",
        course,
        joiningDate: new Date().toISOString().split("T")[0],
        courseFees: totalFees,
        feesPaid,
        pendingFees: totalFees - feesPaid,
        totalFees,
        remainingFees: totalFees - feesPaid,
        attendanceDays: Math.floor(Math.random() * 21),
        status: "active",
        assignedTeacherId: null,
        batch: batches[Math.floor(Math.random() * 3)],
        vehicleType: Math.random() > 0.5 ? "Two Wheeler" : "Four Wheeler",
        createdAt: serverTimestamp(),
        clientAuthUid: null,
      };

      await addDoc(collection(db, "students"), studentData);
      count++;
      if ((i + 1) % 100 === 0) console.log(`[${i + 1}/1000] ${count} added so far`);
    } catch (e) {
      console.error(`[${i + 1}] Failed: ${e.message}`);
    }
  }

  console.log(`\n✅ Done. ${count} students added to Firestore.`);
  process.exit(0);
}

seed();
