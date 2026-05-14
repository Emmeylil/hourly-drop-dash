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
    <main className="min-h-screen bg-background p-6 md:p-12 text-foreground">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Admin Dashboard</h1>
            <p className="opacity-60 font-medium">Manage hourly voucher codes</p>
          </div>
          
          <div className="flex items-center gap-3 bg-card p-2 rounded-2xl shadow-sm border border-foreground/10">
            <button 
              onClick={() => changeDay(-1)}
              className="p-2 hover:bg-foreground/5 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            
            <input 
              type="date" 
              className="bg-transparent border-none font-bold focus:ring-0 outline-none cursor-pointer px-2"
              value={dateKey}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                setSelectedDate(new Date(y, m - 1, d));
              }}
            />

            <button 
              onClick={() => changeDay(1)}
              className="p-2 hover:bg-foreground/5 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
            <strong>Error:</strong> {error}
            <p className="mt-1">Make sure Firestore is enabled and rules are set to allow reads/writes.</p>
          </div>
        )}

        <div className="space-y-4 relative">
          {loading && (
            <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-2xl">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          
          {hours.map((hour) => {
            const hourLabel = hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`;
            const currentCode = codes[String(hour)] || "";
            
            return (
              <div 
                key={hour} 
                className="bg-card rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-foreground/5 shadow-sm"
              >
                <div className="flex-shrink-0 w-24">
                  <span className="text-sm font-bold uppercase tracking-widest text-primary">{hourLabel}</span>
                </div>
                
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    placeholder="Automatic Generation (Default)"
                    className="w-full bg-background border-2 border-foreground/10 rounded-xl px-4 py-3 font-mono text-lg focus:border-primary outline-none transition-all placeholder:opacity-20"
                    value={currentCode}
                    onChange={(e) => setCodes(prev => ({ ...prev, [String(hour)]: e.target.value.toUpperCase() }))}
                  />
                </div>

                <button
                  onClick={() => handleSave(hour, codes[String(hour)] || "")}
                  disabled={saving === `${dateKey}-${hour}`}
                  className="flex-shrink-0 w-full md:w-auto px-8 py-3 rounded-xl bg-foreground text-background font-bold tracking-wide hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  {saving === `${dateKey}-${hour}` ? "Saving..." : "Update"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
