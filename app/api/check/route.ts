import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getServerConfig,
  MAX_PHOTOS,
  MAX_REQUEST_BYTES,
} from "@/lib/config";
import { AppError, toApiError } from "@/lib/errors";
import {
  extractVisualObservations,
  VisionProcessingError,
} from "@/lib/gemini-vision";
import { preparePhoto } from "@/lib/images";
import { appendMetric } from "@/lib/metrics";
import { extractOrderLines } from "@/lib/pdf";
import { clientKeyFromHeaders, consumeCheckAllowance } from "@/lib/rate-limit";
import { reconcileDelivery } from "@/lib/reconcile";
import type { CheckResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

function fileValues(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is File => value instanceof File);
}

function validateMultipartEnvelope(formData: FormData) {
  const allowedNames = new Set(["document", "photos", "rulesConfirmed"]);
  let payloadBytes = 0;

  for (const [name, value] of formData.entries()) {
    if (!allowedNames.has(name)) {
      throw new AppError(
        "UNEXPECTED_UPLOAD_FIELD",
        "The upload contains an unexpected multipart field.",
        400,
      );
    }
    payloadBytes +=
      value instanceof File ? value.size : new TextEncoder().encode(value).byteLength;
    if (payloadBytes > MAX_REQUEST_BYTES) {
      throw new AppError(
        "REQUEST_TOO_LARGE",
        "The upload is too large. Use one PDF up to 2 MB and up to three photos of 8 MB each.",
        413,
      );
    }
  }

  const confirmations = formData.getAll("rulesConfirmed");
  if (
    confirmations.length !== 1 ||
    typeof confirmations[0] !== "string" ||
    confirmations[0] !== "true"
  ) {
    throw new AppError(
      "RULES_NOT_CONFIRMED",
      "Confirm that the photos follow the capture rules before checking.",
      400,
    );
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const serverStarted = performance.now();
  let config: ReturnType<typeof getServerConfig> | null = null;
  let aiDurationMs: number | null = null;
  let attempts: number | null = null;

  try {
    config = getServerConfig();
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      throw new AppError(
        "REQUEST_TOO_LARGE",
        "The upload is too large. Use one PDF up to 2 MB and up to three photos of 8 MB each.",
        413,
      );
    }
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      throw new AppError(
        "INVALID_UPLOAD",
        "Send the PDF and photos as multipart form data.",
        415,
      );
    }

    // Protect parsing/decoding work as well as paid model calls. This simple
    // in-memory guard deliberately counts malformed check attempts too.
    consumeCheckAllowance(
      clientKeyFromHeaders(request.headers),
      config.rateLimitPerHour,
    );

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new AppError(
        "INVALID_UPLOAD",
        "The uploaded files could not be read.",
        400,
      );
    }

    validateMultipartEnvelope(formData);

    const documents = fileValues(formData, "document");
    const photos = fileValues(formData, "photos");
    if (documents.length !== 1) {
      throw new AppError(
        "PDF_REQUIRED",
        "Upload exactly one one-page PDF.",
        400,
      );
    }
    if (photos.length < 1 || photos.length > MAX_PHOTOS) {
      throw new AppError(
        "PHOTO_COUNT",
        "Upload between one and three photos.",
        400,
      );
    }

    const orderLinesPromise = extractOrderLines(documents[0]);
    const preparedPhotosPromise = Promise.all(
      photos.map((photo, index) => preparePhoto(photo, index + 1)),
    );
    const [orderLines, preparedPhotos] = await Promise.all([
      orderLinesPromise,
      preparedPhotosPromise,
    ]);

    const vision = await extractVisualObservations(
      preparedPhotos,
      config,
      requestId,
    );
    aiDurationMs = vision.aiDurationMs;
    attempts = vision.attempts;
    const result = reconcileDelivery(
      orderLines,
      vision.observations,
      vision.photoAssessments,
    );
    const serverDurationMs = Math.round(performance.now() - serverStarted);

    const body: CheckResponse = {
      requestId,
      orderLines,
      photos: preparedPhotos.map(
        ({ photoNumber, previewDataUrl, width, height }) => ({
          photoNumber,
          previewDataUrl,
          width,
          height,
        }),
      ),
      result,
      metrics: {
        requestId,
        model: config.model,
        serverDurationMs,
        aiDurationMs: vision.aiDurationMs,
        attempts: vision.attempts,
        usage: vision.usage,
      },
    };
    await appendMetric(config.metricsLog, {
      event: "check_complete",
      timestamp: new Date().toISOString(),
      requestId,
      model: config.model,
      serverDurationMs,
      aiDurationMs,
      attempts,
      outcomeCode: "OK",
    });
    return NextResponse.json(body, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof VisionProcessingError) {
      aiDurationMs = error.aiDurationMs;
      attempts = error.attempts;
    }
    const apiError = toApiError(error, requestId);
    if (config) {
      await appendMetric(config.metricsLog, {
        event: "check_failed",
        timestamp: new Date().toISOString(),
        requestId,
        model: config.model,
        serverDurationMs: Math.round(performance.now() - serverStarted),
        aiDurationMs,
        attempts,
        outcomeCode: apiError.body.error.code,
      });
    }
    return NextResponse.json(apiError.body, {
      status: apiError.status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
