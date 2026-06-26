import "server-only";

import { APPROVED } from "@/lib/constants/activity-approval";
import { T, db } from "@/lib/db/client";
import { assertDb, assertDbVoid, createId, nowIso, toDateOnly } from "@/lib/db/utils";

export async function upsertDailySubmission(
  organizationId: string,
  dispatcherId: string,
  teamId: string,
  submissionDate: Date,
): Promise<void> {
  const dateKey = toDateOnly(submissionDate);

  const activitiesResult = await db()
    .from(T.DailyActivity)
    .select("carrierId")
    .eq("dispatcherId", dispatcherId)
    .eq("activityDate", dateKey)
    .eq("approvalStatus", APPROVED);

  const activities = assertDb(activitiesResult) ?? [];
  const carrierIds = new Set(activities.map((activity) => activity.carrierId));

  const upsertPayload = {
    organizationId,
    dispatcherId,
    teamId,
    submissionDate: dateKey,
    carrierCount: carrierIds.size,
    activityCount: activities.length,
    submittedAt: nowIso(),
  };

  const existingSubmissionResult = await db()
    .from(T.DailySubmission)
    .select("id")
    .eq("dispatcherId", dispatcherId)
    .eq("submissionDate", dateKey)
    .maybeSingle();

  if (existingSubmissionResult.error) {
    throw new Error(existingSubmissionResult.error.message);
  }

  if (existingSubmissionResult.data) {
    const updateResult = await db()
      .from(T.DailySubmission)
      .update(upsertPayload)
      .eq("id", existingSubmissionResult.data.id);

    assertDbVoid(updateResult);
    return;
  }

  const insertResult = await db()
    .from(T.DailySubmission)
    .insert({
      id: createId(),
      ...upsertPayload,
    });

  assertDbVoid(insertResult);
}
