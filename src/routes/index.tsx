import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import confetti from "canvas-confetti";
import { db } from "../lib/firebase";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anniversary Voucher Drops — Hourly, 8am to 7pm" },
      { name: "description", content: "Celebrate our anniversary! Fresh vouchers drop on the homepage every hour from 8am to 7pm." },
      { property: "og:title", content: "Anniversary Voucher Drops — Hourly, 8am to 7pm" },
      { property: "og:description", content: "Celebrate our anniversary! Fresh vouchers drop on the homepage every hour from 8am to 7pm." },
    ],
  }),
  component: Index,
});

const PARTY_COLORS = ["#ff5e3a", "#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#ffffff"];

function fireConfetti() {
  if (typeof window === "undefined") return;
  const end = Date.now() + 800;
  const frame = () => {
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 70,
      startVelocity: 55,
      origin: { x: 0, y: 0.9 },
      colors: PARTY_COLORS,
      scalar: 1.1,
    });
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 70,
      startVelocity: 55,
      origin: { x: 1, y: 0.9 },
      colors: PARTY_COLORS,
      scalar: 1.1,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

function popperBurst() {
  if (typeof window === "undefined") return;
  confetti({
    particleCount: 120,
    spread: 100,
    startVelocity: 45,
    origin: { y: 0.6 },
    colors: PARTY_COLORS,
    shapes: ["square", "circle"],
    scalar: 1.2,
  });
}

const DROP_START_HOUR = 8;
const DROP_END_HOUR = 19; // 7pm — last drop at 19:00


