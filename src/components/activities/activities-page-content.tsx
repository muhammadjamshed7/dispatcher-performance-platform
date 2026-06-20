"use client";

import { useCallback, useMemo, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { ActivityModal, type ActivityModalMode } from "@/components/modals/activity-modal";
import {
  ActivitiesTable,
  type ActivityRowAction,
} from "@/components/tables/activities-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useRoleScope } from "@/hooks/use-role-scope";
import { ApiClientError } from "@/lib/api/client";
import {
  createActivityRequest,
  fetchActivities,
  fetchCarriers,
  updateActivityRequest,
} from "@/lib/api/resources";
import { DELIVERED } from "@/lib/constants/statuses";
import type { DailyActivity } from "@/lib/types";
import type { DailyActivityFormValues } from "@/lib/validation/daily-activity-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function toCreateActivityPayload(
  values: DailyActivityFormValues,
  carrierId: string,
) {
  const base = {
    activityDate: values.date,
    carrierId,
    status: values.status,
    notes: values.notes?.trim() ? values.notes : undefined,
  };

  if (values.status === DELIVERED) {
    return {
      ...base,
      origin: values.origin,
      destination: values.destination,
      totalMiles: values.totalMiles,
      loadAmount: values.loadAmount,
    };
  }

  return {
    ...base,
    reason: values.reason,
  };
}

function toUpdateActivityPayload(values: DailyActivityFormValues) {
  const base = {
    activityDate: values.date,
    status: values.status,
    notes: values.notes?.trim() ? values.notes : undefined,
  };

  if (values.status === DELIVERED) {
    return {
      ...base,
      origin: values.origin,
      destination: values.destination,
      totalMiles: values.totalMiles,
      loadAmount: values.loadAmount,
    };
  }

  return {
    ...base,
    reason: values.reason,
  };
}

export function ActivitiesPageContent() {
  const { filterActivities } = useRoleScope();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ActivityModalMode>("create");
  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadActivities = useCallback(() => fetchActivities(), []);
  const loadCarriers = useCallback(() => fetchCarriers(), []);

  const {
    data: activities = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadActivities, []);
  const { data: carriers = [] } = useApiData(loadCarriers, []);

  useRealtimeRefresh(["DailyActivity"], reload);

  const visibleActivities = useMemo(
    () => filterActivities(activities),
    [activities, filterActivities],
  );

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty || visibleActivities.length === 0
        ? "empty"
        : "ready";

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  function openModal(
    mode: ActivityModalMode,
    activity: DailyActivity | null = null,
  ) {
    setSelectedActivity(activity);
    setModalMode(mode);
    setModalOpen(true);
  }

  function handleRowAction(activity: DailyActivity, action: ActivityRowAction) {
    openModal(action, activity);
  }

  async function handleCreate(values: DailyActivityFormValues) {
    const carrierId = carriers.find(
      (carrier) => carrier.carrierName === values.carrier,
    )?.id;

    if (!carrierId) {
      showToast("Selected carrier not found.");
      return;
    }

    try {
      await createActivityRequest(toCreateActivityPayload(values, carrierId));
      showToast(`Activity for "${values.carrier}" added successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create activity."));
    }
  }

  async function handleEdit(values: DailyActivityFormValues) {
    if (!selectedActivity) {
      return;
    }

    try {
      await updateActivityRequest(
        selectedActivity.id,
        toUpdateActivityPayload(values),
      );
      showToast(`Activity for "${values.carrier}" updated successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update activity."));
    }
  }

  return (
    <>
      <PageShell
        title="Daily Activity"
        description="Log and review daily carrier activity by status."
      >
        <RoleScopeBanner />

        <div className="flex justify-end">
          <Button type="button" onClick={() => openModal("create")}>
            Add Activity
          </Button>
        </div>

        <EntityFilterBar />

        <PageContentGate
          state={pageState}
          onRetry={reload}
          loadingTitle="Loading activities"
          emptyTitle="No activities logged"
          emptyDescription="Add a daily activity to start tracking carrier performance."
          emptyActionLabel="Add Activity"
          onEmptyAction={() => openModal("create")}
          errorTitle="Unable to load activities"
          errorDescription={
            error ?? "Daily activities could not be loaded. Try again in a moment."
          }
        >
          <ActivitiesTable activities={visibleActivities} onAction={handleRowAction} />
        </PageContentGate>
      </PageShell>

      <ActivityModal
        open={modalOpen}
        mode={modalMode}
        activity={selectedActivity}
        onOpenChange={setModalOpen}
        onCreate={handleCreate}
        onEdit={handleEdit}
      />

      <AppToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
