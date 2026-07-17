import { createContext, useContext, useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

const BranchContext = createContext(null);

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(() => {
    try {
      const saved = localStorage.getItem("selectedBranch");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, "branches"), orderBy("name")));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBranches(list);
        setBranchesLoaded(true);
      } catch { setBranchesLoaded(true); }
    };
    load();
  }, []);

  useEffect(() => {
    try {
      if (selectedBranch) {
        localStorage.setItem("selectedBranch", JSON.stringify(selectedBranch));
      } else {
        localStorage.removeItem("selectedBranch");
      }
    } catch { /* localStorage unavailable (e.g. private browsing) */ }
  }, [selectedBranch]);

  return (
    <BranchContext.Provider value={{ branches, setBranches, branchesLoaded, selectedBranch, setSelectedBranch }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
}
