"use client";

import { useState, type ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MainContent } from "@/components/layout/main-content";
import { TopNav } from "@/components/layout/top-nav";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <AppSidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onMenuClick={() => setMobileNavOpen(true)} />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
