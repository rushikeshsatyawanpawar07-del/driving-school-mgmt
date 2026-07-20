import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && userRole !== allowedRole) {
    const redirectMap = {
      owner: "/owner-dashboard",
      teacher: "/teacher-dashboard",
      reception: "/reception-dashboard",
      client: "/client-dashboard",
    };
    return <Navigate to={redirectMap[userRole] || "/login"} replace />;
  }

  return children;
}
