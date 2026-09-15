import { beforeEach, describe, expect, it } from "vitest";

import {
  consumeCheckAllowance,
  resetRateLimitForTests,
} from "@/lib/rate-limit";

describe("demo rate limit", () => {
  beforeEach(resetRateLimitForTests);

  it("blocks checks beyond the configured hourly allowance", () => {
    consumeCheckAllowance("example", 2, 1_000);
    consumeCheckAllowance("example", 2, 1_001);
    expect(() => consumeCheckAllowance("example", 2, 1_002)).toThrow(
      /allows 2 checks per hour/i,
    );
  });

  it("can be disabled explicitly for trusted local development", () => {
    for (let index = 0; index < 100; index += 1) {
      expect(() => consumeCheckAllowance("local", 0)).not.toThrow();
    }
  });
});
