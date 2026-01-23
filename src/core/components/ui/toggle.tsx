import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "../../../renderer/utils/cn";

interface ToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
}

export function Toggle({ pressed, onPressedChange, children, className, ...props }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700",
        pressed && "bg-gray-200 dark:bg-gray-700",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
