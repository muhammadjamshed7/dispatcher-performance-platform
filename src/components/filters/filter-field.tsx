import type { ReactNode } from "react";

type FilterFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function FilterField({ label, children, className }: FilterFieldProps) {
  return (
    <div className={className ?? "min-w-[140px] flex-1 space-y-1"}>
      <p className="text-muted-foreground text-xs">{label}</p>
      {children}
    </div>
  );
}
