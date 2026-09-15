import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractVisualObservations,
  VisionProcessingError,
} from "@/lib/gemini-vision";
import type { PreparedPhoto } from "@/lib/images";
import { appendMetric } from "@/lib/metrics";

vi.mock("@/lib/metrics", () => ({
  appendMetric: vi.fn().mockResolvedValue(undefined),
}));

const photo: PreparedPhoto = {
  photoNumber: 1,
  previewDataUrl: "data:image/jpeg;base64,cHJldmlldw==",
  width: 1200,
  height: 800,
  mimeType: "image/jpeg",
  bytes: Buffer.from("normalized-jpeg"),
};

const config = {
  apiKey: "AIza-unit-test-only",
  model: "gemini-3.5-flash-lite",
  timeoutMs: 5_000,
  maxRetries: 0,
  metricsLog: "unit-metrics.jsonl",
};

function observationPayload(overrides: Record<string, unknown> = {}) {
  return {
    photo_assessments: [
      {
        photo_number: 1,
        is_overview: true,
        all_items_visible: true,
        limitations: "",
      },
    ],
    observations: [
      {
        photo_number: 1,
        overview_item_id: "O01",
        sku: "PUZ-001",
        label_text: "PUZ-001 Jigsaw Puzzle",
        object_description: "A labelled puzzle box",
        box_2d: [150, 100, 550, 350],
        association_reason: null,
        uncertainty_reason: null,
      },
    ],
    ...overrides,
  };
}

