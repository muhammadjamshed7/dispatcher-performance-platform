import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NOTIFICATION_ADMIN_APPROVAL_REQUIRED,
  NOTIFICATION_APPROVED,
  NOTIFICATION_TEAM_LEAD_APPROVAL_REQUIRED,
} from "@/lib/constants/notifications";
import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import {
  getNotificationHref,
  matchesPendingApprovalDeepLink,
} from "@/lib/notifications/notification-links";

describe("getNotificationHref", () => {
  it("routes admin approval notifications to pending approvals", () => {
    assert.equal(
      getNotificationHref(ADMIN, {
        notificationStatus: NOTIFICATION_ADMIN_APPROVAL_REQUIRED,
        activityId: "act-1",
        editRequestId: null,
      }),
      "/admin/activities/pending?activityId=act-1",
    );
  });

  it("routes team lead approval notifications to pending approvals", () => {
    assert.equal(
      getNotificationHref(TEAM_LEAD, {
        notificationStatus: NOTIFICATION_TEAM_LEAD_APPROVAL_REQUIRED,
        activityId: "act-2",
        editRequestId: "edit-1",
      }),
      "/team-lead/activities/pending?activityId=act-2&editRequestId=edit-1",
    );
  });

  it("routes dispatcher outcomes to submissions", () => {
    assert.equal(
      getNotificationHref(DISPATCHER, {
        notificationStatus: NOTIFICATION_APPROVED,
        activityId: "act-3",
        editRequestId: null,
      }),
      "/dispatcher/activities/submissions?activityId=act-3",
    );
  });
});

describe("matchesPendingApprovalDeepLink", () => {
  it("matches edit requests by editRequestId", () => {
    assert.equal(
      matchesPendingApprovalDeepLink(
        { kind: "edit_request", id: "edit-1", activity: { id: "act-1" } },
        { editRequestId: "edit-1" },
      ),
      true,
    );
  });

  it("matches new activities by activityId", () => {
    assert.equal(
      matchesPendingApprovalDeepLink(
        { kind: "new_activity", id: "act-1" },
        { activityId: "act-1" },
      ),
      true,
    );
  });
});
