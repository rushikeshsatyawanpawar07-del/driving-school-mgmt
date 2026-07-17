import { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLoading(false), 8000);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "user", firebaseUser.uid));
          const exists = userDoc.exists();
          const role = exists ? userDoc.data().role : null;
          setUser({ ...firebaseUser, name: exists ? (userDoc.data().name || "User") : "User" });
          setUserRole(role);
        } catch (err) {
          setUser(firebaseUser);
          setUserRole(null);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      setLoading(false);
    });
    return () => { unsubscribe(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
