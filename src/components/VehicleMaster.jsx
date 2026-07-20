import { useState, useEffect, useRef } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Car } from "lucide-react";
import { useNotification } from "../context/NotificationContext";

const DEFAULT_VEHICLES = [
  { name: "WagonR", price: 8500, type: "Four Wheeler" },
  { name: "Swift Dzire", price: 9500, type: "Four Wheeler" },
  { name: "Brezza", price: 10500, type: "Four Wheeler" },
  { name: "Seltos", price: 13500, type: "Four Wheeler" },
];

export default function VehicleMaster() {
  const { addNotification } = useNotification();
  const [vehicles, setVehicles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [localForm, setLocalForm] = useState({ name: "", price: "", type: "Four Wheeler" });
  const seeded = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vehicles"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setVehicles(list);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (vehicles.length === 0 && !seeded.current) {
      seeded.current = true;
      const now = Date.now();
      (async () => {
        for (const v of DEFAULT_VEHICLES) {
          try {
            await addDoc(collection(db, "vehicles"), {
              ...v,
              active: true,
              createdAt: now,
              updatedAt: now,
            });
          } catch (e) {
            // will be caught by the next snapshot
          }
        }
      })();
    }
  }, [vehicles]);

  const resetForm = () => {
    setLocalForm({ name: "", price: "", type: "Four Wheeler" });
    setEditId(null);
    setShowForm(false);
  };

  const handleSaveVehicle = async () => {
    const name = localForm.name.trim();
    const price = Math.max(0, Number(localForm.price) || 0);
    if (!name) { addNotification("Vehicle name is required", "error"); return; }
    if (!localForm.price || price <= 0) { addNotification("Price must be greater than 0", "error"); return; }
    if (!localForm.type) { addNotification("Vehicle type is required", "error"); return; }
    if (!editId && vehicles.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      addNotification(`Vehicle "${name}" already exists`, "error");
      return;
    }
    if (editId && vehicles.some((v) => v.id !== editId && v.name.toLowerCase() === name.toLowerCase())) {
      addNotification(`Vehicle "${name}" already exists`, "error");
      return;
    }
    try {
      const now = Date.now();
      if (editId) {
        await updateDoc(doc(db, "vehicles", editId), { name, price, type: localForm.type, updatedAt: now });
        addNotification("Vehicle updated");
      } else {
        await addDoc(collection(db, "vehicles"), {
          name, price, type: localForm.type, active: true, createdAt: now, updatedAt: now,
        });
        addNotification("Vehicle added");
      }
      resetForm();
    } catch (e) {
      addNotification("Failed: " + (e.message || "unknown error"), "error");
    }
  };

  const handleEditVehicle = (v) => {
    setLocalForm({ name: v.name, price: v.price, type: v.type || "Four Wheeler" });
    setEditId(v.id);
    setShowForm(true);
  };

  const handleDeleteVehicle = async (id) => {
    try {
      await deleteDoc(doc(db, "vehicles", id));
      addNotification("Vehicle deleted");
    } catch (e) {
      addNotification("Failed: " + (e.message || "unknown error"), "error");
    }
  };

  return (
    <div className="form-section" style={{ marginTop: 16 }}>
      <div className="form-section-header">
        <Car size={20} />
        <h3>Vehicle Master</h3>
        <button type="button" className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? "Close" : vehicles.length > 0 ? "Manage Vehicles" : "Add Vehicles"}
        </button>
      </div>
      {showForm && (
        <div style={{ background: "var(--gray-50)", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div className="form-row" style={{ gap: 8 }}>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Vehicle Name</label>
              <input className="form-input" value={localForm.name} onChange={(e) => setLocalForm({ ...localForm, name: e.target.value })} placeholder="e.g. WagonR" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Price (₹)</label>
              <input className="form-input" type="number" value={localForm.price} onChange={(e) => setLocalForm({ ...localForm, price: e.target.value })} placeholder="8500" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Type</label>
              <select className="form-input" value={localForm.type} onChange={(e) => setLocalForm({ ...localForm, type: e.target.value })}>
                <option value="Four Wheeler">Four Wheeler</option>
                <option value="Two Wheeler">Two Wheeler</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 0, alignSelf: "flex-end" }}>
              <button type="button" className="btn btn-primary" onClick={handleSaveVehicle} style={{ padding: "9px 16px" }}>
                {editId ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
      {vehicles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {vehicles.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--gray-50)", padding: "6px 12px", borderRadius: 6, fontSize: 13 }}>
              <span><strong>{v.name}</strong> — ₹{v.price}</span>
              <button type="button" className="btn btn-sm" onClick={() => handleEditVehicle(v)} style={{ padding: "2px 8px", fontSize: 11 }} title="Edit">✎</button>
              <button type="button" className="btn btn-sm" onClick={() => handleDeleteVehicle(v.id)} style={{ padding: "2px 8px", fontSize: 11, color: "var(--danger)" }} title="Delete">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
