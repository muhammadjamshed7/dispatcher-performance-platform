import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MainContentProps = {
  children: ReactNode;
  className?: string;
};

export function MainContent({ children, className }: MainContentProps) {
  return (
    <main className={cn("flex-1 overflow-y-auto bg-[#F8FAFC]", className)}>
      <div className="p-4 md:p-8">{children}</div>
    </main>
  );
}
