import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        {icon ?? <Inbox className="text-muted-foreground size-10" />}
        <div className="space-y-1">
          <h3 className="text-base font-medium">{title}</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            {description}
          </p>
        </div>
        {actionLabel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onAction}
            disabled={!onAction}
          >
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
