import assert from "node:assert/strict";
import test from "node:test";

import { calculateDispatchFee } from "./calculate-dispatch-fee";

test("calculates and rounds percentage fees to cents", () => {
  assert.equal(calculateDispatchFee(1234.56, 12), 148.15);
});

test("enforces the configured minimum fee", () => {
  assert.equal(calculateDispatchFee(100, 10, { minimumFee: 25 }), 25);
});

test("supports whole-dollar fee rounding", () => {
  assert.equal(
    calculateDispatchFee(1234.56, 12, { roundToNearestDollar: true }),
    148,
  );
});
