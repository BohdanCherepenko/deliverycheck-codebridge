import type { ApiErrorBody } from "@/lib/types";

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: string[];

  constructor(code: string, message: string, status = 400, details?: string[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function toApiError(error: unknown, requestId: string): {
  status: number;
  body: ApiErrorBody;
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          details: error.details,
        },
      },
    };
  }

  console.error("Unexpected DeliveryCheck error", { requestId, error });
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "The delivery could not be checked. Please try again.",
        requestId,
      },
    },
  };
}
