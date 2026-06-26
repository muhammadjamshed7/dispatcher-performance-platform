"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { ActivitiesExcelFilterControls } from "@/components/activities/activities-excel-filter-controls";
import { ActivitiesPdfExportButton } from "@/components/activities/activities-pdf-export-button";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import {
  ActivityModal,
  type ActivityModalMode,
} from "@/components/modals/activity-modal";
import {
  ActivitiesTable,
  type ActivityRowAction,
} from "@/components/tables/activities-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/components/auth/session-provider";
import { DISPATCHER } from "@/lib/constants/roles";
import { ApiClientError } from "@/lib/api/client";
import { useEntityOptions } from "@/hooks/use-entity-options";
import {
  activityExcelFiltersToParams,
  parseActivityExcelFiltersFromSearchParams,
  type ActivityExcelFilterState,
} from "@/lib/filters/activity-excel-filter-params";
import {
  entityFiltersToActivityParams,
  parseEntityFiltersFromSearchParams,
  type EntityFilterValues,
} from "@/lib/filters/entity-filter-params";
import {
  createActivityRequest,
  fetchActivities,
  fetchAllowedStatusReasons,
  fetchDispatcherSubmissions,
  updateActivityRequest,
} from "@/lib/api/resources";
import { getCarrierDisplayName } from "@/lib/utils/carrier-display";
import { DELIVERED } from "@/lib/constants/statuses";
import type { ActivityEditRequestDto, DailyActivity } from "@/lib/types";
import type { DailyActivityFormValues } from "@/lib/validation/daily-activity-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function toCreateActivityPayload(values: DailyActivityFormValues) {
  const base = {
    activityDate: values.date,
    carrierId: values.carrierId,
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

type ActivitiesPageContentProps = {
  compact?: boolean;
};

function ActivitiesPageContentInner({
  compact = false,
}: ActivitiesPageContentProps) {
  const searchParams = useSearchParams();
  const searchParamKey = searchParams.toString();
  const urlEntityFilters = useMemo(
    () =>
      parseEntityFiltersFromSearchParams(new URLSearchParams(searchParamKey)),
    [searchParamKey],
  );
  const urlExcelFilters = useMemo(
    () =>
      parseActivityExcelFiltersFromSearchParams(
        new URLSearchParams(searchParamKey),
      ),
    [searchParamKey],
  );

  return (
    <ActivitiesPageState
      key={searchParamKey}
      initialEntityFilters={urlEntityFilters}
      initialExcelFilters={urlExcelFilters}
      compact={compact}
    />
  );
}

function ActivitiesPageState({
  initialEntityFilters,
  initialExcelFilters,
  compact,
}: {
  initialEntityFilters: EntityFilterValues;
  initialExcelFilters: ActivityExcelFilterState;
  compact: boolean;
}) {
  const { session } = useSession();
  const isDispatcher = session?.role === DISPATCHER;
  const [draftFilters, setDraftFilters] = useState<EntityFilterValues>(
    initialEntityFilters,
  );
  const [appliedFilters, setAppliedFilters] = useState<EntityFilterValues>(
    initialEntityFilters,
  );
  const [excelAppliedFilters, setExcelAppliedFilters] =
    useState<ActivityExcelFilterState>(initialExcelFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ActivityModalMode>("create");
  const [selectedActivity, setSelectedActivity] =
    useState<DailyActivity | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadActivities = useCallback(() => {
    const params = compact
      ? activityExcelFiltersToParams(excelAppliedFilters)
      : entityFiltersToActivityParams(appliedFilters);

    return fetchActivities(params);
  }, [appliedFilters, compact, excelAppliedFilters]);
  const loadAllowedReasons = useCallback(() => fetchAllowedStatusReasons(), []);
  const { carriers, teams, dispatchers } = useEntityOptions();

  const {
    data: activities = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadActivities, [
    compact ? excelAppliedFilters : appliedFilters,
    compact,
  ]);
  const { data: allowedStatusReasons = [] } = useApiData(
    loadAllowedReasons,
    [],
  );

  const loadSubmissions = useCallback(() => fetchDispatcherSubmissions(), []);
  const { data: submissions = [], reload: reloadSubmissions } = useApiData(
    loadSubmissions,
    [],
    { enabled: isDispatcher },
  );

  const editRequestByActivityId = useMemo(() => {
    const map = new Map<string, ActivityEditRequestDto>();

    for (const item of submissions) {
      if (item.kind !== "edit_request" || !item.editRequest) {
        continue;
      }

      const activityId = item.editRequest.originalActivityId;
      const existing = map.get(activityId);

      if (
        !existing ||
        new Date(item.editRequest.editedAt).getTime() >
          new Date(existing.editedAt).getTime()
      ) {
        map.set(activityId, item.editRequest);
      }
    }

    return map;
  }, [submissions]);

  const refreshAll = useCallback(() => {
    void reload();
    if (isDispatcher) {
      void reloadSubmissions();
    }
  }, [isDispatcher, reload, reloadSubmissions]);

  const activityRealtimeTables = useMemo(
    () => ["DailyActivity", "ActivityEditRequest"] as const,
    [],
  );

  useRealtimeRefresh(activityRealtimeTables, refreshAll);

  const carrierNameById = useMemo(
    () =>
      new Map(
        carriers.map((carrier) => [
          carrier.id,
          getCarrierDisplayName(carrier),
        ]),
      ),
    [carriers],
  );

  const visibleActivities = activities;

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
    const carrierName = carrierNameById.get(values.carrierId) ?? "carrier";

    try {
      await createActivityRequest(toCreateActivityPayload(values));
      showToast(
        session?.role === DISPATCHER
          ? `Activity for "${carrierName}" submitted for approval.`
          : `Activity for "${carrierName}" added successfully.`,
      );
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create activity."));
      throw err;
    }
  }

  async function handleEdit(values: DailyActivityFormValues) {
    if (!selectedActivity) {
      return;
    }

    const carrierName =
      carrierNameById.get(values.carrierId) ?? selectedActivity.carrierName;

    try {
      await updateActivityRequest(
        selectedActivity.id,
        toUpdateActivityPayload(values),
      );
      showToast(
        session?.role === DISPATCHER &&
          selectedActivity.approvalStatus === "APPROVED"
          ? `Edit request for "${carrierName}" submitted for approval. The approved activity remains active until review.`
          : selectedActivity.approvalStatus === "APPROVED"
            ? `Activity for "${carrierName}" updated successfully.`
            : `Activity for "${carrierName}" resubmitted for approval.`,
      );
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update activity."));
      throw err;
    }
  }

  return (
    <>
      <PageShell
        title="Daily Activity"
        description={
          compact ? undefined : "Log and review daily carrier activity by status."
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {compact ? (
              <ActivitiesExcelFilterControls
                appliedFilters={excelAppliedFilters}
                onApplyFilters={setExcelAppliedFilters}
              />
            ) : null}
            <ActivitiesPdfExportButton
              activities={visibleActivities}
              compact={compact}
              entityFilters={appliedFilters}
              excelFilters={excelAppliedFilters}
              teams={teams}
              dispatchers={dispatchers}
              carriers={carriers}
              includeAllStatuses={isDispatcher}
              includeApprovalDetails={isDispatcher}
              disabled={isLoading || Boolean(error)}
              onSuccess={() =>
                showToast("Daily activities PDF exported successfully.")
              }
              onError={(message) => showToast(message)}
            />
            <Button type="button" onClick={() => openModal("create")}>
              Add Activity
            </Button>
          </div>
        }
      >
        {!compact ? <RoleScopeBanner /> : null}

        {!compact ? (
          <EntityFilterBar
            values={draftFilters}
            onChange={setDraftFilters}
            onApply={() => setAppliedFilters(draftFilters)}
            showDateRange
          />
        ) : null}

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
            error ??
            "Daily activities could not be loaded. Try again in a moment."
          }
        >
          <ActivitiesTable
            activities={visibleActivities}
            onAction={handleRowAction}
          />
        </PageContentGate>
      </PageShell>

      <ActivityModal
        open={modalOpen}
        mode={modalMode}
        activity={selectedActivity}
        pendingEditRequest={
          selectedActivity
            ? (editRequestByActivityId.get(selectedActivity.id) ?? null)
            : null
        }
        allowedStatusReasons={allowedStatusReasons}
        onOpenChange={setModalOpen}
        onCreate={handleCreate}
        onEdit={handleEdit}
      />

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}

export function ActivitiesPageContent({
  compact = false,
}: ActivitiesPageContentProps = {}) {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-sm text-[#64748B]">Loading activities...</div>
      }
    >
      <ActivitiesPageContentInner compact={compact} />
    </Suspense>
  );
}
