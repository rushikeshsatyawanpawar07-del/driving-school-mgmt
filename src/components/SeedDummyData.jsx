import { useState } from "react";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useNotification } from "../context/NotificationContext";

const BRANCHES = [
  { id: "branch_dhayari", name: "Dhayari" },
  { id: "branch_kirkatwadi", name: "Kirkatwadi" },
  { id: "branch_vadgaon", name: "Vadgaon" },
];

const TEACHERS_BY_BRANCH = {
  branch_dhayari: [
    { name: "Ramesh Patil", phone: "9876543210", email: "ramesh.patil@dummy.com" },
    { name: "Suresh Deshmukh", phone: "9876543211", email: "suresh.deshmukh@dummy.com" },
    { name: "Amit Joshi", phone: "9876543212", email: "amit.joshi@dummy.com" },
    { name: "Deepak Kulkarni", phone: "9876543213", email: "deepak.kulkarni@dummy.com" },
    { name: "Vikram Shinde", phone: "9876543214", email: "vikram.shinde@dummy.com" },
  ],
  branch_kirkatwadi: [
    { name: "Sandeep More", phone: "9876543220", email: "sandeep.more@dummy.com" },
    { name: "Rajesh Pawar", phone: "9876543221", email: "rajesh.pawar@dummy.com" },
    { name: "Anil Kadam", phone: "9876543222", email: "anil.kadam@dummy.com" },
    { name: "Nitin Sawant", phone: "9876543223", email: "nitin.sawant@dummy.com" },
    { name: "Prashant Jadhav", phone: "9876543224", email: "prashant.jadhav@dummy.com" },
  ],
  branch_vadgaon: [
    { name: "Mahesh Gaikwad", phone: "9876543230", email: "mahesh.gaikwad@dummy.com" },
    { name: "Sunil Mahajan", phone: "9876543231", email: "sunil.mahajan@dummy.com" },
    { name: "Vinod Apte", phone: "9876543232", email: "vinod.apte@dummy.com" },
    { name: "Kiran Bhosale", phone: "9876543233", email: "kiran.bhosale@dummy.com" },
    { name: "Sachin Khedkar", phone: "9876543234", email: "sachin.khedkar@dummy.com" },
  ],
};

const STUDENTS_BY_BRANCH = {
  branch_dhayari: [
    { name: "Rahul Sharma", phone: "9988776601", email: "rahul.sharma@dummy.com" },
    { name: "Priya Singh", phone: "9988776602", email: "priya.singh@dummy.com" },
    { name: "Ankit Verma", phone: "9988776603", email: "ankit.verma@dummy.com" },
    { name: "Sneha Reddy", phone: "9988776604", email: "sneha.reddy@dummy.com" },
    { name: "Kunal Gupta", phone: "9988776605", email: "kunal.gupta@dummy.com" },
  ],
  branch_kirkatwadi: [
    { name: "Neha Patil", phone: "9988776610", email: "neha.patil@dummy.com" },
    { name: "Vikas Yadav", phone: "9988776611", email: "vikas.yadav@dummy.com" },
    { name: "Pooja Mishra", phone: "9988776612", email: "pooja.mishra@dummy.com" },
    { name: "Ajay Chavan", phone: "9988776613", email: "ajay.chavan@dummy.com" },
    { name: "Ritu Jain", phone: "9988776614", email: "ritu.jain@dummy.com" },
  ],
  branch_vadgaon: [
    { name: "Mohit Desai", phone: "9988776620", email: "mohit.desai@dummy.com" },
    { name: "Kavita Rao", phone: "9988776621", email: "kavita.rao@dummy.com" },
    { name: "Sanjay Joshi", phone: "9988776622", email: "sanjay.joshi@dummy.com" },
    { name: "Meera Nair", phone: "9988776623", email: "meera.nair@dummy.com" },
    { name: "Arjun Thakur", phone: "9988776624", email: "arjun.thakur@dummy.com" },
  ],
};

