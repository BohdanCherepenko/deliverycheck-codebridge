import { appendFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";

import type { UsageMetrics } from "@/lib/types";

interface AiAttemptLog {
  event: "ai_attempt";
  timestamp: string;
  requestId: string;
  model: string;
  attempt: number;
  durationMs: number;
  outcome: "valid" | "invalid_response" | "api_error";
  providerStatus: number | null;
  providerReason: string | null;
  responseId: string | null;
  usage: UsageMetrics;
}

interface CheckLog {
  event: "check_complete" | "check_failed";
  timestamp: string;
  requestId: string;
  model: string;
  serverDurationMs: number;
  aiDurationMs: number | null;
  attempts: number | null;
  outcomeCode: string;
}

export async function appendMetric(
  logPath: string,
  record: AiAttemptLog | CheckLog,
) {
  try {
    // Keep runtime writes statically scoped to ./logs and discard any path
    // components from operator configuration. This also keeps deployment file
    // tracing bounded to the metrics directory.
    const logDirectory = join(process.cwd(), "logs");
    const absolutePath = join(logDirectory, basename(logPath));
    await mkdir(logDirectory, { recursive: true });
    await appendFile(absolutePath, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch (error) {
    console.warn("DeliveryCheck metrics could not be written", {
      requestId: record.requestId,
      error,
    });
  }
}
