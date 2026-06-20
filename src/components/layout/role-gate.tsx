import type { ReactNode } from "react";

type RoleGateProps = {
  children: ReactNode;
};

export function RoleGate({ children }: RoleGateProps) {
  return <>{children}</>;
}
