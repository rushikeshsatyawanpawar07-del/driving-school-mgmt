import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { enableNetwork, disableNetwork } from "firebase/firestore";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./components/LoginPage";
import OwnerDashboard from "./components/OwnerDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import ClientDashboard from "./components/ClientDashboard";
import { db } from "./firebase";

function ConnectivityBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = async () => {
      setReconnecting(true);
      try {
        await disableNetwork(db);
        await enableNetwork(db);
      } catch { /* ignore */ }
      setOffline(false);
      setReconnecting(false);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    const retry = setInterval(async () => {
      if (navigator.onLine && offline) {
        try {
          await disableNetwork(db);
          await enableNetwork(db);
          setOffline(false);
        } catch { /* ignore */ }
      }
    }, 5000);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      clearInterval(retry);
    };
  }, [offline]);

  if (!offline && !reconnecting) return null;

  return (
    <div className="connectivity-banner">
      {reconnecting
        ? "Reconnecting..."
        : "No internet connection. Check your connection and disable any ad blockers for this site."}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ConnectivityBanner />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/owner-dashboard"
            element={
              <ProtectedRoute allowedRole="owner">
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher-dashboard"
            element={
              <ProtectedRoute allowedRole="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-dashboard"
            element={
              <ProtectedRoute allowedRole="client">
                <ClientDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  );
}
