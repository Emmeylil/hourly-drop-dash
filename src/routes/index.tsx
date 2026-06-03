import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import confetti from "canvas-confetti";
import { db } from "../lib/firebase";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anniversary Voucher Drops — Weekdays, 8am & 8pm" },
      {
        name: "description",
        content:
          "Celebrate our anniversary! Fresh vouchers drop on the homepage weekdays at 8am and 8pm.",
      },
      { property: "og:title", content: "Anniversary Voucher Drops — Weekdays, 8am & 8pm" },
      {
        property: "og:description",
        content:
          "Celebrate our anniversary! Fresh vouchers drop on the homepage weekdays at 8am and 8pm.",
      },
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
    const allVouchers: { code: string; date: Date; isDefault?: boolean }[] = [];

    // 1. Generate default schedule first
    if (isDropDay(now)) {
      for (const hour of SCHEDULED_HOURS) {
        const d = new Date(now);
        d.setHours(hour, 0, 0, 0);
        allVouchers.push({
          code: makeVoucherCode(
            Array.from(`${dateKey}-${hour}`).reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7),
          ),
          date: d,
          isDefault: true,
        });
      }
    }

    // 2. Merge custom data
    Object.entries(scheduleData).forEach(([slotHour, slot]) => {
      if (slot.vouchers && slot.vouchers.length > 0) {
        // Remove default vouchers for this specific slot hour if custom ones exist
        const hInt = parseInt(slotHour);
        const filtered = allVouchers.filter((v) => v.date.getHours() !== hInt || !v.isDefault);
        allVouchers.length = 0;
        allVouchers.push(...filtered);

        // Add the custom vouchers
        slot.vouchers.forEach((v) => {
          const [h, m] = v.time.split(":").map(Number);
          const d = new Date(now);
          d.setHours(h, m, 0, 0);
          allVouchers.push({ code: v.code, date: d, isDefault: false });
        });
      }
    });

    return allVouchers.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [scheduleData, now, dateKey]);

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
    <main className="w-full max-w-full overflow-x-hidden min-h-screen flex flex-col">
      {/* Banner */}
      <div className="w-full max-w-full sm:max-w-5xl mx-auto px-4 pt-4">
        <picture className="block w-full max-w-full h-auto rounded-xl overflow-hidden shadow-md">
          <source
            media="(max-width: 768px)"
            srcSet="https://ng.jumia.is/cms/0-6-anniversary/2026/Initiatives/Voucher-drop/730x292.gif"
          />
          <img
            src="https://ng.jumia.is/cms/0-6-anniversary/2026/Initiatives/Voucher-drop/1152x252.gif"
            alt="Anniversary Voucher Drop Banner"
            className="block w-full max-w-full h-auto"
          />
        </picture>
      </div>

      {/* Top bar */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-6 md:px-12 text-center sm:text-left">
        <div className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-card animate-pulse-dot" />
          Anniversary Voucher Drop
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-foreground/70">
          🎉 Weekdays · 8am & 8pm
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
          className="animate-drop-in relative w-full max-w-xl rounded-2xl sm:rounded-[2rem] bg-card text-card-foreground px-5 py-8 sm:px-10 sm:py-10 md:px-14 md:py-12"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.4em] text-primary mb-5">
            {isLive ? "Tap to copy your code" : "Next drop @"}
          </p>

          {!mounted ? (
            <div className="font-mono text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-card-foreground/40">
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
                  className="group block w-full rounded-2xl border-2 border-dashed border-primary/50 px-3 py-4 sm:px-4 sm:py-6 hover:border-primary transition-colors"
                  aria-label={`Copy voucher code ${code}`}
                >
                  <div className="font-mono text-lg sm:text-xl md:text-2xl font-bold tracking-[0.1em] text-card-foreground break-all uppercase">
                    {code}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">
                    {copiedCode === code ? "✓ Copied to clipboard" : "Tap to copy"}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-end justify-center gap-2 sm:gap-4 md:gap-5 font-mono font-bold tabular-nums text-card-foreground">
              <TimeBlock value={countdown.h} label="hrs" />
              <span className="text-3xl sm:text-4xl md:text-6xl pb-1 sm:pb-2 opacity-40">:</span>
              <TimeBlock value={countdown.m} label="min" />
              <span className="text-3xl sm:text-4xl md:text-6xl pb-1 sm:pb-2 opacity-40">:</span>
              <TimeBlock value={countdown.s} label="sec" />
            </div>
          )}

          <div className="mt-6 text-xs uppercase tracking-[0.25em] text-card-foreground/50">
            {isLive
              ? isOverridePeriod
                ? "Special extended drop"
                : "Valid for 1 hour"
              : `Drops at ${nextLabel}`}
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

        {/* Video Embed */}
        <div className="mt-8 w-full max-w-xl px-4 mx-auto">
          <iframe
            className="w-full max-w-full aspect-video md:w-[103%] md:translate-x-[-1.5%] bg-white p-2 rounded border-none max-h-[315px]"
            style={{
              backgroundColor: "white",
            }}
            src="https://www.youtube.com/embed/Kuszj-QsdS8?si=61QoQdYAuM_ZITnl"
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </section>

      {/* Schedule */}
      <section className="px-6 md:px-12 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-foreground/80">
              Today's drop schedule
            </h2>
            <span className="text-xs text-foreground/60">{schedule.length} drops daily</span>
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
        Voucher Drop Initiative · Drops refresh weekdays at 8am and 8pm
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
