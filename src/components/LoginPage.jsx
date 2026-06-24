import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const roles = [
  { value: "owner", label: "Owner" },
  { value: "teacher", label: "Teacher" },
  { value: "client", label: "Client" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("client");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectAfterLogin = async (firebaseUser, role) => {
    const userDoc = await getDoc(doc(db, "user", firebaseUser.uid));
    if (!userDoc.exists()) {
      await auth.signOut();
      throw new Error("No role assigned. Contact the owner.");
    }
    const firestoreRole = userDoc.data().role;
    if (firestoreRole !== role) {
      await auth.signOut();
      throw new Error(`This account is registered as ${firestoreRole}, not ${role}.`);
    }
    const redirectMap = {
      owner: "/owner-dashboard",
      teacher: "/teacher-dashboard",
      client: "/client-dashboard",
    };
    navigate(redirectMap[firestoreRole], { replace: true });
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
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await redirectAfterLogin(userCred.user, selectedRole);
    } catch (err) {
      console.error("Email login error:", err.code, err.message);
      const msg =
        err.code === "auth/invalid-credential"
          ? "Invalid email or password."
          : err.message || "Login failed. Check Firebase authorized domains.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">🚗</div>
          <h1>Driving School</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
              {selectedRole === "client" && <span style={{ fontSize: 12, color: "var(--orange)", marginLeft: 8, fontWeight: 400 }}>(Use Student ID)</span>}
            </label>
            <input
              id="password"
              type="password"
              placeholder={selectedRole === "client" ? "Enter Student ID" : "••••••••"}
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
