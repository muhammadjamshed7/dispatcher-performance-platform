import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isValidCarrierAutoActivityStatus,
  resolveCarrierStatusFromLastValidActivity,
} from "@/lib/carriers/activity-based-status";

describe("carrier activity-based status rules", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");

  it("marks carriers inactive when there is no valid completed activity", () => {
    assert.equal(
      resolveCarrierStatusFromLastValidActivity(null, now),
      "INACTIVE",
    );
  });

  it("marks carriers active when the latest valid activity is within 72 hours", () => {
    assert.equal(
      resolveCarrierStatusFromLastValidActivity(
        "2026-06-29T12:00:00.000Z",
        now,
      ),
      "ACTIVE",
    );
  });

  it("marks carriers inactive when the latest valid activity is older than 72 hours", () => {
    assert.equal(
      resolveCarrierStatusFromLastValidActivity(
        "2026-06-28T11:59:59.000Z",
        now,
      ),
      "INACTIVE",
    );
  });

  it("excludes in-transit activity from the automatic status calculation", () => {
    assert.equal(isValidCarrierAutoActivityStatus("IN_TRANSIT"), false);
    assert.equal(isValidCarrierAutoActivityStatus("DELIVERED"), true);
    assert.equal(isValidCarrierAutoActivityStatus("CANCELLED"), true);
    assert.equal(isValidCarrierAutoActivityStatus("NOT_BOOKED"), true);
    assert.equal(isValidCarrierAutoActivityStatus("NOT_WORKING"), true);
  });
});
