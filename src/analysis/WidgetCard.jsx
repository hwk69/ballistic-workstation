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
        "relative flex flex-col bg-card border border-border/60 rounded-lg overflow-hidden shadow-sm",
        span === "full" ? "lg:col-span-2" : ""
      )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/60">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="export-hide cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors bg-transparent border-none p-0">
          <GripVertical size={14} />
        </button>

        {/* Widget title */}
        <span className="text-xl font-bold text-foreground flex-1 text-center">
          {label}
        </span>

        {/* Span toggle */}
        {onToggleSpan && (
          <button
            onClick={onToggleSpan}
            title={span === "full" ? "Half width" : "Full width"}
            className="export-hide text-[10px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer bg-transparent border-none transition-colors px-1">
            {span === "full" ? "½" : "⬛"}
          </button>
        )}

        {/* Remove */}
        <button
          onClick={onRemove}
          className="export-hide text-muted-foreground/40 hover:text-destructive cursor-pointer bg-transparent border-none p-0 transition-colors">
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
