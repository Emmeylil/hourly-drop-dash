import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import confetti from "canvas-confetti";
import { db } from "../lib/firebase";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brand Festival Voucher Drops — Weekdays, 8am & 8pm" },
      {
        name: "description",
        content:
          "Celebrate Jumia Brand Festival! Fresh vouchers drop on the homepage weekdays at 8am and 8pm.",
      },
      { property: "og:title", content: "Brand Festival Voucher Drops — Weekdays, 8am & 8pm" },
      {
        property: "og:description",
        content:
          "Celebrate Jumia Brand Festival! Fresh vouchers drop on the homepage weekdays at 8am and 8pm.",
      },
    ],
  }),
  component: Index,
});

const PARTY_COLORS = ["#F68B1E", "#F5A623", "#8B5CF6", "#7C3AED", "#A855F7", "#ffffff"];

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

const SCHEDULED_HOURS = [8, 20];

const GAME_START_DATE = new Date(2026, 5, 1); // June 1, 2026

function isDropDay(d: Date) {
  const startDay = new Date(GAME_START_DATE);
  startDay.setHours(0, 0, 0, 0);
  const currentDay = new Date(d);
  currentDay.setHours(0, 0, 0, 0);
  if (currentDay.getTime() < startDay.getTime()) return false;

  const day = d.getDay();
  if (day === 0 || day === 6) return false; // Sunday or Saturday

  return true;
}

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

<<<<<<< HEAD
function makeVoucherCode(seed: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let x = seed >>> 0;
  let out = "";
  for (let i = 0; i < 8; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out += alphabet[x % alphabet.length];
  }
  return `BRAND-${out}`;
}

