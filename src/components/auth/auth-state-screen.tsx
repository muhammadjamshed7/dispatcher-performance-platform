import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AuthStateScreenProps = {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
};

export function AuthStateScreen({
  icon: Icon,
  iconClassName,
  title,
  description,
  children,
  className,
}: AuthStateScreenProps) {
  return (
    <main
      className={cn(
        "flex min-h-screen items-center justify-center bg-muted/30 p-6",
        className,
      )}
    >
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="text-center">
          <div
            className={cn(
              "mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted",
              iconClassName,
            )}
          >
            <Icon className="size-6" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children ? <CardContent className="flex flex-col gap-2">{children}</CardContent> : null}
      </Card>
    </main>
  );
}
