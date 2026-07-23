import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useBranch } from "../context/BranchContext";
import { SCHOOL } from "../config/schoolConfig";

const roles = [
  { value: "owner", label: "Owner" },
  { value: "teacher", label: "Teacher" },
  { value: "reception", label: "Reception" },
  { value: "client", label: "Client" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { setSelectedBranch } = useBranch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("client");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [pendingRole, setPendingRole] = useState(null);
  const [branchOptions, setBranchOptions] = useState([]);
  const [selectingBranch, setSelectingBranch] = useState(false);

  useEffect(() => {
    if (pendingUser && branchOptions.length === 1) {
      setSelectedBranch(branchOptions[0]);
      setPendingUser(null);
      const redirectMap = {
        owner: "/owner-dashboard",
        teacher: "/teacher-dashboard",
        client: "/client-dashboard",
      };
      navigate(redirectMap[pendingRole], { replace: true });
    }
  }, [branchOptions, pendingUser, pendingRole, navigate, setSelectedBranch]);

  const redirectAfterLogin = async (firebaseUser, role) => {
    const userDoc = await getDoc(doc(db, "user", firebaseUser.uid));
    if (!userDoc.exists()) {
      await auth.signOut();
      throw new Error("No role assigned. Contact the owner.");
    }
    const userData = userDoc.data();
    if (userData.role !== role) {
      await auth.signOut();
      throw new Error(`This account is registered as ${userData.role}, not ${role}.`);
    }
    if (role === "teacher") {
      const tSnap = await getDoc(doc(db, "teachers", firebaseUser.uid));
      if (tSnap.exists() && tSnap.data().status === "inactive") {
        await auth.signOut();
        throw new Error("Your account has been disabled. Contact the owner.");
      }
    }
    if (role === "reception") {
      const rSnap = await getDoc(doc(db, "receptionists", firebaseUser.uid));
      if (rSnap.exists() && rSnap.data().status === "inactive") {
        await auth.signOut();
        throw new Error("Your account has been disabled. Contact the owner.");
      }
    }
    if (role === "client") {
      navigate("/client-dashboard", { replace: true });
      return;
    }
    const branchIds = userData.accessibleBranchIds || [];
    const dashPath = (r) => ({ owner: "/owner-dashboard", teacher: "/teacher-dashboard", reception: "/reception-dashboard" })[r] || "/login";
    if (branchIds.length === 0) {
      navigate(dashPath(role), { replace: true });
      return;
    }
    const branchData = [];
    for (const id of branchIds) {
      const snap = await getDoc(doc(db, "branches", id));
      if (snap.exists()) branchData.push({ id, ...snap.data() });
    }
    if (branchData.length === 0) {
      navigate(dashPath(role), { replace: true });
      return;
    }
    if (branchData.length === 1) {
      setSelectedBranch(branchData[0]);
      const redirectMap = { owner: "/owner-dashboard", teacher: "/teacher-dashboard", reception: "/reception-dashboard" };
      navigate(redirectMap[role], { replace: true });
      return;
    }
    setPendingUser(firebaseUser);
    setPendingRole(role);
    setBranchOptions(branchData);
    setSelectingBranch(true);
  };

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    setSelectingBranch(false);
    setPendingUser(null);
    const redirectMap = { owner: "/owner-dashboard", teacher: "/teacher-dashboard", reception: "/reception-dashboard" };
    navigate(redirectMap[pendingRole], { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      const loginEmail = selectedRole === "client" ? `${email.toLowerCase()}@s.drive` : email;
      const userCred = await signInWithEmailAndPassword(auth, loginEmail, password);
      await redirectAfterLogin(userCred.user, selectedRole);
    } catch (err) {
      const msg =
        err.code === "auth/invalid-credential"
          ? "Invalid Student ID or Phone Number."
          : err.message || "Login failed. Check Firebase authorized domains.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (selectingBranch) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <h1>{SCHOOL.name}</h1>
            <p>Select a branch to continue</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {branchOptions.map((b) => (
              <button
                key={b.id}
                className="login-btn"
                onClick={() => handleBranchSelect(b)}
                style={{ background: "var(--primary)", color: "#fff", border: "none", padding: 14, borderRadius: 8, fontSize: 16, cursor: "pointer" }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
            <div className="login-icon" style={{ display: "flex", justifyContent: "center" }}><img src="/logo.jpeg" alt={SCHOOL.name} style={{ width: 200, height: 200, objectFit: "contain" }} /></div>
          <h1>{SCHOOL.name}</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">
              {selectedRole === "client" ? "Student ID" : "Email"}
            </label>
            <input
              id="email"
              type={selectedRole === "client" ? "text" : "email"}
              placeholder={selectedRole === "client" ? "e.g. DH1001" : "you@example.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
              {selectedRole === "client" && <span style={{ fontSize: 12, color: "var(--orange)", marginLeft: 8, fontWeight: 400 }}>(Use Phone Number)</span>}
            </label>
            <input
              id="password"
              type="password"
              placeholder={selectedRole === "client" ? "Enter Phone Number" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Login as</label>
            <select
              id="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
