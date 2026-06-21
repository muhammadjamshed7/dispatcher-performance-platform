import { Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardFilterButtonProps = {
  activeCount: number;
  open: boolean;
  onClick: () => void;
  className?: string;
};

export function DashboardFilterButton({
  activeCount,
  open,
  onClick,
  className,
}: DashboardFilterButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        "h-10 rounded-[10px] border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]",
        open && "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]",
        className,
      )}
    >
      <Filter className="size-4" />
      Filters
      {activeCount > 0 ? (
        <Badge className="ml-1 rounded-full bg-[#2563EB] px-1.5 py-0 text-[10px] text-white hover:bg-[#2563EB]">
          {activeCount}
        </Badge>
      ) : null}
    </Button>
  );
}
