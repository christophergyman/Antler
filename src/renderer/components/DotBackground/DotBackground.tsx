import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

interface DotBackgroundProps {
  children: ReactNode;
  className?: string;
}

export function DotBackground({ children, className }: DotBackgroundProps) {
  return (
    <div
      className={cn(
        "relative min-h-screen w-full bg-white dark:bg-black",
        className
      )}
    >
      {/* Dot pattern layer */}
      <div
        className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px]"
        aria-hidden="true"
      />
      {/* Radial fade mask - fades dots toward center */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.8)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.8)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      {/* Content layer */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
