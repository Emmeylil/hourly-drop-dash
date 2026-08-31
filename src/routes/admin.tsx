import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, auth } from "../lib/firebase";
import { doc, setDoc, getDoc, collection, onSnapshot } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User } from "firebase/auth";

export const Route = createFileRoute("/admin")({
  component: Admin,
});

const SCHEDULED_HOURS = [8, 20];
function Admin() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [slots, setSlots] = useState<
    Record<string, { vouchers: { code: string; time: string }[] }>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setAuthError("Invalid email or password.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      const unsub = onSnapshot(
        collection(db, "drops"),
        (snapshot) => {
          const newSlots: Record<string, { vouchers: { code: string; time: string }[] }> = {};
          snapshot.forEach((doc) => {
            if (doc.id.startsWith(dateKey)) {
              const hour = doc.id.split("-").pop() || "";
              const data = doc.data();

              let vouchers: { code: string; time: string }[] = [];
              if (Array.isArray(data.vouchers)) {
                vouchers = data.vouchers;
              } else if (Array.isArray(data.codes)) {
                // Migration path from previous array-only schema
                vouchers = data.codes.map((c: string) => ({
                  code: c,
                  time: data.startTime || `${hour.padStart(2, "0")}:00`,
                }));
              } else if (data.code) {
                vouchers = [
                  { code: data.code, time: data.startTime || `${hour.padStart(2, "0")}:00` },
                ];
              }

              newSlots[hour] = { vouchers };
            }
          });
          setSlots(newSlots);
          setLoading(false);
        },
        (err) => {
          console.error("Firestore error:", err);
          setError(err.message);
          setLoading(false);
        },
      );

      return () => unsub();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [dateKey]);

  const handleSave = async (hour: number, vouchers: { code: string; time: string }[]) => {
    const docId = `${dateKey}-${hour}`;
    setSaving(docId);
    try {
      const filteredVouchers = vouchers
        .filter((v) => v.code.trim() !== "")
        .map((v) => ({ code: v.code.toUpperCase(), time: v.time }));

      await setDoc(doc(db, "drops", docId), {
        vouchers: filteredVouchers,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error saving slot:", error);
      alert("Error saving: " + (error instanceof Error ? error.message : String(error)));
    }
    setSaving(null);
  };

  const changeDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    setSelectedDate(next);
  };

  const hours = SCHEDULED_HOURS;

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#0f0d1a] flex items-center justify-center p-6 text-white">
        <div className="w-10 h-10 border-4 border-[#F68B1E] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0f0d1a] flex items-center justify-center p-6 text-white">
        <form
          onSubmit={handleLogin}
          className="bg-[#181427] border border-[#8B5CF6]/30 rounded-2xl sm:rounded-[2rem] p-6 sm:p-8 w-full max-w-md shadow-2xl"
        >
          <div className="mb-6 text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-[#F68B1E]/10 border border-[#F68B1E]/30 text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-2">
              Jumia Brand Festival
            </span>
            <h1 className="text-3xl font-black text-white">Admin Login</h1>
          </div>
          {authError && <div className="mb-4 text-red-400 text-sm font-bold text-center">{authError}</div>}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#F5A623] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#241c3a] border-2 border-[#8B5CF6]/20 rounded-xl px-4 py-3 font-bold text-sm text-white outline-none focus:border-[#F68B1E]"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#F5A623] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#241c3a] border-2 border-[#8B5CF6]/20 rounded-xl px-4 py-3 font-bold text-sm text-white outline-none focus:border-[#F68B1E]"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-[#F68B1E] via-[#F5A623] to-[#8B5CF6] text-white font-black uppercase tracking-widest text-xs disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-[#F68B1E]/20"
          >
            {authLoading ? "Logging in..." : "Login"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0d1a] p-6 md:p-12 text-white">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 text-white">
              Admin <span className="bg-gradient-to-r from-[#F68B1E] to-[#8B5CF6] bg-clip-text text-transparent">Dashboard</span>
            </h1>
            <p className="text-[#F5A623] font-bold uppercase tracking-widest text-xs">
              Brand Festival Voucher Management System
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            <button
              onClick={handleLogout}
              className="px-4 py-3 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-bold uppercase tracking-widest text-[10px] text-center border border-white/10"
            >
              Logout
            </button>
            <div className="flex items-center justify-between sm:justify-start gap-3 bg-[#181427] p-3 rounded-2xl shadow-xl border border-[#8B5CF6]/30">
              <button
                onClick={() => changeDay(-1)}
                className="p-2 hover:bg-[#8B5CF6]/20 rounded-xl transition-colors text-[#F5A623]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <input
                type="date"
                className="bg-transparent border-none font-bold text-white focus:ring-0 outline-none cursor-pointer px-2"
                value={dateKey}
                onChange={(e) => {
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  setSelectedDate(new Date(y, m - 1, d));
                }}
              />

              <button
                onClick={() => changeDay(1)}
                className="p-2 hover:bg-[#8B5CF6]/20 rounded-xl transition-colors text-[#F5A623]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-5 bg-red-950/40 border-2 border-red-800 rounded-2xl text-red-300 text-sm font-medium animate-shake">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-6 relative">
          {loading && (
            <div className="absolute inset-0 z-10 bg-[#0f0d1a]/80 backdrop-blur-sm flex items-center justify-center rounded-3xl">
              <div className="w-10 h-10 border-4 border-[#F68B1E] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {hours.map((hour) => {
            const slotData = slots[String(hour)] || { vouchers: [] };
            const hourLabel = hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`;

            // Ensure we always have 5 voucher inputs
            const displayVouchers = Array.from({ length: 5 }).map((_, i) => {
              return (
                slotData.vouchers[i] || { code: "", time: `${String(hour).padStart(2, "0")}:00` }
              );
            });

            return (
              <div
                key={hour}
                className="bg-[#181427] rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 border border-[#8B5CF6]/30 shadow-lg shadow-purple-950/20 transition-all group"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="text-sm font-black uppercase tracking-[0.4em] text-white">
                    {hourLabel}
                  </span>
                  <div
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${slotData.vouchers.length > 0 ? "bg-[#F68B1E]/20 text-[#F5A623] border border-[#F68B1E]/30" : "bg-white/5 text-white/40"}`}
                  >
                    {slotData.vouchers.filter((v) => v.code).length} Scheduled
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                  {displayVouchers.map((v, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 p-4 bg-[#241c3a] rounded-2xl border border-[#8B5CF6]/15"
                    >
                      <div>
                        <label className="text-[9px] font-bold uppercase text-[#F5A623] mb-1 block">
                          Code
                        </label>
                        <input
                          type="text"
                          placeholder="Voucher code"
                          className="w-full bg-[#181427] border border-[#8B5CF6]/30 rounded-xl px-3 py-2 font-mono text-sm font-bold text-white focus:border-[#F68B1E] outline-none transition-all"
                          value={v.code}
                          onChange={(e) => {
                            const nextVouchers = [...displayVouchers];
                            nextVouchers[idx] = {
                              ...nextVouchers[idx],
                              code: e.target.value.toUpperCase(),
                            };
                            setSlots((prev) => ({
                              ...prev,
                              [String(hour)]: { vouchers: nextVouchers },
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase text-[#F5A623] mb-1 block">
                          Live At
                        </label>
                        <input
                          type="time"
                          className="w-full bg-[#181427] border border-[#8B5CF6]/30 rounded-xl px-3 py-2 text-sm font-black text-white focus:border-[#F68B1E] outline-none transition-all"
                          value={v.time}
                          onChange={(e) => {
                            const nextVouchers = [...displayVouchers];
                            nextVouchers[idx] = { ...nextVouchers[idx], time: e.target.value };
                            setSlots((prev) => ({
                              ...prev,
                              [String(hour)]: { vouchers: nextVouchers },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSave(hour, slots[String(hour)]?.vouchers || displayVouchers)}
                  disabled={saving === `${dateKey}-${hour}`}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#F68B1E] via-[#F5A623] to-[#8B5CF6] text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-[#F68B1E]/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all"
                >
                  {saving === `${dateKey}-${hour}` ? "Syncing..." : "Update Schedule Set"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
