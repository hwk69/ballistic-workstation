import * as React from "react"
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"

const badgeDeltaVariants = cva("inline-flex items-center text-tremor-label font-semibold", {
  variants: {
    variant: {
      outline:
        "gap-x-1 rounded-tremor-small px-2 py-1 ring-1 ring-inset ring-border",
      solid: "gap-x-1 rounded-tremor-small px-2 py-1",
      solidOutline:
        "gap-x-1 rounded-tremor-small px-2 py-1 ring-1 ring-inset",
      complex:
        "space-x-2.5 rounded-tremor-default bg-tremor-background py-1 pl-2.5 pr-1 ring-1 ring-inset ring-gray-200 dark:ring-gray-800 dark:bg-dark-tremor-background",
    },
    deltaType: {
      increase: "",
      decrease: "",
      neutral: "",
    },
  },
  compoundVariants: [
    {
      deltaType: "increase",
      variant: "outline",
      className: "text-emerald-700 dark:text-emerald-500",
    },
    {
      deltaType: "decrease",
      variant: "outline",
      className: "text-red-700 dark:text-red-500",
    },
    {
      deltaType: "neutral",
      variant: "outline",
      className: "text-gray-700 dark:text-gray-400",
    },
    // Solid variants
    {
      deltaType: "increase",
      variant: "solid",
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-500",
    },
    {
      deltaType: "decrease",
      variant: "solid",
      className:
        "bg-red-100 text-red-800 dark:bg-red-400/20 dark:text-red-500",
    },
    {
      deltaType: "neutral",
      variant: "solid",
      className:
        "bg-gray-200/50 text-gray-700 dark:bg-gray-500/30 dark:text-gray-300",
    },
    // Solid outline variants
    {
      deltaType: "increase",
      variant: "solidOutline",
      className:
        "bg-emerald-100 text-emerald-800 ring-emerald-600/10 dark:bg-emerald-400/20 dark:text-emerald-500 dark:ring-emerald-400/20",
    },
    {
      deltaType: "decrease",
      variant: "solidOutline",
      className:
        "bg-red-100 text-red-800 ring-red-600/10 dark:bg-red-400/20 dark:text-red-500 dark:ring-red-400/20",
    },
    {
      deltaType: "neutral",
      variant: "solidOutline",
      className:
        "bg-gray-100 text-gray-700 ring-gray-600/10 dark:bg-gray-500/30 dark:text-gray-300 dark:ring-gray-400/20",
    },
  ],
})

const DeltaIcon = ({ deltaType }) => {
  const icons = { increase: ArrowUp, decrease: ArrowDown, neutral: ArrowRight }
  const Icon = icons[deltaType]
  return <Icon className="-ml-0.5 size-3.5" aria-hidden={true} strokeWidth={2.5} />;
}

export function BadgeDelta({
  className,
  variant = "outline",
  deltaType = "neutral",
  value,
  ...props
}) {
  if (variant === "complex") {
    return (
      <span className={cn(badgeDeltaVariants({ variant, className }))} {...props}>
        <span
          className={cn("text-tremor-label font-semibold", deltaType === "increase" &&
            "text-emerald-700 dark:text-emerald-500", deltaType === "decrease" && "text-red-700 dark:text-red-500", deltaType === "neutral" &&
            "text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis")}>
          {value}
        </span>
        <span
          className={cn(
            "rounded-tremor-small px-2 py-1 text-tremor-label font-medium",
            deltaType === "increase" && "bg-emerald-100 dark:bg-emerald-400/10",
            deltaType === "decrease" && "bg-red-100 dark:bg-red-400/10",
            deltaType === "neutral" &&
              "bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle"
          )}>
          <DeltaIcon deltaType={deltaType} />
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(badgeDeltaVariants({ variant, deltaType, className }))}
      {...props}>
      <DeltaIcon deltaType={deltaType} />
      {value}
    </span>
  );
}
