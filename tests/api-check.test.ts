import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/check/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";

vi.mock("@/lib/metrics", () => ({
  appendMetric: vi.fn().mockResolvedValue(undefined),
}));

const SYNTHETIC_ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("POST /api/check", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("DELIVERYCHECK_RATE_LIMIT_PER_HOUR", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetRateLimitForTests();
  });

  it("reaches the AI boundary after parsing the generated PDF and a synthetic PNG", async () => {
    const pdf = await readFile(resolve("output/pdf/deliverycheck-order.pdf"));
    const formData = new FormData();
    formData.set(
      "document",
      new File([pdf], "deliverycheck-order.pdf", {
        type: "application/pdf",
      }),
    );
    formData.set(
      "photos",
      new File([SYNTHETIC_ONE_PIXEL_PNG], "synthetic-unit-photo.png", {
        type: "image/png",
      }),
    );
    formData.set("rulesConfirmed", "true");

    const response = await POST(
      new Request("http://deliverycheck.test/api/check", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AI_NOT_CONFIGURED",
        message: expect.stringContaining("GEMINI_API_KEY"),
      },
    });
  });

  it("rejects unexpected multipart fields", async () => {
    const formData = new FormData();
    formData.set("rulesConfirmed", "true");
    formData.set("unexpected", "ignored data must not be accepted");

    const response = await POST(
      new Request("http://deliverycheck.test/api/check", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "UNEXPECTED_UPLOAD_FIELD",
      },
    });
  });
});