const INQUIRIES_BY_BRANCH = {
  branch_dhayari: [
    { name: "Aarav Mehta", phone: "8877665501", email: "aarav.m@dummy.com", courseInterested: "Two Wheeler Training Only" },
    { name: "Isha Patel", phone: "8877665502", email: "isha.p@dummy.com", courseInterested: "Four Wheeler Training + License" },
    { name: "Rohit Jain", phone: "8877665503", email: "rohit.j@dummy.com", courseInterested: "Four Wheeler Training Only" },
    { name: "Ananya Rao", phone: "8877665504", email: "ananya.r@dummy.com", courseInterested: "Two Wheeler Training + License" },
    { name: "Devendra Singh", phone: "8877665505", email: "devendra.s@dummy.com", courseInterested: "Four Wheeler Training + License" },
  ],
  branch_kirkatwadi: [
    { name: "Karan Walia", phone: "8877665510", email: "karan.w@dummy.com", courseInterested: "Two Wheeler Training Only" },
    { name: "Sonali Desai", phone: "8877665511", email: "sonali.d@dummy.com", courseInterested: "Four Wheeler Training Only" },
    { name: "Pranav Kulkarni", phone: "8877665512", email: "pranav.k@dummy.com", courseInterested: "Two Wheeler Training + License" },
    { name: "Tanya Gupta", phone: "8877665513", email: "tanya.g@dummy.com", courseInterested: "Four Wheeler Training + License" },
    { name: "Varun Saxena", phone: "8877665514", email: "varun.s@dummy.com", courseInterested: "Four Wheeler Training Only" },
  ],
  branch_vadgaon: [
    { name: "Nisha Agarwal", phone: "8877665520", email: "nisha.a@dummy.com", courseInterested: "Two Wheeler Training Only" },
    { name: "Rahul Kapoor", phone: "8877665521", email: "rahul.k@dummy.com", courseInterested: "Four Wheeler Training + License" },
    { name: "Pooja Nair", phone: "8877665522", email: "pooja.n@dummy.com", courseInterested: "Two Wheeler Training + License" },
    { name: "Vivek Joshi", phone: "8877665523", email: "vivek.j@dummy.com", courseInterested: "Four Wheeler Training Only" },
    { name: "Kriti Bhatia", phone: "8877665524", email: "kriti.b@dummy.com", courseInterested: "Four Wheeler Training + License" },
  ],
};

const COURSES = [
  { label: "Two Wheeler Training Only", price: 3000, totalClasses: 15, duration: "15 Days" },
  { label: "Two Wheeler Training + License", price: 5000, totalClasses: 15, duration: "15 Days" },
  { label: "Four Wheeler Training Only", price: 5000, totalClasses: 30, duration: "30 Days" },
  { label: "Four Wheeler Training + License", price: 7000, totalClasses: 30, duration: "30 Days" },
];

const VEHICLE_TYPES = ["Two Wheeler", "Four Wheeler", "Two Wheeler", "Four Wheeler", "Four Wheeler"];
const BATCHES = ["Morning 6-7 AM", "Morning 7-8 AM", "Evening 5-6 PM", "Evening 6-7 PM", "Morning 8-9 AM"];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split("T")[0];
}

