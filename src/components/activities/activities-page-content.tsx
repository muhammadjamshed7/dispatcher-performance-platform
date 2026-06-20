"use client";

import { useCallback, useMemo, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import { MockToast } from "@/components/feedback/mock-toast";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { ActivityModal, type ActivityModalMode } from "@/components/modals/activity-modal";
import {
  ActivitiesTable,
  type ActivityRowAction,
} from "@/components/tables/activities-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useMockPageState } from "@/hooks/use-mock-page-state";
import { useRoleScope } from "@/hooks/use-role-scope";
import { DELIVERED } from "@/lib/constants/statuses";
import { DRY_VAN } from "@/lib/constants/truck-types";
import {
  mockActivities as initialMockActivities,
  mockCarriers,
} from "@/lib/mock-data";
import type { DailyActivity } from "@/lib/types";
import { calculateDispatchFee } from "@/lib/utils/calculate-dispatch-fee";
import { calculateRatePerMile } from "@/lib/utils/calculate-rate-per-mile";
import type { DailyActivityFormValues } from "@/lib/validation/daily-activity-form";

function buildActivityFromForm(
  values: DailyActivityFormValues,
  existingId?: string,
) : DailyActivity {
  const carrier = mockCarriers.find(
    (item) => item.carrierName === values.carrier,
  );

  const isDelivered = values.status === DELIVERED;
  const miles =
    isDelivered && values.totalMiles && values.totalMiles > 0
      ? values.totalMiles
      : null;
  const loadAmount =
    isDelivered && values.loadAmount && values.loadAmount > 0
      ? values.loadAmount
      : null;
  const dispatchFeePercentage = carrier?.dispatchFeePercentage ?? 0;

  return {
    id: existingId ?? `act-${crypto.randomUUID()}`,
    date: values.date,
    carrierName: values.carrier,
    dispatcherName: carrier?.assignedDispatcherName ?? "Unassigned",
    teamName: carrier?.assignedTeamName ?? "Unassigned",
    truckType: carrier?.truckType ?? DRY_VAN,
    status: values.status,
    origin: isDelivered ? values.origin ?? null : null,
    destination: isDelivered ? values.destination ?? null : null,
    miles,
    loadAmount,
    ratePerMile:
      miles && loadAmount ? calculateRatePerMile(loadAmount, miles) : null,
    dispatchFee:
      loadAmount && isDelivered
        ? calculateDispatchFee(loadAmount, dispatchFeePercentage)
        : null,
    reason: !isDelivered ? values.reason ?? null : null,
    notes: values.notes?.trim() ? values.notes : null,
  };
}

export function ActivitiesPageContent() {
  const { filterActivities } = useRoleScope();
  const [activities, setActivities] = useState<DailyActivity[]>(
    initialMockActivities,
  );
  const visibleActivities = useMemo(
    () => filterActivities(activities),
    [activities, filterActivities],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ActivityModalMode>("create");
  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isEmpty = visibleActivities.length === 0;
  const { state, retry } = useMockPageState({ isEmpty });

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

  function handleRowAction(activity : DailyActivity, action: ActivityRowAction) {
    openModal(action, activity);
  }

  function handleCreate(values: DailyActivityFormValues) {
    const activity = buildActivityFromForm(values);
    setActivities((current) => [activity, ...current]);
    showToast(`Activity for "${values.carrier}" added successfully (mock).`);
  }

  function handleEdit(values: DailyActivityFormValues) {
    if (!selectedActivity) {
      return;
    }

    const updated = buildActivityFromForm(values, selectedActivity.id);
    setActivities((current) =>
      current.map((activity) =>
        activity.id === selectedActivity.id ? updated : activity,
      ),
    );

    showToast(`Activity for "${values.carrier}" updated successfully (mock).`);
  }

  return (
    <>
      <PageShell
        title="Daily Activity"
        description="Log and review daily carrier activity by status. Mock data only — no backend persistence."
      >
        <RoleScopeBanner />

        <div className="flex justify-end">
          <Button type="button" onClick={() => openModal("create")}>
            Add Activity
          </Button>
        </div>

        <EntityFilterBar />

        <PageContentGate
          state={state}
          onRetry={retry}
          loadingTitle="Loading activities"
          emptyTitle="No activities logged"
          emptyDescription="Add a daily activity to start tracking carrier performance."
          emptyActionLabel="Add Activity"
          onEmptyAction={() => openModal("create")}
          errorTitle="Unable to load activities"
          errorDescription="Daily activities could not be loaded. Try again in a moment."
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

      <MockToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
