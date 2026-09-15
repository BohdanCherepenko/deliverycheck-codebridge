import { AppError } from "@/lib/errors";

export const MAX_PDF_BYTES = 2 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS = 3;
export const MAX_REQUEST_BYTES =
  MAX_PDF_BYTES + MAX_PHOTOS * MAX_PHOTO_BYTES + 512 * 1024;

function integerEnv(name: string, fallback: number, minimum: number, maximum: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new AppError(
      "INVALID_SERVER_CONFIGURATION",
      `${name} must be an integer between ${minimum} and ${maximum}.`,
      500,
    );
  }
  return value;
}

export function getServerConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
    model:
      process.env.GEMINI_VISION_MODEL?.trim() || "gemini-3.5-flash-lite",
    // Physical three-photo runs normally returned in 4–7 s of provider time.
    // Cap an outlier at 15 s so one optional retry cannot look like a frozen UI.
    timeoutMs: integerEnv("GEMINI_TIMEOUT_MS", 15_000, 5_000, 40_000),
    maxRetries: integerEnv("GEMINI_MAX_RETRIES", 1, 0, 1),
    rateLimitPerHour: integerEnv(
      "DELIVERYCHECK_RATE_LIMIT_PER_HOUR",
      20,
      0,
      100,
    ),
    metricsLog:
      process.env.DELIVERYCHECK_METRICS_LOG?.trim() ||
      "request-metrics.jsonl",
  };
}
