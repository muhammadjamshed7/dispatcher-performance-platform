import { Badge } from "@/components/ui/badge";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
  type Status,
} from "@/lib/constants/statuses";
import { cn } from "@/lib/utils";

const STATUS_VARIANTS: Record<
  Status,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [DELIVERED]: "default",
  [CANCELLED]: "destructive",
  [NOT_BOOKED]: "outline",
  [NOT_WORKING]: "secondary",
};

type StatusBadgeProps = {
  status: Status | string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant =
    status in STATUS_VARIANTS ? STATUS_VARIANTS[status as Status] : "outline";

  return (
    <Badge variant={variant} className={cn(className)}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
