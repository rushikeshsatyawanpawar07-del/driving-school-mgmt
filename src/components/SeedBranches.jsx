import { useState, useEffect } from "react";
import { collection, doc, setDoc, updateDoc, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useBranch } from "../context/BranchContext";

const BRANCH_ID_MAP = {
  branch_mumbai: "branch_dhayari",
  branch_nashik: "branch_kirkatwadi",
  branch_pune: "branch_vadgaon",
};

const branchData = [
  { id: "branch_dhayari", name: "Dhayari", code: "DHA", address: "Dhayari Branch", phone: "+91 98765 43211" },
  { id: "branch_kirkatwadi", name: "Kirkatwadi", code: "KIR", address: "Kirkatwadi Branch", phone: "+91 98765 43212" },
  { id: "branch_vadgaon", name: "Vadgaon", code: "VDG", address: "Vadgaon Branch", phone: "+91 98765 43213" },
];

const DELETE_OLD_IDS = ["branch_mumbai", "branch_nashik", "branch_pune"];
const DEFAULT_BRANCH = "branch_vadgaon";

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
      // Step 1: Read branch_pune, create branch_vadgaon with its data, update fields
      const allBranches = await getDocs(collection(db, "branches"));
      const puneDoc = allBranches.docs.find((d) => d.id === "branch_pune");
      if (puneDoc) {
        await setDoc(doc(db, "branches", "branch_vadgaon"), {
          ...puneDoc.data(),
          name: "Vadgaon",
          address: "Vadgaon Branch",
          code: "VDG",
        });
      } else {
        // If branch_pune doesn't exist, create branch_vadgaon from scratch
        await setDoc(doc(db, "branches", "branch_vadgaon"), {
          name: "Vadgaon", code: "VDG", address: "Vadgaon Branch",
          createdAt: new Date().toISOString(),
        });
      }

      // Step 2: Delete old branch docs
      for (const oldId of DELETE_OLD_IDS) {
        const has = allBranches.docs.find((d) => d.id === oldId);
        if (has) {
          await deleteDoc(doc(db, "branches", oldId));
        }
      }

      // Step 3: Update all records referencing old branch IDs to new IDs
      let recordCount = 0;
      for (const coll of ["students", "teachers", "inquiries", "attendance"]) {
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

      // Step 4: Update user accessibleBranchIds
      if (user) {
        const userDoc = await getDocs(collection(db, "user"));
        const userRef = userDoc.docs.find((d) => d.id === user.uid);
        if (userRef) {
          const ids = (userRef.data().accessibleBranchIds || []).map((id) => BRANCH_ID_MAP[id] || id);
          await updateDoc(doc(db, "user", user.uid), { accessibleBranchIds: ids });
        }
      }

      addNotification(`Done. ${recordCount} records updated. Final branches: branch_dhayari, branch_kirkatwadi, branch_vadgaon.`);
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
        Click below to create branches: <strong>branch_dhayari, branch_kirkatwadi, branch_vadgaon</strong>
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
