"use client";

import { useCallback, useState, type ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MainContent } from "@/components/layout/main-content";
import { TopNav } from "@/components/layout/top-nav";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleMenuClick = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setMobileNavOpen((open) => !open);
      return;
    }

    setSidebarCollapsed((collapsed) => !collapsed);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <AppSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onMenuClick={handleMenuClick} />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
