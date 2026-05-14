import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { doc, setDoc, getDoc, collection, onSnapshot } from "firebase/firestore";

export const Route = createFileRoute("/admin")({
  component: Admin,
});

const DROP_START_HOUR = 8;
const DROP_END_HOUR = 19;

function Admin() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      const unsub = onSnapshot(collection(db, "drops"), (snapshot) => {
        const newCodes: Record<string, string> = {};
        snapshot.forEach((doc) => {
          if (doc.id.startsWith(dateKey)) {
            const hour = doc.id.split("-").pop() || "";
            newCodes[hour] = doc.data().code;
          }
        });
        setCodes(newCodes);
        setLoading(false);
      }, (err) => {
        console.error("Firestore error:", err);
        setError(err.message);
        setLoading(false);
      });

      return () => unsub();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [dateKey]);

  const handleSave = async (hour: number, code: string) => {
    const docId = `${dateKey}-${hour}`;
    setSaving(docId);
    try {
      if (!code.trim()) {
        await setDoc(doc(db, "drops", docId), { code: "" });
      } else {
        await setDoc(doc(db, "drops", docId), {
          code: code.toUpperCase(),
          updatedAt: new Date(),
        });
      }
    } catch (error: any) {
      console.error("Error saving code:", error);
      alert("Error saving: " + error.message);
    }
    setSaving(null);
  };

  const changeDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    setSelectedDate(next);
  };

  const hours = Array.from({ length: DROP_END_HOUR - DROP_START_HOUR + 1 }, (_, i) => DROP_START_HOUR + i);

  return (
    <main className="min-h-screen bg-[#f8fdff] p-6 md:p-12 text-[#1a1a1a]">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 text-[#1a1a1a]">
              Admin <span className="text-[#d48a94]">Dashboard</span>
            </h1>
            <p className="text-[#4a90a4] font-bold uppercase tracking-widest text-xs">Voucher Management System</p>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-xl shadow-blue-900/5 border border-[#4a90a4]/20">
            <button 
              onClick={() => changeDay(-1)}
              className="p-2 hover:bg-[#4a90a4]/10 rounded-xl transition-colors text-[#4a90a4]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            </button>
            
            <input 
              type="date" 
              className="bg-transparent border-none font-bold text-[#1a1a1a] focus:ring-0 outline-none cursor-pointer px-2"
              value={dateKey}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                setSelectedDate(new Date(y, m - 1, d));
              }}
            />

            <button 
              onClick={() => changeDay(1)}
              className="p-2 hover:bg-[#4a90a4]/10 rounded-xl transition-colors text-[#4a90a4]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-5 bg-red-50 border-2 border-red-100 rounded-2xl text-red-600 text-sm font-medium animate-shake">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
          {loading && (
            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-3xl">
              <div className="w-10 h-10 border-4 border-[#d48a94] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          
          {hours.map((hour) => {
            const hourLabel = hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`;
            const currentCode = codes[String(hour)] || "";
            
            return (
              <div 
                key={hour} 
                className="bg-white rounded-[2rem] p-6 flex flex-col gap-4 border border-[#4a90a4]/10 shadow-lg shadow-blue-900/5 hover:shadow-xl hover:border-[#4a90a4]/30 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-[#ff9900]">{hourLabel}</span>
                  <div className={`w-2 h-2 rounded-full ${currentCode ? 'bg-[#d48a94] animate-pulse' : 'bg-gray-200'}`} />
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Auto-Generated"
                    className="w-full bg-[#f8fdff] border-2 border-[#4a90a4]/5 rounded-2xl px-5 py-4 font-mono text-xl font-bold text-[#1a1a1a] focus:border-[#d48a94] focus:bg-white outline-none transition-all placeholder:text-gray-300"
                    value={currentCode}
                    onChange={(e) => setCodes(prev => ({ ...prev, [String(hour)]: e.target.value.toUpperCase() }))}
                  />
                </div>

                <button
                  onClick={() => handleSave(hour, codes[String(hour)] || "")}
                  disabled={saving === `${dateKey}-${hour}`}
                  className="w-full py-4 rounded-2xl bg-[#4a90a4] text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-[#4a90a4]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  {saving === `${dateKey}-${hour}` ? "Syncing..." : "Update Slot"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
