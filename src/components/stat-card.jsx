"use client";
import { cn } from "@/lib/utils";

export default function StatCard({ value, label, className, gold = false }) {
  return (
    <div className={cn(
      "relative w-full rounded-xl overflow-hidden border border-border bg-card",
      "transition-colors duration-200 hover:border-primary/30",
      className
    )}>
      {/* Gold accent bar on left edge when gold prop set */}
      {gold && (
        <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-primary opacity-80" />
      )}

      <div className="flex flex-col items-center justify-center px-6 py-8 gap-2">
        <div className={cn(
          "text-4xl font-extrabold font-mono tracking-tight",
          gold ? "text-primary" : "text-foreground"
        )}>
          {value}
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}
