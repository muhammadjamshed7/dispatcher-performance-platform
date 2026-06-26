import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DELIVERED, CANCELLED } from "@/lib/constants/statuses";
import { APPROVED } from "@/lib/constants/activity-approval";
import type { DailyActivity } from "@/lib/types";

import {
  calculateActivityFinancialTotals,
  groupActivitiesByCarrier,
  groupActivitiesByDispatcher,
} from "./activities-report-metrics";

function createActivity(
  overrides: Partial<DailyActivity> & Pick<DailyActivity, "id">,
): DailyActivity {
  return {
    date: "2026-06-01",
    carrierId: "carrier-1",
    carrierName: "Jim Transport",
    dispatcherId: "dispatcher-1",
    dispatcherName: "Alex Dispatcher",
    teamId: "team-1",
    teamName: "North Team",
    truckType: "DRY_VAN",
    status: DELIVERED,
    origin: "Dallas, TX",
    destination: "Houston, TX",
    miles: 100,
    loadAmount: 500,
    ratePerMile: 5,
    dispatchFee: 50,
    reason: null,
    notes: null,
    approvalStatus: APPROVED,
    submittedById: null,
    teamLeadApprovedById: null,
    adminApprovedById: null,
    rejectedById: null,
    rejectionReason: null,
    submittedAt: null,
    teamLeadApprovedAt: null,
    adminApprovedAt: null,
    rejectedAt: null,
    approvalNotes: null,
    approvalType: "NEW_ACTIVITY",
    hasPendingEdit: false,
    pendingEditApprovalStatus: null,
    approvedByName: null,
    approvedByRole: null,
    ...overrides,
  };
}

describe("calculateActivityFinancialTotals", () => {
  it("sums delivered financial fields and computes weighted rate per mile", () => {
    const totals = calculateActivityFinancialTotals([
      createActivity({ id: "a-1" }),
      createActivity({
        id: "a-2",
        miles: 200,
        loadAmount: 1000,
        ratePerMile: 5,
        dispatchFee: 100,
      }),
      createActivity({
        id: "a-3",
        status: CANCELLED,
        miles: 999,
        loadAmount: 999,
        dispatchFee: 999,
        reason: "No freight",
      }),
    ]);

    assert.equal(totals.activityCount, 3);
    assert.equal(totals.deliveredCount, 2);
    assert.equal(totals.totalMiles, 300);
    assert.equal(totals.totalLoadAmount, 1500);
    assert.equal(totals.totalDispatchFee, 150);
    assert.equal(totals.averageRatePerMile, 5);
  });
});

describe("groupActivitiesByCarrier", () => {
  it("groups by readable carrier names", () => {
    const summaries = groupActivitiesByCarrier([
      createActivity({ id: "a-1", carrierName: "Beta Carrier" }),
      createActivity({ id: "a-2", carrierName: "Alpha Carrier" }),
      createActivity({
        id: "a-3",
        carrierName: "Alpha Carrier",
        miles: 50,
        loadAmount: 250,
        dispatchFee: 25,
      }),
    ]);

    assert.deepEqual(
      summaries.map((summary) => summary.carrierName),
      ["Alpha Carrier", "Beta Carrier"],
    );
    assert.equal(summaries[0]?.totals.deliveredCount, 2);
    assert.equal(summaries[0]?.totals.totalMiles, 150);
  });
});

describe("groupActivitiesByDispatcher", () => {
  it("groups by readable dispatcher names", () => {
    const summaries = groupActivitiesByDispatcher([
      createActivity({ id: "a-1", dispatcherName: "Sam" }),
      createActivity({
        id: "a-2",
        dispatcherName: "Sam",
        teamName: "East Team",
      }),
    ]);

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]?.dispatcherName, "Sam");
    assert.equal(summaries[0]?.teamName, "North Team");
    assert.equal(summaries[0]?.totals.deliveredCount, 2);
  });
});
