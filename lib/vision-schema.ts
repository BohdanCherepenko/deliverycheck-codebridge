import { z } from "zod";

import { AppError } from "@/lib/errors";
import { labelContainsExactSku, normalizeSku } from "@/lib/reconcile";
import type { PhotoAssessment, RawObservation } from "@/lib/types";

const normalizedCoordinateSchema = z.number().finite().min(0).max(1000);

// Gemini's documented object-detection convention is
// [y_min, x_min, y_max, x_max]. Validate that provider-native representation,
// then convert it to the UI's x/y/width/height shape below. Asking the model for
// width/height made it prone to returning the bottom/right edges as dimensions.
const boundingBoxSchema = z
  .tuple([
    normalizedCoordinateSchema,
    normalizedCoordinateSchema,
    normalizedCoordinateSchema,
    normalizedCoordinateSchema,
  ])
  .superRefine(([yMin, xMin, yMax, xMax], context) => {
    if (yMax <= yMin) {
      context.addIssue({
        code: "custom",
        message: "box_2d y_max must be greater than y_min",
      });
    }
    if (xMax <= xMin) {
      context.addIssue({
        code: "custom",
        message: "box_2d x_max must be greater than x_min",
      });
    }
  });

const responseSchema = z
  .object({
    photo_assessments: z
      .array(
        z
          .object({
            photo_number: z.number().int().min(1).max(3),
            is_overview: z.boolean(),
            all_items_visible: z.boolean(),
            limitations: z.string().max(500),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    observations: z
      .array(
        z
          .object({
            photo_number: z.number().int().min(1).max(3),
            overview_item_id: z.string().trim().min(1).max(40).nullable(),
            sku: z.string().trim().min(1).max(120).nullable(),
            label_text: z.string().max(500),
            object_description: z.string().trim().min(1).max(300),
            box_2d: boundingBoxSchema,
            association_reason: z.string().trim().min(1).max(500).nullable(),
            // Keep the field structurally required, but normalize an empty value
            // below. A missing explanation must never turn an already-explicit
            // `sku: null` or unlinked detail into a positive claim—or discard all
            // otherwise valid evidence from the response.
            uncertainty_reason: z.string().max(500).nullable(),
          })
          .strict(),
      )
      .max(60),
  })
  .strict();

export const OBSERVATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    photo_assessments: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          photo_number: {
            type: "integer",
            minimum: 1,
            maximum: 3,
            description: "The one-based PHOTO number supplied immediately before the image.",
          },
          is_overview: {
            type: "boolean",
            description: "True only when the image clearly shows an overview of the delivery.",
          },
          all_items_visible: {
            type: "boolean",
            description:
              "True only when every arranged delivery item is separate, uncropped, and sufficiently visible to assess the delivery composition.",
          },
          limitations: {
            type: "string",
            description:
              "A concise description of cropping, occlusion, blur, or other limits; empty only when there are none.",
          },
        },
        required: ["photo_number", "is_overview", "all_items_visible", "limitations"],
        additionalProperties: false,
      },
    },
    observations: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        properties: {
          photo_number: {
            type: "integer",
            minimum: 1,
            maximum: 3,
            description: "The one-based PHOTO number containing this object.",
          },
          overview_item_id: {
            type: ["string", "null"],
            description:
              "Response-local object reference O01, O02, and so on. Assign one unique reference to each distinct item in PHOTO 1. In later photos, reuse a PHOTO 1 reference only when the same physical object is confidently linked; otherwise null. This is not printed label text.",
          },
          sku: {
            type: ["string", "null"],
            description:
              "Exact printed SKU identifier value, preserving its characters but excluding a field caption such as `SKU:`, or null when it is not confidently readable.",
          },
          label_text: {
            type: "string",
            description: "Only the text actually visible on the item's label; never inferred text.",
          },
          object_description: {
            type: "string",
            description: "A short visual description that does not guess hidden product identity.",
          },
          box_2d: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "number",
              minimum: 0,
              maximum: 1000,
            },
            description:
              "Bounding box of the entire physical item in the exact order [y_min, x_min, y_max, x_max], normalized from 0 to 1000. y_max must exceed y_min and x_max must exceed x_min.",
          },
          association_reason: {
            type: ["string", "null"],
            description:
              "For a linked observation in PHOTO 2 or 3, concise visible reasons that establish it is the same object as the referenced PHOTO 1 item. Null for PHOTO 1 and for unlinked detail observations.",
          },
          uncertainty_reason: {
            type: ["string", "null"],
            description:
              "Why the SKU is unreadable or why a detail view cannot be safely linked to PHOTO 1. Null only when identity and any required cross-photo link are confident.",
          },
        },
        required: [
          "photo_number",
          "overview_item_id",
          "sku",
          "label_text",
          "object_description",
          "box_2d",
          "association_reason",
          "uncertainty_reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["photo_assessments", "observations"],
  additionalProperties: false,
} as const;

