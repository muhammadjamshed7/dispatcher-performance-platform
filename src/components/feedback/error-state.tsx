import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ErrorStateProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this data. Try again in a moment.",
  retryLabel = "Try again",
  onRetry,
}: ErrorStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <AlertCircle className="text-destructive size-10" />
        <div className="space-y-1">
          <h3 className="text-base font-medium">{title}</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            {description}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
