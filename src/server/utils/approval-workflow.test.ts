import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PENDING_ADMIN_APPROVAL,
  PENDING_TEAM_LEAD_APPROVAL,
} from "@/lib/constants/activity-approval";
import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { resolveEditRequestApprovalStatus } from "@/server/utils/approval-workflow";

describe("resolveEditRequestApprovalStatus", () => {
  it("routes team lead edits directly to admin approval", () => {
    assert.equal(
      resolveEditRequestApprovalStatus(TEAM_LEAD, false),
      PENDING_ADMIN_APPROVAL,
    );
    assert.equal(
      resolveEditRequestApprovalStatus(TEAM_LEAD, true),
      PENDING_ADMIN_APPROVAL,
    );
  });

  it("routes dispatcher edits based on direct admin approval mode", () => {
    assert.equal(
      resolveEditRequestApprovalStatus(DISPATCHER, false),
      PENDING_TEAM_LEAD_APPROVAL,
    );
    assert.equal(
      resolveEditRequestApprovalStatus(DISPATCHER, true),
      PENDING_ADMIN_APPROVAL,
    );
  });

  it("rejects unsupported roles", () => {
    assert.throws(
      () => resolveEditRequestApprovalStatus(ADMIN, false),
      /Unsupported edit request role/,
    );
  });
});
