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
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const today = new Date();
  const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  useEffect(() => {
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
    });

    return () => unsub();
  }, [dateKey]);

  const handleSave = async (hour: number, code: string) => {
    const docId = `${dateKey}-${hour}`;
    setSaving(docId);
    try {
      if (!code.trim()) {
        // If empty, we could delete it, but setting to empty string works for fallback
        await setDoc(doc(db, "drops", docId), { code: "" });
      } else {
        await setDoc(doc(db, "drops", docId), {
          code: code.toUpperCase(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Error saving code:", error);
    }
    setSaving(null);
  };

  const hours = Array.from({ length: DROP_END_HOUR - DROP_START_HOUR + 1 }, (_, i) => DROP_START_HOUR + i);

  return (
    <main className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-foreground/60 font-medium">Manage hourly voucher codes for {dateKey}</p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
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
                      className="w-full bg-background border-2 border-foreground/10 rounded-xl px-4 py-3 font-mono text-lg focus:border-primary outline-none transition-all placeholder:text-foreground/20"
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
        )}
      </div>
    </main>
  );
}
