import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MainContentProps = {
  children: ReactNode;
  className?: string;
};

export function MainContent({ children, className }: MainContentProps) {
  return (
    <main className={cn("flex-1 overflow-y-auto bg-muted/20", className)}>
      {children}
    </main>
  );
}
