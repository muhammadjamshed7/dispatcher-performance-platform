"use client";

import { useCallback } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { SettingsEditForm } from "@/components/settings/settings-edit-form";
import { useApiData } from "@/hooks/use-api-data";
import { fetchSettings } from "@/lib/api/resources";

export function SettingsPageContent() {
  const loadSettings = useCallback(() => fetchSettings(), []);
  const {
    data: settings,
    error,
    isLoading,
    reload,
  } = useApiData(loadSettings, []);

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : settings
        ? "ready"
        : "empty";

  return (
    <PageShell
      title="Settings"
      description="Organization dispatch rules, allowed values, timezone, and export defaults."
    >
      <RoleScopeBanner message="Admin-only settings" />

      <PageContentGate
        state={pageState}
        onRetry={reload}
        loadingTitle="Loading settings"
        emptyTitle="No settings found"
        emptyDescription="Application settings could not be found."
        errorTitle="Unable to load settings"
        errorDescription={
          error ?? "Settings could not be loaded. Try again in a moment."
        }
      >
        {settings ? (
          <SettingsEditForm settings={settings} onSaved={reload} />
        ) : null}
      </PageContentGate>
    </PageShell>
  );
}
