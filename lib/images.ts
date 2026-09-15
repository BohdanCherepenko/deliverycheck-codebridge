import sharp from "sharp";

import { MAX_PHOTO_BYTES } from "@/lib/config";
import { AppError } from "@/lib/errors";
import type { NormalizedPhoto } from "@/lib/types";

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_DIMENSION = 1800;

export interface PreparedPhoto extends NormalizedPhoto {
  mimeType: "image/jpeg";
  bytes: Buffer;
}

export async function preparePhoto(file: File, photoNumber: number): Promise<PreparedPhoto> {
  if (file.size === 0) {
    throw new AppError("EMPTY_PHOTO", `Photo ${photoNumber} is empty.`, 400);
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new AppError(
      "PHOTO_TOO_LARGE",
      `Photo ${photoNumber} must be 8 MB or smaller.`,
      413,
    );
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input, {
      failOn: "warning",
      limitInputPixels: 40_000_000,
    }).metadata();
    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      throw new AppError(
        "UNSUPPORTED_PHOTO",
        `Photo ${photoNumber} must be a JPEG, PNG, or WebP image.`,
        415,
      );
    }

    const { data, info } = await sharp(input, {
      failOn: "warning",
      limitInputPixels: 40_000_000,
    })
      .autoOrient()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
      .toBuffer({ resolveWithObject: true });

    return {
      photoNumber,
      previewDataUrl: `data:image/jpeg;base64,${data.toString("base64")}`,
      width: info.width,
      height: info.height,
      mimeType: "image/jpeg",
      bytes: data,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "PHOTO_READ_FAILED",
      `Photo ${photoNumber} could not be decoded. Choose a valid JPEG, PNG, or WebP image.`,
      422,
    );
  }
}