export function parseObservationResponse(
  responseText: string,
  photoCount: number,
): { photoAssessments: PhotoAssessment[]; observations: RawObservation[] } {
  let candidate: unknown;
  try {
    candidate = JSON.parse(responseText);
  } catch {
    throw new AppError(
      "INVALID_AI_RESPONSE",
      "The image analysis returned unreadable data. No delivery conclusion was produced.",
      502,
    );
  }

  const parsed = responseSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_AI_RESPONSE",
      "The image analysis did not pass evidence validation. No delivery conclusion was produced.",
      502,
      parsed.error.issues.slice(0, 5).map((issue) => issue.message),
    );
  }

  const assessmentNumbers = parsed.data.photo_assessments.map((item) => item.photo_number);
  const expectedNumbers = Array.from({ length: photoCount }, (_, index) => index + 1);
  if (
    new Set(assessmentNumbers).size !== assessmentNumbers.length ||
    assessmentNumbers.length !== photoCount ||
    expectedNumbers.some((number) => !assessmentNumbers.includes(number)) ||
    parsed.data.observations.some((item) => item.photo_number > photoCount)
  ) {
    throw new AppError(
      "INVALID_AI_SOURCES",
      "The image analysis referenced the wrong photos. No delivery conclusion was produced.",
      502,
    );
  }

  const overviewItems = parsed.data.observations.filter(
    (item) => item.photo_number === 1,
  );
  const overviewIds = overviewItems.map((item) => item.overview_item_id);
  const validOverviewIds = overviewIds.filter(
    (item): item is string => item !== null && /^O\d{2,}$/u.test(item),
  );
  const expectedOverviewIds = Array.from(
    { length: overviewItems.length },
    (_, index) => `O${String(index + 1).padStart(2, "0")}`,
  );
  if (
    validOverviewIds.length !== overviewItems.length ||
    new Set(validOverviewIds).size !== validOverviewIds.length ||
    expectedOverviewIds.some((id) => !validOverviewIds.includes(id))
  ) {
    throw new AppError(
      "INVALID_AI_SOURCES",
      "The image analysis did not establish a valid Photo 1 object roster. No delivery conclusion was produced.",
      502,
    );
  }
  const overviewIdSet = new Set(validOverviewIds);

  const observations: RawObservation[] = parsed.data.observations.map((item) => {
    const isOverviewObservation = item.photo_number === 1;
    // The provider occasionally copies the printed field caption (`SKU:`) into
    // the structured value. Remove only that presentation wrapper and other
    // explicitly safe typography; identity-bearing characters remain exact.
    let normalizedSku = item.sku === null ? null : normalizeSku(item.sku);
    const hasValidReference =
      item.overview_item_id !== null && /^O\d{2,}$/u.test(item.overview_item_id);

    if (item.overview_item_id !== null && !hasValidReference) {
      throw new AppError(
        "INVALID_AI_SOURCES",
        "An observation used an invalid Photo 1 object reference. No delivery conclusion was produced.",
        502,
      );
    }

    if (isOverviewObservation && (!hasValidReference || item.association_reason !== null)) {
      throw new AppError(
        "INVALID_AI_SOURCES",
        "A Photo 1 observation had an invalid object reference. No delivery conclusion was produced.",
        502,
      );
    }
    if (!isOverviewObservation && hasValidReference) {
      if (!overviewIdSet.has(item.overview_item_id!) || item.association_reason === null) {
        throw new AppError(
          "INVALID_AI_SOURCES",
          "A detail observation did not safely reference an object from Photo 1. No delivery conclusion was produced.",
          502,
        );
      }
    }
    if (
      !isOverviewObservation &&
      item.overview_item_id === null &&
      item.association_reason !== null
    ) {
      throw new AppError(
        "INVALID_AI_SOURCES",
        "An unlinked detail observation claimed an association. No delivery conclusion was produced.",
        502,
      );
    }

    const suppliedUncertaintyReason = item.uncertainty_reason?.trim() || null;
    const isUnlinkedDetail =
      !isOverviewObservation && item.overview_item_id === null;
    const skuSupportedByVisibleText =
      normalizedSku === null || labelContainsExactSku(item.label_text, normalizedSku);

    // A self-contradictory model observation is still useful as an uncertain
    // region, but not as identity evidence. Quarantine only the SKU assertion;
    // malformed sources and coordinates continue to fail the whole response.
    // An unlinked detail is allowed to have a readable SKU plus an uncertainty
    // reason about the cross-photo association.
    if (
      normalizedSku !== null &&
      (!skuSupportedByVisibleText || (!isUnlinkedDetail && suppliedUncertaintyReason !== null))
    ) {
      normalizedSku = null;
    }

    const hasUnreadableSku = normalizedSku === null;
    const needsUncertaintyReason = hasUnreadableSku || isUnlinkedDetail;
    let uncertaintyReason = suppliedUncertaintyReason;

    if (hasUnreadableSku && uncertaintyReason === null && !skuSupportedByVisibleText) {
      uncertaintyReason =
        "The structured SKU assertion was not supported by the visible label transcription; this region remains unverified.";
    }

    if (needsUncertaintyReason && uncertaintyReason === null) {
      if (hasUnreadableSku && isUnlinkedDetail) {
        uncertaintyReason =
          "No SKU was confidently transcribed from this image region, and this detail region was not safely linked to one Photo 1 item; it remains unverified.";
      } else if (hasUnreadableSku) {
        uncertaintyReason =
          "No SKU was confidently transcribed from this image region; it remains unverified.";
      } else {
        uncertaintyReason =
          "This detail region was not safely linked to one Photo 1 item; it cannot support identity or quantity.";
      }
    }

    const [yMin, xMin, yMax, xMax] = item.box_2d;
    return {
      photoNumber: item.photo_number,
      overviewItemId: item.overview_item_id,
      sku: normalizedSku,
      labelText: item.label_text,
      objectDescription: item.object_description,
      bbox: {
        x: xMin,
        y: yMin,
        width: xMax - xMin,
        height: yMax - yMin,
      },
      associationReason: item.association_reason,
      uncertaintyReason,
    };
  });

  const photoAssessments: PhotoAssessment[] = parsed.data.photo_assessments.map((item) => ({
    photoNumber: item.photo_number,
    isOverview: item.is_overview,
    allItemsVisible: item.all_items_visible,
    limitations: item.limitations,
  }));

  return { photoAssessments, observations };
}
