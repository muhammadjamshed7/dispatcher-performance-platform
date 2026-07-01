import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isInfrastructureError } from "@/lib/errors/infrastructure-error";

describe("isInfrastructureError", () => {
  it("detects plain Supabase timeout error objects", () => {
    assert.equal(
      isInfrastructureError({
        message: "TypeError: fetch failed",
        details:
          "Caused by: ConnectTimeoutError: Connect Timeout Error (attempted addresses: 172.64.149.246:443, 104.18.38.10:443, timeout: 10000ms) (UND_ERR_CONNECT_TIMEOUT)",
        hint: "",
        code: "",
      }),
      true,
    );
  });

  it("detects nested undici timeout causes", () => {
    assert.equal(
      isInfrastructureError(
        new TypeError("fetch failed", {
          cause: Object.assign(new Error("Connect Timeout Error"), {
            code: "UND_ERR_CONNECT_TIMEOUT",
          }),
        }),
      ),
      true,
    );
  });

  it("does not classify validation-style errors as infrastructure errors", () => {
    assert.equal(
      isInfrastructureError({
        message: "Carrier name is required.",
        code: "VALIDATION_ERROR",
      }),
      false,
    );
  });
});
