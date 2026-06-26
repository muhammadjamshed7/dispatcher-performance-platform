import assert from "node:assert/strict";
import { test } from "node:test";

import {
  actionsForStatus,
  deriveAuditModule,
  deriveAuditStatus,
  formatAuditAction,
} from "@/lib/audit/audit-log-format";

test("deriveAuditStatus", async (t) => {
  await t.test("maps login to Logged In", () => {
    assert.equal(deriveAuditStatus("USER_LOGGED_IN"), "Logged In");
  });

  await t.test("maps create/update/delete actions", () => {
    assert.equal(deriveAuditStatus("CARRIER_CREATED"), "Created");
    assert.equal(deriveAuditStatus("DISPATCHER_UPDATED"), "Updated");
    assert.equal(deriveAuditStatus("TEAM_DEACTIVATED"), "Deleted");
  });

  await t.test("maps approvals from both roles to Approved", () => {
    assert.equal(
      deriveAuditStatus("ACTIVITY_APPROVED_BY_TEAM_LEAD"),
      "Approved",
    );
    assert.equal(deriveAuditStatus("ACTIVITY_APPROVED_BY_ADMIN"), "Approved");
  });

  await t.test("falls back to Updated for unknown actions", () => {
    assert.equal(deriveAuditStatus("SOMETHING_NEW"), "Updated");
  });
});

test("actionsForStatus returns every action for a status", () => {
  const approved = actionsForStatus("Approved");
  assert.ok(approved.includes("ACTIVITY_APPROVED_BY_ADMIN"));
  assert.ok(approved.includes("ACTIVITY_APPROVED_BY_TEAM_LEAD"));
  assert.ok(approved.includes("USER_APPROVED"));
  assert.equal(actionsForStatus("Not A Status").length, 0);
});

test("deriveAuditModule maps entity types to friendly labels", () => {
  assert.equal(deriveAuditModule("DailyActivity"), "Activities");
  assert.equal(deriveAuditModule("OrganizationSettings"), "Settings");
  assert.equal(deriveAuditModule("UnknownEntity"), "UnknownEntity");
});

test("formatAuditAction renders a readable label", () => {
  assert.equal(
    formatAuditAction("ACTIVITY_APPROVED_BY_ADMIN"),
    "Activity Approved By Admin",
  );
  assert.equal(formatAuditAction("USER_LOGGED_IN"), "User Logged In");
});
