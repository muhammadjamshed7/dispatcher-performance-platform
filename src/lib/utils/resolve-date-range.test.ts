import assert from "node:assert/strict";
import test from "node:test";

import {
  getDateKeyInTimeZone,
  resolveDateRange,
  resolveDateRangeStrict,
} from "./resolve-date-range";

test("resolves today using the organization timezone", () => {
  const instant = new Date("2026-06-23T01:00:00Z");

  assert.equal(getDateKeyInTimeZone(instant, "America/Chicago"), "2026-06-22");
  assert.equal(getDateKeyInTimeZone(instant, "Asia/Karachi"), "2026-06-23");
});

test("builds month-to-date from the organization's local date", () => {
  const range = resolveDateRange("this-month", {
    now: new Date("2026-07-01T02:00:00Z"),
    timezone: "America/Chicago",
  });

  assert.deepEqual(range, {
    dateFrom: "2026-06-01",
    dateTo: "2026-06-30",
  });
});

test("requires both custom range dates", () => {
  assert.throws(
    () => resolveDateRangeStrict("custom", "2026-06-01"),
    /requires start and end dates/,
  );
});
