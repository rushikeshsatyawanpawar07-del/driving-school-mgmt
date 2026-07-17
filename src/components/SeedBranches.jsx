import { useState, useEffect } from "react";
import { collection, doc, setDoc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useBranch } from "../context/BranchContext";

const branchData = [
  { id: "branch_pune", name: "Vadgaon", code: "VDG", address: "Vadgaon Branch", phone: "+91 98765 43211" },
  { id: "branch_mumbai", name: "Dhayari", code: "DHA", address: "Dhayari Branch", phone: "+91 98765 43212" },
  { id: "branch_nashik", name: "Kirkatwadi", code: "KIR", address: "Kirkatwadi Branch", phone: "+91 98765 43213" },
];

const DEFAULT_BRANCH = "branch_pune";

export default function SeedBranches({ onDone }) {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const { branches, setBranches } = useBranch();
  const [seeding, setSeeding] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const currentNames = branches.map((b) => b.name).join(", ");

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
      addNotification("Branch names updated! Log out and log back in to see changes.");
      if (onDone) onDone();
    } catch (e) {
      addNotification("Failed: " + (e.message || "unknown error"), "error");
    }
    setSeeding(false);
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      let count = 0;
      for (const coll of ["students", "teachers", "inquiries"]) {
        const snap = await getDocs(collection(db, coll));
        for (const d of snap.docs) {
          if (!d.data().branchId) {
            await updateDoc(doc(db, coll, d.id), { branchId: DEFAULT_BRANCH });
            count++;
          }
        }
      }
      addNotification(`${count} old records assigned to Vadgaon branch.`);
    } catch (e) {
      addNotification("Migration failed: " + (e.message || "error"), "error");
    }
    setMigrating(false);
  };

  return (
    <div>
      <h3>Branch Management</h3>
      {branches.length > 0 && (
        <p style={{ color: "var(--gray-500)", marginBottom: 8 }}>
          Current branches: <strong>{currentNames}</strong>
        </p>
      )}
      <p style={{ color: "var(--gray-500)", marginBottom: 12 }}>
        Click below to update branch names to: <strong>Vadgaon, Dhayari, Kirkatwadi</strong>
      </p>
      <button className="login-btn" onClick={handleSeed} disabled={seeding} style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", marginRight: 12 }}>
        {seeding ? "Saving..." : "Update Branch Names"}
      </button>
      <button className="login-btn" onClick={handleMigrate} disabled={migrating} style={{ background: "var(--orange)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
        {migrating ? "Migrating..." : "Assign Old Data to Vadgaon"}
      </button>
    </div>
  );
}
