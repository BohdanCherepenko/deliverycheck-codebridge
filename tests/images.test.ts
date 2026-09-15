import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { preparePhoto } from "@/lib/images";

describe("photo normalization", () => {
  it("applies camera orientation before returning the exact preview/API pixels", async () => {
    const input = await sharp({
      create: {
        width: 80,
        height: 40,
        channels: 3,
        background: "#d8eadf",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const file = new File([input], "unit-orientation.jpg", { type: "image/jpeg" });

    const result = await preparePhoto(file, 1);
    expect(result).toMatchObject({
      photoNumber: 1,
      width: 40,
      height: 80,
      mimeType: "image/jpeg",
    });
    expect(result.previewDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.orientation).toBeUndefined();
  });

  it("rejects bytes that are not a supported decodable image", async () => {
    const file = new File(["not an image"], "fake.jpg", { type: "image/jpeg" });
    await expect(preparePhoto(file, 1)).rejects.toMatchObject({
      code: "PHOTO_READ_FAILED",
      status: 422,
    });
  });
});
