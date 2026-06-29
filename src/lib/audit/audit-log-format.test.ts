import assert from "node:assert/strict";
import { test } from "node:test";

import {
  actionsForStatus,
  deriveAuditModule,
  deriveAuditStatus,
  formatAuditAction,
  formatAuditData,
  formatAuditDataLines,
  humanizeAuditKey,
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

test("humanizeAuditKey converts keys to Title Case labels", () => {
  assert.equal(humanizeAuditKey("teamName"), "Team Name");
  assert.equal(humanizeAuditKey("ratePerMile"), "Rate Per Mile");
  assert.equal(humanizeAuditKey("team_name"), "Team Name");
  assert.equal(humanizeAuditKey("mcNumber"), "MC Number");
  assert.equal(humanizeAuditKey("mc_number"), "MC Number");
  assert.equal(humanizeAuditKey("carrierId"), "Carrier ID");
});

test("formatAuditData renders readable key-value lines", () => {
  assert.equal(
    formatAuditData({ reason: "Deadhead too much", teamName: "Default Team" }),
    "Reason: Deadhead too much\nTeam Name: Default Team",
  );
});

test("formatAuditData returns an em dash for empty/null data", () => {
  assert.equal(formatAuditData(null), "—");
  assert.equal(formatAuditData(undefined), "—");
  assert.equal(formatAuditData({}), "—");
  assert.equal(formatAuditData(""), "—");
});

test("formatAuditData flattens nested objects and arrays readably", () => {
  const result = formatAuditData({
    truckTypes: ["Dry Van", "Reefer"],
    location: { city: "Dallas", state: "TX" },
  });
  assert.equal(
    result,
    "Truck Types: Dry Van; Reefer\nLocation: City: Dallas, State: TX",
  );
  assert.ok(!result.includes("{"));
  assert.ok(!result.includes("}"));
});

test("formatAuditData formats primitives and booleans", () => {
  assert.equal(
    formatAuditData({ active: true, retries: 3 }),
    "Active: Yes\nRetries: 3",
  );
});

test("formatAuditData parses JSON strings", () => {
  assert.equal(
    formatAuditData('{"teamName":"Default Team"}'),
    "Team Name: Default Team",
  );
});

test("formatAuditDataLines returns per-line label/value pairs", () => {
  const lines = formatAuditDataLines({ teamName: "Default Team" });
  assert.deepEqual(lines, [{ label: "Team Name", value: "Default Team" }]);
  assert.deepEqual(formatAuditDataLines(null), []);
});