function formatCountdown(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

function makeVoucherCode(seed: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let x = seed >>> 0;
  let out = "";
  for (let i = 0; i < 8; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out += alphabet[x % alphabet.length];
  }
  return `ANNIV-${out}`;
}

function Index() {
  const [now, setNow] = useState<Date>(() => new Date());
  const [mounted, setMounted] = useState(false);
  const lastLiveRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const currentHour = now.getHours();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const docId = `${dateKey}-${currentHour}`;

  const [scheduleData, setScheduleData] = useState<Record<string, { vouchers: { code: string, time: string }[] }>>({});

  // Listen for all drops for today
  useEffect(() => {
    const q = query(collection(db, "drops"), where("__name__", ">=", dateKey), where("__name__", "<=", `${dateKey}-\uf8ff`));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Record<string, { vouchers: { code: string, time: string }[] }> = {};
      snapshot.forEach((doc) => {
        const hour = doc.id.split("-").pop() || "";
        const d = doc.data();
        
        let vouchers: { code: string, time: string }[] = [];
        if (Array.isArray(d.vouchers)) {
          vouchers = d.vouchers;
        } else if (Array.isArray(d.codes)) {
          vouchers = d.codes.map((c: string) => ({ code: c, time: d.startTime || `${hour.padStart(2, '0')}:00` }));
        } else if (d.code) {
          vouchers = [{ code: d.code, time: d.startTime || `${hour.padStart(2, '0')}:00` }];
        }
        
        data[hour] = { vouchers };
      });
      setScheduleData(data);
    });
    return () => unsub();
  }, [dateKey]);

  // Flatten all vouchers into a single timeline
  const timeline = useMemo(() => {
    const allVouchers: { code: string, date: Date }[] = [];
    
    // 1. Generate default hourly schedule first
    for (let hour = DROP_START_HOUR; hour <= DROP_END_HOUR; hour++) {
      const d = new Date(now);
      d.setHours(hour, 0, 0, 0);
      allVouchers.push({ 
        code: makeVoucherCode(Array.from(`${dateKey}-${hour}`).reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7)), 
        date: d,
        isDefault: true
      });
    }

    // 2. Merge custom data
    Object.entries(scheduleData).forEach(([slotHour, slot]) => {
      if (slot.vouchers && slot.vouchers.length > 0) {
        // Remove default vouchers for this specific slot hour if custom ones exist
        const hInt = parseInt(slotHour);
        const filtered = allVouchers.filter(v => v.date.getHours() !== hInt || !v.isDefault);
        allVouchers.length = 0;
        allVouchers.push(...filtered);

        // Add the custom vouchers
        slot.vouchers.forEach(v => {
          const [h, m] = v.time.split(":").map(Number);
          const d = new Date(now);
          d.setHours(h, m, 0, 0);
          allVouchers.push({ code: v.code, date: d, isDefault: false });
        });
      }
    });

    return allVouchers.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [scheduleData, now, dateKey]);

  const { activeVoucherCode, next, isLive, secondsToLive } = useMemo(() => {
    const nowTime = now.getTime();
    
    // Vouchers that have already started
    const pastVouchers = timeline.filter(v => v.date.getTime() <= nowTime);
    
    // Find the LATEST drop event
    const latestStartTime = pastVouchers.length > 0 ? pastVouchers[pastVouchers.length - 1].date.getTime() : 0;
    const currentSet = pastVouchers.filter(v => v.date.getTime() === latestStartTime);
    
    // Pick ONE random code from the current set (using a stable seed based on startTime and browser/device if possible, 
    // but for now just random is fine as requested)
    const randomCode = currentSet.length > 0 
      ? currentSet[Math.floor((latestStartTime % 1000 + (typeof window !== 'undefined' ? window.navigator.userAgent.length : 0)) % currentSet.length)].code 
      : "";

    // Find next upcoming voucher
    const futureVouchers = timeline.filter(v => v.date.getTime() > nowTime);
    let nextDate = futureVouchers[0]?.date;
    
    if (!nextDate) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(DROP_START_HOUR, 0, 0, 0);
      nextDate = tomorrow;
    }

    // Live if we are within 20 seconds of ANY voucher's start time
    const live = timeline.some(v => {
      const diff = nowTime - v.date.getTime();
      return diff >= 0 && diff < 20000; // 20 seconds window
    });

    return {
      activeVoucherCode: randomCode,
      next: nextDate,
      isLive: live,
      secondsToLive: Math.max(0, Math.floor((nextDate.getTime() - nowTime) / 1000))
    };
  }, [timeline, now]);

  // Auto-pop on first mount
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => {
      popperBurst();
      fireConfetti();
    }, 250);
    return () => clearTimeout(t);
  }, [mounted]);

  // Pop again when a drop goes LIVE
  useEffect(() => {
    if (!mounted) return;
    if (isLive && !lastLiveRef.current) {
      fireConfetti();
      popperBurst();
    }
    lastLiveRef.current = isLive;
  }, [isLive, mounted]);

  const countdown = formatCountdown(secondsToLive);
  const nextLabel = mounted
    ? next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "--:--";

  const schedule = Array.from({ length: DROP_END_HOUR - DROP_START_HOUR + 1 }, (_, i) => DROP_START_HOUR + i);

  const handlePopper = useCallback(() => popperBurst(), []);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyVoucher = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      popperBurst();
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setCopiedCode(null);
    }
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-card animate-pulse-dot" />
          Anniversary Voucher Drop
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-foreground/70">
          🎉 Hourly · 8am – 7pm
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pb-16 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-card mb-3 animate-float-in">
          🎊 Celebrating our anniversary 🎊
        </p>
        <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-card mb-6 animate-float-in">
          {mounted ? (isLive ? "Drop active now" : "Next drop in") : "Loading drop…"}
        </p>

        <h1 className="sr-only">Anniversary Hourly Voucher Drops</h1>

        {/* Card */}
        <div
          key={next.getTime()}
          className="animate-drop-in relative w-full max-w-xl rounded-[2rem] bg-card text-card-foreground px-8 py-10 md:px-14 md:py-12"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.4em] text-primary mb-5">
            {isLive ? "Tap to copy your code" : "Next drop @"}
          </p>

          {!mounted ? (
            <div className="font-mono text-5xl md:text-7xl font-bold tracking-tight text-card-foreground/40">
              --:--:--
            </div>
          ) : isLive ? (
            <button
              type="button"
              onClick={() => handleCopyVoucher(activeVoucherCode)}
              className="group block w-full rounded-2xl border-2 border-dashed border-primary/50 px-4 py-8 hover:border-primary transition-colors"
              aria-label={`Copy voucher code ${activeVoucherCode}`}
            >
              <div className="font-mono text-3xl md:text-5xl font-bold tracking-[0.15em] text-card-foreground break-all uppercase">
                {activeVoucherCode}
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.3em] text-primary font-semibold">
                {copiedCode === activeVoucherCode ? "✓ Copied to clipboard" : "Tap to copy"}
              </div>
            </button>
          ) : (
            <div className="flex items-end justify-center gap-3 md:gap-5 font-mono font-bold tabular-nums text-card-foreground">
              <TimeBlock value={countdown.h} label="hrs" />
              <span className="text-4xl md:text-6xl pb-2 opacity-40">:</span>
              <TimeBlock value={countdown.m} label="min" />
              <span className="text-4xl md:text-6xl pb-2 opacity-40">:</span>
              <TimeBlock value={countdown.s} label="sec" />
            </div>
          )}

          <div className="mt-6 text-xs uppercase tracking-[0.25em] text-card-foreground/50">
            {isLive ? "Valid until next drop" : `Drops at ${nextLabel}`}
          </div>
        </div>



        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handlePopper}
            className="inline-flex items-center gap-2 rounded-full bg-foreground/10 text-foreground px-7 py-3.5 text-sm font-semibold tracking-wide hover:bg-foreground/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            🎉 Pop the popper
          </button>
        </div>
      </section>

      {/* Schedule */}
      <section className="px-6 md:px-12 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-foreground/80">
              Today's drop schedule
            </h2>
            <span className="text-xs text-foreground/60">{schedule.length} drops · 1 per hour</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
            {schedule.map((hour) => {
              const passed = currentHour > hour;
              const live = currentHour === hour;
              return (
                <div
                  key={hour}
                  className={`rounded-xl px-2 py-3 text-center text-xs font-mono font-semibold transition-all ${
                    live
                      ? "bg-card text-card-foreground scale-105"
                      : passed
                        ? "bg-foreground/5 text-foreground/40 line-through"
                        : "bg-foreground/10 text-foreground"
                  }`}
                  style={live ? { boxShadow: "var(--shadow-card)" } : undefined}
                >
                  {hour > 12 ? `${hour - 12}pm` : hour === 12 ? "12pm" : `${hour}am`}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 text-center text-xs text-foreground/60 border-t border-foreground/10">
        Voucher Drop Initiative · Drops refresh every hour, on the hour
      </footer>
    </main>
  );
}

function TimeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-5xl md:text-7xl leading-none">{value}</span>
      <span className="mt-2 text-[10px] uppercase tracking-[0.3em] text-card-foreground/50 font-sans">
        {label}
      </span>
    </div>
  );
}
