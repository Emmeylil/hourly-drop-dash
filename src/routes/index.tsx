import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

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

function getNextDrop(now: Date): { next: Date; isLive: boolean; secondsToLive: number } {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(now.getHours() + 1);

  // If current time is within an active drop hour and just started (first 60s), treat as LIVE
  const isLive =
    now.getHours() >= DROP_START_HOUR &&
    now.getHours() <= DROP_END_HOUR &&
    now.getMinutes() === 0 &&
    now.getSeconds() < 60;

  // If next drop is past end-of-day, jump to tomorrow 8am
  if (next.getHours() > DROP_END_HOUR || next.getHours() < DROP_START_HOUR) {
    next.setDate(next.getDate() + (now.getHours() >= DROP_END_HOUR ? 1 : 0));
    next.setHours(DROP_START_HOUR, 0, 0, 0);
  }

  const secondsToLive = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
  return { next, isLive, secondsToLive };
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

function Index() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { next, isLive, secondsToLive } = getNextDrop(now);
  const countdown = formatCountdown(secondsToLive);
  const nextLabel = next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const schedule = Array.from({ length: DROP_END_HOUR - DROP_START_HOUR + 1 }, (_, i) => DROP_START_HOUR + i);
  const currentHour = now.getHours();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-card animate-pulse-dot" />
          Voucher Drop
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-foreground/70">
          Hourly · 8am – 7pm
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pb-16 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-card mb-6 animate-float-in">
          {isLive ? "Drop active now" : "Next drop in"}
        </p>

        <h1 className="sr-only">Hourly Voucher Drops</h1>

        {/* Card */}
        <div
          key={next.getTime()}
          className="animate-drop-in relative w-full max-w-xl rounded-[2rem] bg-card text-card-foreground px-8 py-10 md:px-14 md:py-12"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.4em] text-primary mb-5">
            {isLive ? "Tap to claim" : "Next drop @"}
          </p>

          {isLive ? (
            <div className="font-mono text-5xl md:text-7xl font-bold tracking-tight text-card-foreground">
              LIVE NOW
            </div>
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
            Drops at {nextLabel}
          </div>
        </div>

        <p className="mt-8 text-sm text-foreground/80 animate-float-in">
          Standard terms apply. Limited quantity per drop.
        </p>

        <button
          type="button"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-card text-card-foreground px-7 py-3.5 text-sm font-semibold tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
          Notify me before next drop
        </button>
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
