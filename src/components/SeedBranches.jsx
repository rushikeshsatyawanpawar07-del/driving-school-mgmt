import { useState } from "react";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";

const branchData = [
  { id: "branch_pune", name: "Pune", code: "PUN", address: "Pune Branch Address", phone: "+91 98765 43211" },
  { id: "branch_mumbai", name: "Mumbai", code: "MUM", address: "Mumbai Branch Address", phone: "+91 98765 43212" },
  { id: "branch_nashik", name: "Nashik", code: "NAS", address: "Nashik Branch Address", phone: "+91 98765 43213" },
];

export default function SeedBranches({ onDone }) {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      for (const b of branchData) {
        await setDoc(doc(db, "branches", b.id), {
          name: b.name,
          code: b.code,
          address: b.address,
          phone: b.phone,
          createdAt: new Date().toISOString(),
        });
      }
      if (user) {
        await updateDoc(doc(db, "user", user.uid), {
          accessibleBranchIds: branchData.map((b) => b.id),
        });
      }
      addNotification("3 branches created! Please log out and log back in.");
      if (onDone) onDone();
    } catch (e) {
      addNotification("Failed: " + (e.message || "unknown error"), "error");
    }
    setSeeding(false);
  };

  return (
    <div>
      <h3>Initialize Branches</h3>
      <p style={{ color: "var(--gray-500)", marginBottom: 12 }}>
        This will create 3 branches (Pune, Mumbai, Nashik) and grant you access to all.
      </p>
      <button className="login-btn" onClick={handleSeed} disabled={seeding} style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
        {seeding ? "Creating..." : "Create 3 Branches"}
      </button>
    </div>
  );
}
