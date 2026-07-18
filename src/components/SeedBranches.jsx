import { useState, useEffect } from "react";
import { collection, doc, setDoc, updateDoc, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useBranch } from "../context/BranchContext";

const BRANCH_ID_MAP = {
  branch_mumbai: "dhayari",
  branch_nashik: "kirkatwadi",
  branch_pune: "vadgaon",
};

const branchData = [
  { id: "dhayari", name: "Dhayari", code: "DHA", address: "Dhayari Branch", phone: "+91 98765 43211" },
  { id: "kirkatwadi", name: "Kirkatwadi", code: "KIR", address: "Kirkatwadi Branch", phone: "+91 98765 43212" },
  { id: "vadgaon", name: "Vadgaon", code: "VDG", address: "Vadgaon Branch", phone: "+91 98765 43213" },
];

const DEFAULT_BRANCH = "vadgaon";

export default function SeedBranches({ onDone }) {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const { branches, setBranches } = useBranch();
  const [seeding, setSeeding] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [renaming, setRenaming] = useState(false);

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
      addNotification("Branches created! Log out and log back in to see changes.");
      if (onDone) onDone();
    } catch (e) {
      addNotification("Failed: " + (e.message || "unknown error"), "error");
    }
    setSeeding(false);
  };

  const handleRenameBranchIds = async () => {
    setRenaming(true);
    try {
      // Step 1: Read old branch docs, create new ones with new IDs, delete old ones
      for (const [oldId, newId] of Object.entries(BRANCH_ID_MAP)) {
        const oldDoc = await getDocs(collection(db, "branches"));
        const old = oldDoc.docs.find((d) => d.id === oldId);
        if (old) {
          await setDoc(doc(db, "branches", newId), old.data());
          await deleteDoc(doc(db, "branches", oldId));
        }
      }

      // Step 2: Update all records referencing old branch IDs to new IDs
      let recordCount = 0;
      for (const coll of ["students", "teachers", "inquiries"]) {
        const snap = await getDocs(collection(db, coll));
        for (const d of snap.docs) {
          const data = d.data();
          const oldBranchId = data.branchId;
          if (oldBranchId && BRANCH_ID_MAP[oldBranchId]) {
            await updateDoc(doc(db, coll, d.id), { branchId: BRANCH_ID_MAP[oldBranchId] });
            recordCount++;
          }
        }
      }

      // Step 3: Update user accessibleBranchIds
      if (user) {
        const userDoc = await getDocs(collection(db, "user"));
        const userRef = userDoc.docs.find((d) => d.id === user.uid);
        if (userRef) {
          const ids = (userRef.data().accessibleBranchIds || []).map((id) => BRANCH_ID_MAP[id] || id);
          await updateDoc(doc(db, "user", user.uid), { accessibleBranchIds: ids });
        }
      }

      addNotification(`Branch IDs renamed. ${recordCount} records updated.`);
      if (onDone) onDone();
    } catch (e) {
      addNotification("Rename failed: " + (e.message || "unknown error"), "error");
    }
    setRenaming(false);
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
        Click below to create branches: <strong>Dhayari, Kirkatwadi, Vadgaon</strong>
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <button className="login-btn" onClick={handleSeed} disabled={seeding} style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
          {seeding ? "Saving..." : "Create Branches"}
        </button>
        <button className="login-btn" onClick={handleRenameBranchIds} disabled={renaming} style={{ background: "var(--purple, #7c3aed)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
          {renaming ? "Renaming..." : "Migrate Old Branch IDs → New"}
        </button>
        <button className="login-btn" onClick={handleMigrate} disabled={migrating} style={{ background: "var(--orange)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
          {migrating ? "Migrating..." : "Assign Missing Branch → Vadgaon"}
        </button>
      </div>
    </div>
  );
}
