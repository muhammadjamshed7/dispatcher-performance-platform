"use client";

import { Info } from "lucide-react";

import { useRoleScope } from "@/hooks/use-role-scope";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type RoleScopeBannerProps = {
  message?: string;
};

export function RoleScopeBanner({ message }: RoleScopeBannerProps) {
  const { scopeLabel, user, role } = useRoleScope();

  return (
    <Card className="bg-muted/20 border-dashed">
      <CardContent className="flex flex-wrap items-center gap-2 py-3 text-sm">
        <Info className="text-muted-foreground size-4 shrink-0" />
        <Badge
          variant="outline"
          className="text-[10px] tracking-wide uppercase"
        >
          Session
        </Badge>
        <Badge variant="secondary">{role.replaceAll("_", " ")}</Badge>
        <span className="text-muted-foreground">
          {message ?? scopeLabel} · {user.fullName}
        </span>
      </CardContent>
    </Card>
  );
}
