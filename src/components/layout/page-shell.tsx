import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";

type PageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="space-y-6 p-4 md:p-6 lg:p-8">{children}</div>
    </>
  );
}