=======
>>>>>>> 30dbb9738176ad2667fb5c6c010ef26666dc97a2
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

  const [scheduleData, setScheduleData] = useState<
    Record<string, { vouchers: { code: string; time: string }[] }>
  >({});

  // Listen for all drops for today
  useEffect(() => {
    fetch(
      "https://docs.google.com/spreadsheets/d/1aY4z4I0denfZyq-wQZA15EZnaARs7FJ5UDEEvIlq_Fg/export?format=csv",
    )
      .then((res) => res.text())
      .then((text) => {
        const rows = text.split("\n").slice(1);
        const data: Record<string, { vouchers: { code: string; time: string }[] }> = {};
        rows.forEach((row) => {
          if (!row.trim()) return;
          const cols = row.split(",");
          if (cols.length < 3) return;
          const code = cols[0].trim();
          const dateStr = cols[1].trim();
          const timeStr = cols[2].trim();

          if (!code || !dateStr || !timeStr) return;

          const rowDate = new Date(dateStr);
          if (isNaN(rowDate.getTime())) return;

          const rowDateKey = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}-${String(rowDate.getDate()).padStart(2, "0")}`;

          if (rowDateKey === dateKey) {
            const timeParts = timeStr.split(" ");
            const time = timeParts[0];
            const modifier = timeParts[1];

            const [h, m] = time.split(":");
            let hourInt = parseInt(h, 10);

            if (modifier) {
              if (modifier.toUpperCase() === "PM" && hourInt < 12) hourInt += 12;
              if (modifier.toUpperCase() === "AM" && hourInt === 12) hourInt = 0;
            }

            const hour = String(hourInt);
            const formattedTime = `${String(hourInt).padStart(2, "0")}:${m || "00"}`;

            if (!data[hour]) data[hour] = { vouchers: [] };
            data[hour].vouchers.push({ code, time: formattedTime });
          }
        });
        setScheduleData(data);
      })
      .catch(console.error);
  }, [dateKey]);

  // Flatten all vouchers into a single timeline
  const timeline = useMemo(() => {
    const allVouchers: { code: string; date: Date }[] = [];

    // Merge custom data
    Object.entries(scheduleData).forEach(([slotHour, slot]) => {
      if (slot.vouchers && slot.vouchers.length > 0) {
        // Add the custom vouchers
        slot.vouchers.forEach((v) => {
          const [h, m] = v.time.split(":").map(Number);
          const d = new Date(now);
          d.setHours(h, m, 0, 0);
          allVouchers.push({ code: v.code, date: d });
        });
      }
    });

    return allVouchers.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [scheduleData, now]);

  const { activeVouchers, next, isLive, isOverridePeriod, secondsToLive } = useMemo(() => {
    const nowTime = now.getTime();

    // Temporary override to repush 8am voucher for 30 minutes from 10:45 AM to 11:16 AM on June 1, 2026
    const isOverride =
      now.getFullYear() === 2026 &&
      now.getMonth() === 5 && // June (0-indexed)
      now.getDate() === 1 &&
      nowTime >= new Date(2026, 5, 1, 10, 45, 0).getTime() &&
      nowTime <= new Date(2026, 5, 1, 11, 16, 0).getTime();

    // Vouchers that have already started
    const pastVouchers = timeline.filter((v) => v.date.getTime() <= nowTime);

    // Find the LATEST drop event
    const latestStartTime =
      pastVouchers.length > 0 ? pastVouchers[pastVouchers.length - 1].date.getTime() : 0;
    const currentSet = pastVouchers.filter((v) => v.date.getTime() === latestStartTime);

    // Extract all voucher codes from the current set and deduplicate them
    const activeVouchers = Array.from(new Set(currentSet.map((v) => v.code)));

    // Find next upcoming voucher
    const futureVouchers = timeline.filter((v) => v.date.getTime() > nowTime);
    let nextDate = futureVouchers[0]?.date;

    if (!nextDate) {
      let nextDay = new Date(now);

      const startDay = new Date(GAME_START_DATE);
      startDay.setHours(0, 0, 0, 0);

      if (now.getTime() < startDay.getTime()) {
        nextDay = new Date(startDay);
        nextDay.setHours(SCHEDULED_HOURS[0], 0, 0, 0);
      } else {
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(SCHEDULED_HOURS[0], 0, 0, 0);
      }

      while (!isDropDay(nextDay)) {
        nextDay.setDate(nextDay.getDate() + 1);
      }

      nextDate = nextDay;
    }

    // Live if we are within 1 hour of the latest drop start time, or if the override is active
    const live = isOverride || (latestStartTime > 0 && nowTime - latestStartTime < 3600000);

    return {
      activeVouchers,
      next: nextDate,
      isLive: live,
      isOverridePeriod: isOverride,
      secondsToLive: Math.max(0, Math.floor((nextDate.getTime() - nowTime) / 1000)),
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
    ? next.toLocaleDateString() === now.toLocaleDateString()
      ? next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : `${next.toLocaleDateString([], { month: "short", day: "numeric" })} @ ${next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "--:--";

  const schedule = SCHEDULED_HOURS;

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
<<<<<<< HEAD
    <main className="w-full max-w-full overflow-x-hidden min-h-screen flex flex-col relative bg-background text-foreground">
      {/* Background Aurora Orbs */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] overflow-hidden -z-10 opacity-60">
        <div className="absolute -top-32 left-1/4 w-[450px] h-[450px] rounded-full bg-[#F68B1E]/20 blur-[120px] animate-pulse" />
        <div className="absolute -top-20 right-1/4 w-[500px] h-[500px] rounded-full bg-[#8B5CF6]/25 blur-[140px] animate-pulse" />
        <div className="absolute top-40 left-1/3 w-[350px] h-[350px] rounded-full bg-[#F5A623]/20 blur-[100px]" />
      </div>

=======
    <main className="w-full max-w-full overflow-x-hidden min-h-screen flex flex-col">
>>>>>>> 30dbb9738176ad2667fb5c6c010ef26666dc97a2
      {/* Top bar */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-6 md:px-12 text-center sm:text-left">
        <div className="flex items-center gap-2.5 font-bold tracking-tight text-foreground">
          <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-r from-[#F68B1E] to-[#8B5CF6] animate-pulse-dot shadow-lg shadow-[#F68B1E]/50" />
          <span className="bg-gradient-to-r from-[#F68B1E] via-[#F5A623] to-[#8B5CF6] bg-clip-text text-transparent font-extrabold text-lg sm:text-xl">
            Brand Festival Drops
          </span>
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 backdrop-blur-md shadow-sm">
          🎉 Weekdays · 8am & 8pm
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pb-16 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.4em] bg-gradient-to-r from-[#F68B1E] via-[#F5A623] to-[#8B5CF6] bg-clip-text text-transparent mb-3 animate-float-in">
          ✨ Celebrating Jumia Brand Festival ✨
        </p>
        <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/80 mb-6 animate-float-in">
          {mounted ? (isLive ? "Drop active now" : "Next drop in") : "Loading drop…"}
        </p>

        <h1 className="sr-only">Brand Festival Hourly Voucher Drops</h1>

        {/* Card with Aurora Gradient Border */}
        <div
          key={next.getTime()}
          className="animate-drop-in relative w-full max-w-xl p-[2px] rounded-2xl sm:rounded-[2.2rem] bg-gradient-to-r from-[#F68B1E] via-[#F5A623] to-[#8B5CF6] shadow-2xl transition-transform"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="w-full h-full rounded-2xl sm:rounded-[2.1rem] bg-[#181427] text-card-foreground px-5 py-8 sm:px-10 sm:py-10 md:px-14 md:py-12 relative overflow-hidden">
            {/* Interior Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[#8B5CF6]/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-[#F68B1E]/20 blur-3xl pointer-events-none" />

            <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-[#F5A623] mb-5 relative z-10">
              {isLive ? "Tap to copy your code" : "Next drop @"}
            </p>

            {!mounted ? (
              <div className="font-mono text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white/40">
                --:--:--
              </div>
            ) : isLive ? (
              <div
                className={`grid gap-4 ${activeVouchers.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
              >
                {activeVouchers.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleCopyVoucher(code)}
                    className="group relative block w-full rounded-2xl border-2 border-dashed border-[#F68B1E]/50 px-3 py-4 sm:px-4 sm:py-6 hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-all shadow-lg"
                    aria-label={`Copy voucher code ${code}`}
                  >
                    <div className="font-mono text-lg sm:text-xl md:text-2xl font-black tracking-[0.12em] text-white group-hover:scale-105 transition-transform break-all uppercase">
                      {code}
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-[#F5A623] font-black">
                      {copiedCode === code ? "✓ Copied to clipboard" : "Tap to copy"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-end justify-center gap-2 sm:gap-4 md:gap-5 font-mono font-bold tabular-nums text-white">
                <TimeBlock value={countdown.h} label="hrs" />
                <span className="text-3xl sm:text-4xl md:text-6xl pb-1 sm:pb-2 text-[#8B5CF6]/60">:</span>
                <TimeBlock value={countdown.m} label="min" />
                <span className="text-3xl sm:text-4xl md:text-6xl pb-1 sm:pb-2 text-[#8B5CF6]/60">:</span>
                <TimeBlock value={countdown.s} label="sec" />
              </div>
            )}

            <div className="mt-6 text-xs uppercase tracking-[0.25em] text-white/60 font-semibold relative z-10">
              {isLive
                ? isOverridePeriod
                  ? "Special extended drop"
                  : "Valid for 1 hour"
                : `Drops at ${nextLabel}`}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handlePopper}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#F68B1E] via-[#F5A623] to-[#8B5CF6] text-white px-8 py-3.5 text-sm font-bold tracking-wide shadow-lg hover:shadow-[#F68B1E]/30 hover:scale-[1.03] active:scale-[0.98] transition-all"
          >
            🎉 Pop the popper
          </button>
        </div>
<<<<<<< HEAD

        {/* Video Embed */}
        <div className="mt-8 w-full max-w-xl px-4 mx-auto">
          <div className="p-1 rounded-2xl bg-gradient-to-r from-[#F68B1E]/30 via-[#F5A623]/20 to-[#8B5CF6]/30 shadow-xl">
            <iframe
              className="w-full max-w-full aspect-video rounded-xl border-none max-h-[315px]"
              style={{
                backgroundColor: "white",
              }}
              src="https://www.youtube.com/embed/Kuszj-QsdS8?si=61QoQdYAuM_ZITnl"
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
=======
>>>>>>> 30dbb9738176ad2667fb5c6c010ef26666dc97a2
      </section>

      {/* Schedule */}
      <section className="px-6 md:px-12 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white/80">
              Today's drop schedule
            </h2>
            <span className="text-xs text-white/60 font-medium">{schedule.length} drops daily</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {schedule.map((hour) => {
              const passed = isDropDay(now) && currentHour > hour;
              const live = isDropDay(now) && currentHour === hour;
              return (
                <div
                  key={hour}
                  className={`rounded-xl px-4 py-3 text-center text-xs font-mono font-semibold transition-all min-w-[85px] sm:min-w-[100px] ${
                    live
                      ? "bg-gradient-to-r from-[#F68B1E] to-[#8B5CF6] text-white scale-105 shadow-lg shadow-[#F68B1E]/30"
                      : passed
                        ? "bg-white/5 text-white/30 line-through border border-white/5"
                        : "bg-white/10 text-white border border-white/10 hover:bg-white/15"
                  }`}
                >
                  {hour > 12 ? `${hour - 12}pm` : hour === 12 ? "12pm" : `${hour}am`}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 text-center text-xs text-white/60 border-t border-white/10">
        Brand Festival Initiative · Drops refresh weekdays at 8am and 8pm
      </footer>
    </main>
  );
}

function TimeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-4xl sm:text-5xl md:text-7xl leading-none">{value}</span>
      <span className="mt-2 text-[8px] sm:text-[10px] uppercase tracking-[0.3em] text-card-foreground/50 font-sans">
        {label}
      </span>
    </div>
  );
}