export default function SeedDummyData({ onDone }) {
  const { addNotification } = useNotification();
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const teacherIdsByBranch = {};
      let studentCount = 0;
      let teacherCount = 0;
      let inquiryCount = 0;
      let attendanceCount = 0;

      // Step 1: Create teachers
      for (const branch of BRANCHES) {
        teacherIdsByBranch[branch.id] = [];
        const teacherData = TEACHERS_BY_BRANCH[branch.id];
        for (const t of teacherData) {
          const docRef = await addDoc(collection(db, "teachers"), {
            uid: null,
            name: t.name,
            phone: t.phone,
            address: `${branch.name} Area, Pune`,
            experience: `${3 + Math.floor(Math.random() * 10)} years`,
            licenseNumber: `DL-${String(10000 + Math.floor(Math.random() * 90000))}`,
            email: t.email,
            password: "dummy123",
            branchId: branch.id,
            role: "teacher",
            status: "active",
            createdAt: serverTimestamp(),
          });
          teacherIdsByBranch[branch.id].push(docRef.id);
          teacherCount++;
        }
      }

      // Step 2: Create students
      let studentIdx = 9001;
      for (const branch of BRANCHES) {
        const studentData = STUDENTS_BY_BRANCH[branch.id];
        const branchTeacherIds = teacherIdsByBranch[branch.id];
        for (let i = 0; i < studentData.length; i++) {
          const s = studentData[i];
          const course = COURSES[i % COURSES.length];
          const assignedTeacherId = branchTeacherIds[i % branchTeacherIds.length];
          const docRef = await addDoc(collection(db, "students"), {
            studentId: `SD${studentIdx}`,
            name: s.name,
            phone: s.phone,
            altPhone: "",
            email: s.email,
            address: `${branch.name} Area, Pune`,
            course: course.label,
            joiningDate: randomDate(new Date("2026-01-01"), new Date("2026-06-30")),
            courseFees: course.price,
            feesPaid: Math.floor(course.price * (0.3 + Math.random() * 0.7)),
            pendingFees: 0,
            totalFees: course.price,
            remainingFees: 0,
            attendanceDays: 0,
            status: "active",
            assignedTeacherId,
            teacherName: TEACHERS_BY_BRANCH[branch.id][i % 5].name,
            teacherPhone: TEACHERS_BY_BRANCH[branch.id][i % 5].phone,
            batch: BATCHES[i],
            vehicleType: VEHICLE_TYPES[i],
            branchId: branch.id,
            createdAt: serverTimestamp(),
            clientAuthUid: null,
          });

          // Step 3: Create attendance for this student
          const attendanceDates = [
            randomDate(new Date("2026-07-01"), new Date("2026-07-15")),
            randomDate(new Date("2026-07-01"), new Date("2026-07-15")),
            randomDate(new Date("2026-07-01"), new Date("2026-07-15")),
            randomDate(new Date("2026-07-01"), new Date("2026-07-15")),
            randomDate(new Date("2026-07-01"), new Date("2026-07-15")),
          ];
          const uniqueDates = [...new Set(attendanceDates)].slice(0, 5);
          let presentCount = 0;
          for (const date of uniqueDates) {
            const present = Math.random() > 0.2;
            if (present) presentCount++;
            await addDoc(collection(db, "attendance"), {
              studentId: docRef.id,
              date,
              present,
              createdAt: serverTimestamp(),
            });
            attendanceCount++;
          }

          if (presentCount > 0) {
            await updateDoc(doc(db, "students", docRef.id), { attendanceDays: presentCount });
          }

          studentIdx++;
          studentCount++;
        }
      }

      // Step 4: Create inquiries
      for (const branch of BRANCHES) {
        const inquiryData = INQUIRIES_BY_BRANCH[branch.id];
        for (const inq of inquiryData) {
          await addDoc(collection(db, "inquiries"), {
            name: inq.name,
            phone: inq.phone,
            email: inq.email,
            courseInterested: inq.courseInterested,
            inquiryDate: randomDate(new Date("2026-06-01"), new Date("2026-07-17")),
            notes: "Walk-in inquiry, interested in joining soon.",
            branchId: branch.id,
            createdAt: serverTimestamp(),
          });
          inquiryCount++;
        }
      }

      addNotification(`Done! ${teacherCount} teachers, ${studentCount} students, ${inquiryCount} inquiries, ${attendanceCount} attendance records created.`);
      if (onDone) onDone();
    } catch (e) {
      addNotification("Seeding failed: " + (e.message || "unknown error"), "error");
    }
    setSeeding(false);
  };

  return (
    <div className="card" style={{ borderLeft: "4px solid var(--primary)", marginBottom: 16 }}>
      <div style={{ padding: "16px 20px" }}>
        <h3 style={{ margin: "0 0 8px" }}>Seed Dummy Data</h3>
        <p style={{ color: "var(--gray-500)", margin: "0 0 12px", fontSize: 13 }}>
          Creates 5 teachers, 5 students, and 5 inquiries per branch (3 branches) with attendance records.
        </p>
        <button
          className="login-btn"
          onClick={handleSeed}
          disabled={seeding}
          style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}
        >
          {seeding ? "Seeding..." : "Seed Dummy Data"}
        </button>
      </div>
    </div>
  );
}
