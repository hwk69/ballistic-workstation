import { useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS as dndCSS } from "@dnd-kit/utilities";
import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WidgetCard({ id, label, span, onRemove, onToggleSpan, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: dndCSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
      className={cn(
        "relative flex flex-col bg-card border border-border rounded-lg overflow-hidden",
        span === "full" ? "lg:col-span-2" : ""
      )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors bg-transparent border-none p-0">
          <GripVertical size={14} />
        </button>

        {/* Widget title */}
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex-1">
          {label}
        </span>

        {/* Span toggle */}
        {onToggleSpan && (
          <button
            onClick={onToggleSpan}
            title={span === "full" ? "Half width" : "Full width"}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer bg-transparent border-none transition-colors px-1">
            {span === "full" ? "½" : "⬛"}
          </button>
        )}

        {/* Remove */}
        <button
          onClick={onRemove}
          className="text-muted-foreground/40 hover:text-destructive cursor-pointer bg-transparent border-none p-0 transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