function interactionResponse(
  output: unknown,
  options: {
    id?: string;
    omitId?: boolean;
    status?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    thoughtTokens?: number;
  } = {},
) {
  return new Response(
    JSON.stringify({
      ...(options.omitId
        ? {}
        : { id: options.id ?? "interaction-unit-1" }),
      status: options.status ?? "completed",
      steps: [
        {
          type: "model_output",
          content: [{ type: "text", text: JSON.stringify(output) }],
        },
      ],
      usage: {
        total_input_tokens: options.inputTokens ?? 120,
        total_output_tokens: options.outputTokens ?? 35,
        total_tokens: options.totalTokens ?? 160,
        total_thought_tokens: options.thoughtTokens ?? 5,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("Gemini visual observation adapter", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(appendMetric).mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends only normalized photo evidence and accepts a validated response", async () => {
    fetchMock.mockResolvedValue(interactionResponse(observationPayload()));

    const result = await extractVisualObservations([photo], config, "request-unit-1");

    expect(result).toMatchObject({
      attempts: 1,
      usage: {
        inputTokens: 120,
        outputTokens: 35,
        totalTokens: 160,
        reasoningTokens: 5,
      },
      observations: [
        {
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "PUZ-001",
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
    );
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
    });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "gemini-3.5-flash-lite",
      store: false,
      generation_config: {
        max_output_tokens: 4_000,
        thinking_level: "low",
        thinking_summaries: "none",
      },
      response_format: {
        type: "text",
        mime_type: "application/json",
      },
    });
    expect(body.system_instruction).toMatch(/untrusted data/i);
    expect(body.system_instruction).toMatch(/sole count-bearing overview/i);
    expect(body.system_instruction).toMatch(/non-null sku.*label_text/i);
    expect(body.system_instruction).toMatch(/exclude.*field caption.*SKU:/i);
    expect(body.system_instruction).not.toMatch(/printed instance/i);
    expect(body.response_format.schema).toMatchObject({
      type: "object",
      required: ["photo_assessments", "observations"],
    });
    expect(
      body.response_format.schema.properties.observations.items.properties.box_2d,
    ).toMatchObject({
      type: "array",
      description: expect.stringContaining("[y_min, x_min, y_max, x_max]"),
    });
    expect(JSON.stringify(body.response_format.schema)).not.toMatch(
      /additionalProperties|minItems|maxItems|minimum|maximum/,
    );
    expect(body.input).toEqual([
      expect.objectContaining({ type: "text" }),
      {
        type: "text",
        text: "PHOTO 1 (1200 x 800 pixels) follows.",
      },
      {
        type: "image",
        data: photo.bytes.toString("base64"),
        mime_type: "image/jpeg",
        resolution: "high",
      },
    ]);
    expect(String(init?.body)).not.toContain("preview");
    expect(vi.mocked(appendMetric)).toHaveBeenCalledWith(
      config.metricsLog,
      expect.objectContaining({
        outcome: "valid",
        providerStatus: 200,
        providerReason: null,
      }),
    );
  });

  it("fails before making a request when the key is absent", async () => {
    await expect(
      extractVisualObservations(
        [photo],
        { ...config, apiKey: "" },
        "request-no-key",
      ),
    ).rejects.toMatchObject({
      code: "AI_NOT_CONFIGURED",
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a completed stateless response without an interaction id", async () => {
    fetchMock.mockResolvedValue(
      interactionResponse(observationPayload(), { omitId: true }),
    );

    const result = await extractVisualObservations(
      [photo],
      config,
      "request-stateless-no-id",
    );

    expect(result.observations).toHaveLength(1);
    expect(vi.mocked(appendMetric)).toHaveBeenCalledWith(
      config.metricsLog,
      expect.objectContaining({ responseId: null, outcome: "valid" }),
    );
  });

  it("keeps a null-SKU region unverified when the model omits its explanation", async () => {
    const unreadablePayload = observationPayload({
      observations: [
        {
          ...observationPayload().observations[0],
          sku: null,
          label_text: "covered label",
          uncertainty_reason: null,
        },
      ],
    });
    fetchMock.mockResolvedValue(interactionResponse(unreadablePayload));

    const result = await extractVisualObservations(
      [photo],
      { ...config, maxRetries: 1 },
      "request-safe-uncertainty-fallback",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      attempts: 1,
      observations: [
        {
          sku: null,
          overviewItemId: "O01",
          bbox: { x: 100, y: 150, width: 250, height: 400 },
          uncertaintyReason: expect.stringMatching(/remains unverified/i),
        },
      ],
    });
    expect(vi.mocked(appendMetric)).toHaveBeenCalledWith(
      config.metricsLog,
      expect.objectContaining({ outcome: "valid" }),
    );
  });

  it("rejects incomplete provider output even if it contains plausible JSON", async () => {
    fetchMock.mockResolvedValue(
      interactionResponse(observationPayload(), { status: "incomplete" }),
    );

    await expect(
      extractVisualObservations([photo], config, "request-incomplete"),
    ).rejects.toMatchObject({
      code: "INVALID_AI_RESPONSE",
      attempts: 1,
    });
  });

  it("reports Google's structured invalid-key response as an auth failure", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            error: {
              code: 400,
              message: "API key not valid.",
              details: [{ reason: "API_KEY_INVALID" }],
            },
          },
        ]),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      extractVisualObservations([photo], config, "request-invalid-key"),
    ).rejects.toMatchObject({
      code: "AI_AUTH_FAILED",
      status: 503,
      attempts: 1,
    });
  });

  it("retries an invalid evidence response once and aggregates actual usage", async () => {
    fetchMock
      .mockResolvedValueOnce(
        interactionResponse(
          observationPayload({
            observations: [
              {
                ...observationPayload().observations[0],
                box_2d: [150, 900, 550, 850],
              },
            ],
          }),
          { omitId: true, totalTokens: 160 },
        ),
      )
      .mockResolvedValueOnce(
        interactionResponse(observationPayload(), {
          omitId: true,
          inputTokens: 110,
          outputTokens: 30,
          totalTokens: 145,
          thoughtTokens: 5,
        }),
      );

    const result = await extractVisualObservations(
      [photo],
      { ...config, maxRetries: 1 },
      "request-retry",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(JSON.stringify(firstBody.input)).not.toMatch(/preceding extraction/i);
    expect(JSON.stringify(secondBody.input)).toMatch(
      /preceding extraction.*box_2d/i,
    );
    expect(JSON.stringify(secondBody.input)).toMatch(/non-null sku.*label_text/i);
    expect(JSON.stringify(secondBody.input)).toMatch(
      /every sku:null observation.*non-empty uncertainty_reason/i,
    );
    expect(JSON.stringify(secondBody.input)).toMatch(
      /every unlinked detail.*non-empty uncertainty_reason/i,
    );
    expect(JSON.stringify(secondBody.input)).not.toContain("PUZ-001 Jigsaw Puzzle");
    expect(result.attempts).toBe(2);
    expect(result.usage).toEqual({
      inputTokens: 230,
      outputTokens: 65,
      totalTokens: 305,
      reasoningTokens: 10,
    });
    expect(vi.mocked(appendMetric)).toHaveBeenNthCalledWith(
      1,
      config.metricsLog,
      expect.objectContaining({ outcome: "invalid_response" }),
    );
    expect(vi.mocked(appendMetric)).toHaveBeenNthCalledWith(
      2,
      config.metricsLog,
      expect.objectContaining({ outcome: "valid" }),
    );
  });

  it("still fails closed when the validation-guided retry has an invalid box", async () => {
    const invalidPayload = observationPayload({
      observations: [
        {
          ...observationPayload().observations[0],
          box_2d: [150, 900, 550, 850],
        },
      ],
    });
    fetchMock
      .mockResolvedValueOnce(interactionResponse(invalidPayload))
      .mockResolvedValueOnce(interactionResponse(invalidPayload));

    await expect(
      extractVisualObservations(
        [photo],
        { ...config, maxRetries: 1 },
        "request-invalid-retry",
      ),
    ).rejects.toMatchObject({
      code: "INVALID_AI_RESPONSE",
      attempts: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(JSON.stringify(retryBody.input)).toMatch(
      /preceding extraction.*box_2d/i,
    );
  });

  it("does not present a partial retry token count as a complete aggregate", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "interaction-no-usage",
            status: "completed",
            steps: [
              {
                type: "model_output",
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      observationPayload({
                        observations: [
                          {
                            ...observationPayload().observations[0],
                            box_2d: [150, 900, 550, 850],
                          },
                        ],
                      }),
                    ),
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(interactionResponse(observationPayload()));

    const result = await extractVisualObservations(
      [photo],
      { ...config, maxRetries: 1 },
      "request-partial-usage",
    );

    expect(result.usage).toEqual({
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      reasoningTokens: null,
    });
  });

  it("keeps aggregate usage unknown after a timed-out attempt succeeds on retry", async () => {
    fetchMock
      .mockImplementationOnce((_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
      )
      .mockResolvedValueOnce(interactionResponse(observationPayload()));

    const result = await extractVisualObservations(
      [photo],
      { ...config, timeoutMs: 1, maxRetries: 1 },
      "request-timeout-retry",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(JSON.stringify(retryBody.input)).not.toMatch(/preceding extraction/i);
    expect(result.attempts).toBe(2);
    expect(result.usage).toEqual({
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      reasoningTokens: null,
    });
  });

  it("maps a free-tier quota response without producing evidence", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 429,
            status: "RESOURCE_EXHAUSTED",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );

    try {
      await extractVisualObservations([photo], config, "request-quota");
      throw new Error("Expected quota failure");
    } catch (error) {
      expect(error).toBeInstanceOf(VisionProcessingError);
      expect(error).toMatchObject({
        code: "AI_CAPACITY_LIMIT",
        status: 503,
        attempts: 1,
      });
    }
    expect(vi.mocked(appendMetric)).toHaveBeenCalledWith(
      config.metricsLog,
      expect.objectContaining({
        outcome: "api_error",
        providerStatus: 429,
        providerReason: "RESOURCE_EXHAUSTED",
      }),
    );
  });

  it("maps the current Interactions rate-limit error code", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "rate_limit_exceeded",
            message: "Project rate limit reached.",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      extractVisualObservations([photo], config, "request-current-quota"),
    ).rejects.toMatchObject({
      code: "AI_CAPACITY_LIMIT",
      status: 503,
      attempts: 1,
    });
    expect(vi.mocked(appendMetric)).toHaveBeenCalledWith(
      config.metricsLog,
      expect.objectContaining({
        providerStatus: 400,
        providerReason: "rate_limit_exceeded",
      }),
    );
  });
});
