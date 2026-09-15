import type {
  BoundingBox,
  CountedItemEvidence,
  LineResult,
  ObservationEvidence,
  OrderLine,
  PhotoAssessment,
  RawObservation,
  ReconciliationResult,
  UnresolvedObservation,
} from "./types";

const SKU_FIELD_PREFIX = /^(?:SKU\s*:\s*)+/u;
const UNICODE_DASH_VARIANTS = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/gu;

function normalizeSkuTypography(value: string): string {
  return value
    .normalize("NFKC")
    .toUpperCase()
    .replace(UNICODE_DASH_VARIANTS, "-")
    .replace(/\s*-\s*/g, "-");
}

/** Normalize presentation-only formatting that cannot change SKU identity. */
export function normalizeSku(value: string): string {
  return normalizeSkuTypography(value).trim().replace(SKU_FIELD_PREFIX, "");
}

/** Require the asserted SKU to occur as a complete visible label token. */
export function labelContainsExactSku(labelText: string, sku: string): boolean {
  const haystack = normalizeSkuTypography(labelText);
  const needle = normalizeSku(sku);
  if (needle.length === 0) return false;

  // Match the SKU alphabet accepted by the PDF parser. Significant SKU
  // punctuation must be part of the boundary check too: `ABC` is not an exact
  // visible token inside `ABC-X`, `ABC/2`, `ABC.2`, or `ABC_2`.
  const isSkuCharacter = (value: string | undefined) =>
    value !== undefined && /[\p{L}\p{N}._/\-]/u.test(value);
  let start = 0;
  while (start <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, start);
    if (index < 0) return false;
    const before = index === 0 ? undefined : haystack[index - 1];
    const afterIndex = index + needle.length;
    const after = afterIndex >= haystack.length ? undefined : haystack[afterIndex];
    const leftSafe = !isSkuCharacter(needle[0]) || !isSkuCharacter(before);
    const rightSafe =
      !isSkuCharacter(needle[needle.length - 1]) || !isSkuCharacter(after);
    if (leftSafe && rightSafe) return true;
    start = index + 1;
  }
  return false;
}

/** O01 is response-local analysis metadata, not text printed on an item. */
export function normalizeOverviewItemId(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.normalize("NFKC").trim().toUpperCase();
  return /^O\d{2,}$/u.test(normalized) ? normalized : null;
}

/** Bounding boxes use the normalized 0..1000 image coordinate space. */
export function isNormalizedBoundingBox(value: unknown): value is BoundingBox {
  if (typeof value !== "object" || value === null) return false;

  const box = value as Partial<BoundingBox>;
  const numbers = [box.x, box.y, box.width, box.height];
  if (!numbers.every((item) => typeof item === "number" && Number.isFinite(item))) {
    return false;
  }

  const { x, y, width, height } = box as BoundingBox;
  const epsilon = 1e-9;
  return (
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x + width <= 1000 + epsilon &&
    y + height <= 1000 + epsilon
  );
}

interface ConsolidatedItem extends CountedItemEvidence {}

interface MutableUnresolved {
  kind: UnresolvedObservation["kind"];
  title: string;
  explanation: string;
  overviewItemId: string | null;
  visibleSku: string | null;
  relatedLineNumber: number | null;
  evidence: ObservationEvidence[];
}

const NO_LIMITATION_VALUES = new Set([
  "",
  "N/A",
  "NA",
  "NONE",
  "NO LIMITATIONS",
  "NOT APPLICABLE",
]);

function hasMeaningfulLimitation(value: string): boolean {
  return !NO_LIMITATION_VALUES.has(value.normalize("NFKC").trim().toUpperCase());
}

function intersectionOverSmallerBox(a: BoundingBox, b: BoundingBox): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const smallerArea = Math.min(a.width * a.height, b.width * b.height);
  return smallerArea === 0 ? 0 : intersection / smallerArea;
}

function chooseBestEvidence(observations: ObservationEvidence[]): ObservationEvidence {
  return [...observations].sort((left, right) => {
    const leftReadable = left.normalizedSku === null ? 0 : 1;
    const rightReadable = right.normalizedSku === null ? 0 : 1;
    if (leftReadable !== rightReadable) return rightReadable - leftReadable;

    const labelDifference = right.labelText.trim().length - left.labelText.trim().length;
    if (labelDifference !== 0) return labelDifference;

    const areaDifference =
      right.bbox.width * right.bbox.height - left.bbox.width * left.bbox.height;
    if (areaDifference !== 0) return areaDifference;

    return left.evidenceId.localeCompare(right.evidenceId);
  })[0];
}

function skuFamily(sku: string): string | null {
  const match = sku.match(/^(.*\D)\d+$/u);
  if (!match) return null;
  const family = match[1];
  return family.replace(/[^\p{L}\p{N}]/gu, "").length >= 3 ? family : null;
}

function productIdentityTokens(product: string): string[] {
  const tokens = product
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}]+/gu);
  if (!tokens) return [];

  return [
    ...new Set(tokens.filter((token) => token.length >= 2 && !/\d/u.test(token))),
  ];
}

function labelHasProductIdentity(labelText: string, product: string): boolean {
  const requiredTokens = productIdentityTokens(product);
  if (requiredTokens.length === 0) return false;

  const visibleTokens = new Set(
    labelText
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .match(/[\p{L}\p{N}]+/gu) ?? [],
  );
  return requiredTokens.every((token) => visibleTokens.has(token));
}

function conservativeRelatedLine(
  sku: string,
  observations: ObservationEvidence[],
  lines: OrderLine[],
): OrderLine | null {
  const family = skuFamily(sku);
  if (family === null) return null;

  const combinedVisibleLabel = observations.map((item) => item.labelText).join(" ");
  const candidates = lines.filter((line) => {
    const lineSku = normalizeSku(line.sku);
    return (
      lineSku !== sku &&
      skuFamily(lineSku) === family &&
      labelHasProductIdentity(combinedVisibleLabel, line.product)
    );
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function evidenceFromRaw(
  observation: RawObservation,
  evidenceId: string,
): ObservationEvidence {
  const verifiedSku =
    observation.sku === null ||
    !labelContainsExactSku(observation.labelText, observation.sku)
      ? null
      : observation.sku;
  const normalizedSku = verifiedSku === null ? null : normalizeSku(verifiedSku);
  return {
    ...observation,
    sku: verifiedSku,
    evidenceId,
    normalizedOverviewItemId: normalizeOverviewItemId(observation.overviewItemId),
    normalizedSku: normalizedSku === "" ? null : normalizedSku,
  };
}

function validRawObservation(value: unknown): value is RawObservation {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RawObservation>;
  return (
    typeof candidate.photoNumber === "number" &&
    Number.isInteger(candidate.photoNumber) &&
    candidate.photoNumber > 0 &&
    (candidate.overviewItemId === null || typeof candidate.overviewItemId === "string") &&
    (candidate.sku === null || typeof candidate.sku === "string") &&
    typeof candidate.labelText === "string" &&
    typeof candidate.objectDescription === "string" &&
    (candidate.associationReason === null ||
      typeof candidate.associationReason === "string") &&
    (candidate.uncertaintyReason === null ||
      typeof candidate.uncertaintyReason === "string") &&
    isNormalizedBoundingBox(candidate.bbox)
  );
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function displayOverviewItem(id: string): string {
  return `Photo 1 item ${Number.parseInt(id.slice(1), 10)}`;
}

function referencesDistinctRegionsInOnePhoto(
  observations: ObservationEvidence[],
): boolean {
  const byPhoto = new Map<number, ObservationEvidence[]>();
  for (const observation of observations) {
    const list = byPhoto.get(observation.photoNumber) ?? [];
    list.push(observation);
    byPhoto.set(observation.photoNumber, list);
  }

  for (const samePhoto of byPhoto.values()) {
    for (let left = 0; left < samePhoto.length; left += 1) {
      for (let right = left + 1; right < samePhoto.length; right += 1) {
        if (intersectionOverSmallerBox(samePhoto[left].bbox, samePhoto[right].bbox) < 0.2) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Quarantine potentially duplicate Photo 1 detections before counting. */
function overlappingOverviewComponents(
  evidence: ObservationEvidence[],
): Array<Set<string>> {
  const anchors = evidence.filter(
    (item) => item.photoNumber === 1 && item.normalizedOverviewItemId !== null,
  );
  const neighbours = new Map<string, Set<string>>();
  const connect = (left: string, right: string) => {
    const values = neighbours.get(left) ?? new Set<string>();
    values.add(right);
    neighbours.set(left, values);
  };

  for (let left = 0; left < anchors.length; left += 1) {
    for (let right = left + 1; right < anchors.length; right += 1) {
      const leftId = anchors[left].normalizedOverviewItemId!;
      const rightId = anchors[right].normalizedOverviewItemId!;
      if (
        leftId !== rightId &&
        intersectionOverSmallerBox(anchors[left].bbox, anchors[right].bbox) >= 0.2
      ) {
        connect(leftId, rightId);
        connect(rightId, leftId);
      }
    }
  }

  const components: Array<Set<string>> = [];
  const visited = new Set<string>();
  for (const first of neighbours.keys()) {
    if (visited.has(first)) continue;
    const component = new Set<string>();
    const pending = [first];
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined || component.has(current)) continue;
      component.add(current);
      visited.add(current);
      for (const neighbour of neighbours.get(current) ?? []) pending.push(neighbour);
    }
    components.push(component);
  }
  return components;
}

/**
 * One detail region cannot safely identify two different overview objects.
 * Near-identical cross-links are removed before identity consolidation so one
 * close-up cannot donate its readable SKU to multiple count-bearing anchors.
 */
function overlappingDetailLinkEvidence(
  evidence: ObservationEvidence[],
): ObservationEvidence[] {
  const linkedDetails = evidence.filter(
    (item) => item.photoNumber > 1 && item.normalizedOverviewItemId !== null,
  );
  const suspectIds = new Set<string>();
  for (let left = 0; left < linkedDetails.length; left += 1) {
    for (let right = left + 1; right < linkedDetails.length; right += 1) {
      const first = linkedDetails[left];
      const second = linkedDetails[right];
      if (
        first.photoNumber === second.photoNumber &&
        first.normalizedOverviewItemId !== second.normalizedOverviewItemId &&
        intersectionOverSmallerBox(first.bbox, second.bbox) >= 0.5
      ) {
        suspectIds.add(first.evidenceId);
        suspectIds.add(second.evidenceId);
      }
    }
  }
  return evidence.filter((item) => suspectIds.has(item.evidenceId));
}

export function reconcileDelivery(
  orderLines: OrderLine[],
  observations: RawObservation[],
  photoAssessments: PhotoAssessment[],
): ReconciliationResult {
  const reviewedPhotoNumbers = [
    ...new Set([
      ...photoAssessments
        .filter(
          (assessment) =>
            Number.isInteger(assessment.photoNumber) && assessment.photoNumber > 0,
        )
        .map((assessment) => assessment.photoNumber),
      ...observations
        .filter(
          (observation) =>
            typeof observation?.photoNumber === "number" &&
            Number.isInteger(observation.photoNumber) &&
            observation.photoNumber > 0,
        )
        .map((observation) => observation.photoNumber),
    ]),
  ].sort((left, right) => left - right);

  let ignoredObservationCount = 0;
  const ordinalByPhoto = new Map<number, number>();
  const evidence: ObservationEvidence[] = [];
  for (const observation of observations) {
    if (!validRawObservation(observation)) {
      ignoredObservationCount += 1;
      continue;
    }
    const ordinal = (ordinalByPhoto.get(observation.photoNumber) ?? 0) + 1;
    ordinalByPhoto.set(observation.photoNumber, ordinal);
    evidence.push(
      evidenceFromRaw(observation, `photo-${observation.photoNumber}-observation-${ordinal}`),
    );
  }

  const exactLinesBySku = new Map<string, OrderLine[]>();
  for (const line of orderLines) {
    const sku = normalizeSku(line.sku);
    const matches = exactLinesBySku.get(sku) ?? [];
    matches.push(line);
    exactLinesBySku.set(sku, matches);
  }
  const uniqueExactLine = (sku: string | null): OrderLine | null => {
    if (sku === null) return null;
    const matches = exactLinesBySku.get(sku) ?? [];
    return matches.length === 1 ? matches[0] : null;
  };

  const unresolvedDrafts: MutableUnresolved[] = [];
  const overlappingComponents = overlappingOverviewComponents(evidence);
  const overlappingOverviewIds = new Set(
    overlappingComponents.flatMap((component) => [...component]),
  );
  const overviewAnchorsById = new Map<string, ObservationEvidence[]>();
  for (const item of evidence) {
    if (item.photoNumber !== 1 || item.normalizedOverviewItemId === null) continue;
    const anchors = overviewAnchorsById.get(item.normalizedOverviewItemId) ?? [];
    anchors.push(item);
    overviewAnchorsById.set(item.normalizedOverviewItemId, anchors);
  }

  const ambiguousDetailLinks = overlappingDetailLinkEvidence(evidence);
  const ambiguousDetailEvidenceIds = new Set(
    ambiguousDetailLinks.map((item) => item.evidenceId),
  );
  const ambiguousDetailOverviewIds = [
    ...new Set(
      ambiguousDetailLinks
        .map((item) => item.normalizedOverviewItemId)
        .filter((id): id is string => id !== null),
    ),
  ];
  // A duplicated close-up is redundant—not delivery ambiguity—when every
  // referenced object already has its own trustworthy identity in Photo 1.
  // The suspect close-ups are still discarded below in both cases.
  const everyAmbiguousDetailHasIndependentOverviewIdentity =
    ambiguousDetailLinks.length > 0 &&
    ambiguousDetailOverviewIds.every((id) => {
      const anchors = overviewAnchorsById.get(id) ?? [];
      return (
        anchors.length === 1 &&
        anchors[0].normalizedSku !== null &&
        anchors[0].uncertaintyReason === null &&
        !overlappingOverviewIds.has(id)
      );
    });
  const blockingAmbiguousDetailLinks =
    ambiguousDetailLinks.length > 0 &&
    !everyAmbiguousDetailHasIndependentOverviewIdentity;

  if (blockingAmbiguousDetailLinks) {
    const visibleSkus = [
      ...new Set(
        ambiguousDetailLinks
          .map((item) => item.normalizedSku)
          .filter((sku): sku is string => sku !== null),
      ),
    ];
    const soleSku = visibleSkus.length === 1 ? visibleSkus[0] : null;
    const linkedIds = [
      ...new Set(
        ambiguousDetailLinks
          .map((item) => item.normalizedOverviewItemId)
          .filter((id): id is string => id !== null),
      ),
    ];
    unresolvedDrafts.push({
      kind: "conflicting_item",
      title: "Ambiguous detail links",
      explanation: `Substantially overlapping regions in the same detail photo were linked to different overview objects (${linkedIds.map(displayOverviewItem).join(", ")}). Those links are ignored so one close-up cannot identify or count multiple units. Add a wider contextual photo.`,
      overviewItemId: null,
      visibleSku: soleSku,
      relatedLineNumber: uniqueExactLine(soleSku)?.lineNumber ?? null,
      evidence: ambiguousDetailLinks,
    });
  }
  const groupsByOverviewItem = new Map<string, ObservationEvidence[]>();
  for (const item of evidence) {
    if (item.normalizedOverviewItemId === null) {
      const exactLine = uniqueExactLine(item.normalizedSku);
      unresolvedDrafts.push({
        kind: "unlinked_detail",
        title: "Detail view not linked to Photo 1",
        explanation:
          "This detail region could not be safely linked to one physical object in the count-bearing overview. It is retained as evidence but cannot add an item or quantity.",
        overviewItemId: null,
        visibleSku: item.normalizedSku,
        relatedLineNumber: exactLine?.lineNumber ?? null,
        evidence: [item],
      });
      continue;
    }
    if (ambiguousDetailEvidenceIds.has(item.evidenceId)) {
      continue;
    }
    const group = groupsByOverviewItem.get(item.normalizedOverviewItemId) ?? [];
    group.push(item);
    groupsByOverviewItem.set(item.normalizedOverviewItemId, group);
  }

  const overlappingById = new Map<string, Set<string>>();
  for (const component of overlappingComponents) {
    for (const id of component) overlappingById.set(id, component);
  }
  const handledOverlapIds = new Set<string>();
  const consolidated: ConsolidatedItem[] = [];

  for (const [overviewItemId, itemObservations] of groupsByOverviewItem) {
    const overviewObservations = itemObservations.filter((item) => item.photoNumber === 1);
    if (overviewObservations.length === 0) {
      const visibleSkus = [
        ...new Set(
          itemObservations
            .map((item) => item.normalizedSku)
            .filter((sku): sku is string => sku !== null),
        ),
      ];
      const soleSku = visibleSkus.length === 1 ? visibleSkus[0] : null;
      unresolvedDrafts.push({
        kind: "detail_only_item",
        title: "Object appears only in a detail photo",
        explanation:
          "Later photos cannot introduce a physical unit. This observation has no validated region in Photo 1, so it is not counted.",
        overviewItemId,
        visibleSku: soleSku,
        relatedLineNumber: uniqueExactLine(soleSku)?.lineNumber ?? null,
        evidence: itemObservations,
      });
      continue;
    }

    if (overviewObservations.length !== 1) {
      unresolvedDrafts.push({
        kind: "duplicate_overview_item",
        title: `Duplicate Photo 1 reference ${overviewItemId}`,
        explanation: `${displayOverviewItem(overviewItemId)} was assigned to more than one region in Photo 1. Those regions are not counted until a clearer overview establishes separate objects.`,
        overviewItemId,
        visibleSku: null,
        relatedLineNumber: null,
        evidence: itemObservations,
      });
      continue;
    }

    const overlapComponent = overlappingById.get(overviewItemId);
    if (overlapComponent) {
      if (handledOverlapIds.has(overviewItemId)) continue;
      for (const id of overlapComponent) handledOverlapIds.add(id);
      const componentEvidence = evidence.filter(
        (item) =>
          item.normalizedOverviewItemId !== null &&
          overlapComponent.has(item.normalizedOverviewItemId),
      );
      const ids = [...overlapComponent].sort();
      const visibleSkus = [
        ...new Set(
          componentEvidence
            .map((item) => item.normalizedSku)
            .filter((sku): sku is string => sku !== null),
        ),
      ];
      const soleSku = visibleSkus.length === 1 ? visibleSkus[0] : null;
      unresolvedDrafts.push({
        kind: "overlapping_overview_items",
        title: "Overlapping objects in Photo 1",
        explanation: `${ids.map(displayOverviewItem).join(" and ")} have overlapping count regions. They may be duplicate detections or physically obscured items, so no visible overage is inferred from them.`,
        overviewItemId: null,
        visibleSku: soleSku,
        relatedLineNumber: uniqueExactLine(soleSku)?.lineNumber ?? null,
        evidence: componentEvidence,
      });
      continue;
    }

    if (referencesDistinctRegionsInOnePhoto(itemObservations)) {
      const visibleSkus = [
        ...new Set(
          itemObservations
            .map((item) => item.normalizedSku)
            .filter((sku): sku is string => sku !== null),
        ),
      ];
      const soleSku = visibleSkus.length === 1 ? visibleSkus[0] : null;
      unresolvedDrafts.push({
        kind: "conflicting_item",
        title: `Ambiguous link for ${displayOverviewItem(overviewItemId)}`,
        explanation:
          "The same Photo 1 reference was applied to spatially separate regions within one image. It is not counted until a detail view can be linked unambiguously.",
        overviewItemId,
        visibleSku: soleSku,
        relatedLineNumber: uniqueExactLine(soleSku)?.lineNumber ?? null,
        evidence: itemObservations,
      });
      continue;
    }

    const claimedSkus = [
      ...new Set(
        itemObservations
          .map((item) => item.normalizedSku)
          .filter((sku): sku is string => sku !== null),
      ),
    ];
    if (claimedSkus.length > 1) {
      unresolvedDrafts.push({
        kind: "conflicting_item",
        title: `Conflicting labels for ${displayOverviewItem(overviewItemId)}`,
        explanation: `${displayOverviewItem(overviewItemId)} is associated with conflicting visible SKUs (${claimedSkus.join(", ")}). It is not counted until a consistent label view is available.`,
        overviewItemId,
        visibleSku: null,
        relatedLineNumber: null,
        evidence: itemObservations,
      });
      continue;
    }

    if (claimedSkus.length === 0) {
      unresolvedDrafts.push({
        kind: "unreadable_sku",
        title: `SKU not readable for ${displayOverviewItem(overviewItemId)}`,
        explanation: `${displayOverviewItem(overviewItemId)} is established in the overview, but its SKU is not readable in any safely linked view. A clearer contextual label photo is required.`,
        overviewItemId,
        visibleSku: null,
        relatedLineNumber: null,
        evidence: itemObservations,
      });
      continue;
    }

    const sku = claimedSkus[0];
    const best = chooseBestEvidence(itemObservations);
    consolidated.push({
      overviewItemId,
      sku,
      observations: itemObservations,
      overviewEvidenceId: overviewObservations[0].evidenceId,
      bestEvidenceId: best.evidenceId,
    });
  }

  const confirmedByLine = new Map<number, CountedItemEvidence[]>();
  const identityMismatchByLine = new Map<number, ObservationEvidence[]>();
  for (const item of consolidated) {
    const exactCandidates = exactLinesBySku.get(item.sku) ?? [];
    if (exactCandidates.length === 1) {
      const lineNumber = exactCandidates[0].lineNumber;
      const matches = confirmedByLine.get(lineNumber) ?? [];
      matches.push(item);
      confirmedByLine.set(lineNumber, matches);
      continue;
    }

    if (exactCandidates.length > 1) {
      unresolvedDrafts.push({
        kind: "unmatched_sku",
        title: `SKU ${item.sku} is ambiguous in the document`,
        explanation: `Visible SKU ${item.sku} on ${displayOverviewItem(item.overviewItemId)} occurs on more than one document line, so it is not assigned automatically.`,
        overviewItemId: item.overviewItemId,
        visibleSku: item.sku,
        relatedLineNumber: null,
        evidence: item.observations,
      });
      continue;
    }

    const relatedLine = conservativeRelatedLine(item.sku, item.observations, orderLines);
    unresolvedDrafts.push({
      kind: "unmatched_sku",
      title: relatedLine
        ? `Different SKU visible near line ${relatedLine.lineNumber}`
        : `SKU ${item.sku} is not in the document`,
      explanation: relatedLine
        ? `Visible SKU ${item.sku} on ${displayOverviewItem(item.overviewItemId)} is not an exact match for document line ${relatedLine.lineNumber} (${normalizeSku(relatedLine.sku)}). Similar SKU-family and visible product-label text relate it to that line, but do not prove replacement or non-delivery.`
        : `Visible SKU ${item.sku} on ${displayOverviewItem(item.overviewItemId)} has no exact or conservative unique document match and is kept separate.`,
      overviewItemId: item.overviewItemId,
      visibleSku: item.sku,
      relatedLineNumber: relatedLine?.lineNumber ?? null,
      evidence: item.observations,
    });
    if (relatedLine) {
      const mismatches = identityMismatchByLine.get(relatedLine.lineNumber) ?? [];
      // Keep both the count-bearing overview region and any safely linked
      // readable detail. The former establishes that the object exists in the
      // roster; the latter may be the actual visual basis for the different SKU.
      mismatches.push(...item.observations);
      identityMismatchByLine.set(relatedLine.lineNumber, mismatches);
    }
  }

  const unresolved = unresolvedDrafts.map<UnresolvedObservation>((item, index) => ({
    unresolvedId: `unresolved-${String(index + 1).padStart(3, "0")}`,
    ...item,
  }));
  const ambiguityKinds = new Set<UnresolvedObservation["kind"]>([
    "unlinked_detail",
    "unreadable_sku",
    "conflicting_item",
    "duplicate_overview_item",
    "overlapping_overview_items",
    "detail_only_item",
  ]);
  const ambiguousObservations = unresolved.filter((item) => ambiguityKinds.has(item.kind));

  const overview = photoAssessments.find(
    (assessment) => assessment.photoNumber === 1 && assessment.isOverview,
  );
  // Composition and label readability are separate. A small/unreadable label
  // in Photo 1 can be resolved by a safely linked detail view without making
  // the count-bearing overview incomplete.
  const overviewComplete = Boolean(overview?.allItemsVisible);
  const captureLimitations: string[] = [];
  if (!overview) {
    captureLimitations.push("Photo 1 was not confirmed as the count-bearing overview.");
  } else if (!overview.allItemsVisible) {
    captureLimitations.push("Photo 1 does not show the complete delivery separately and uncropped.");
  }
  for (const assessment of photoAssessments) {
    if (hasMeaningfulLimitation(assessment.limitations)) {
      captureLimitations.push(`Photo ${assessment.photoNumber}: ${assessment.limitations.trim()}`);
    }
  }
  if (everyAmbiguousDetailHasIndependentOverviewIdentity) {
    captureLimitations.push(
      `${ambiguousDetailLinks.length} ambiguous detail ${pluralize(ambiguousDetailLinks.length, "region")} ${ambiguousDetailLinks.length === 1 ? "was" : "were"} ignored. Every affected object has independent exact-SKU evidence in Photo 1, so those detail links were not used.`,
    );
  }
  if (ambiguousObservations.length > 0) {
    captureLimitations.push(
      `${ambiguousObservations.length} ${pluralize(ambiguousObservations.length, "observation")} cannot be linked or counted safely.`,
    );
  }
  if (ignoredObservationCount > 0) {
    captureLimitations.push(
      `${ignoredObservationCount} invalid ${pluralize(ignoredObservationCount, "observation")} ${ignoredObservationCount === 1 ? "was" : "were"} ignored defensively.`,
    );
  }
  const uniqueCaptureLimitations = [...new Set(captureLimitations)];
  const captureComplete =
    overviewComplete && ambiguousObservations.length === 0 && ignoredObservationCount === 0;

  const ambiguityByLine = new Map<number, UnresolvedObservation[]>();
  for (const item of ambiguousObservations) {
    const candidateLines = new Set<number>();
    if (item.relatedLineNumber !== null) candidateLines.add(item.relatedLineNumber);
    for (const itemEvidence of item.evidence) {
      const exactLine = uniqueExactLine(itemEvidence.normalizedSku);
      if (exactLine) candidateLines.add(exactLine.lineNumber);
    }
    for (const lineNumber of candidateLines) {
      const values = ambiguityByLine.get(lineNumber) ?? [];
      values.push(item);
      ambiguityByLine.set(lineNumber, values);
    }
  }
  const lines: LineResult[] = orderLines.map((line) => {
    const confirmedItems = confirmedByLine.get(line.lineNumber) ?? [];
    const identityMismatchEvidence = [
      ...new Map(
        (identityMismatchByLine.get(line.lineNumber) ?? []).map((item) => [
          item.evidenceId,
          item,
        ]),
      ).values(),
    ];
    const relatedAmbiguities = ambiguityByLine.get(line.lineNumber) ?? [];
    const confirmedQuantity = confirmedItems.length;
    const hasVisibleOverage = confirmedQuantity > line.expectedQuantity;
    const hasVisibleDifferentSku = identityMismatchEvidence.length > 0;
    const hasRelatedAmbiguity = relatedAmbiguities.length > 0;
    const quantityIsLowerBound =
      !captureComplete || confirmedQuantity < line.expectedQuantity || hasRelatedAmbiguity;

    let status: LineResult["status"];
    let explanation: string;
    if (hasVisibleOverage) {
      status = "visible_mismatch";
      const ids = confirmedItems.map((item) => displayOverviewItem(item.overviewItemId));
      explanation = `Confirmed ${confirmedQuantity} separate objects from Photo 1 by exact SKU while the document expects ${line.expectedQuantity}. The visible overage is supported by separate overview regions: ${ids.join(", ")}.`;
      if (hasVisibleDifferentSku) {
        const visibleSkus = [
          ...new Set(
            identityMismatchEvidence
              .map((item) => item.normalizedSku)
              .filter((sku): sku is string => sku !== null),
          ),
        ];
        explanation += ` A different visible ${pluralize(visibleSkus.length, "SKU")} (${visibleSkus.join(", ")}) can also be conservatively related to this line, but this does not prove replacement or non-delivery.`;
      }
    } else if (hasVisibleDifferentSku) {
      status = "visible_mismatch";
      const visibleSkus = [
        ...new Set(
          identityMismatchEvidence
            .map((item) => item.normalizedSku)
            .filter((sku): sku is string => sku !== null),
        ),
      ];
      explanation = `Confirmed ${confirmedQuantity} of ${line.expectedQuantity} expected by exact SKU. Different visible ${pluralize(visibleSkus.length, "SKU")} (${visibleSkus.join(", ")}) can be conservatively related to this line, but this does not prove the ordered item was absent or replaced.`;
    } else if (confirmedQuantity < line.expectedQuantity || hasRelatedAmbiguity) {
      status = "needs_another_photo";
      explanation = `Confirmed ${confirmedQuantity} of ${line.expectedQuantity} expected ${pluralize(line.expectedQuantity, "item")} by exact SKU. This is not evidence of non-delivery; another overview or contextual label photo is needed.`;
    } else {
      status = "confirmed_match";
      explanation = `Confirmed ${confirmedQuantity} of ${line.expectedQuantity} expected ${pluralize(line.expectedQuantity, "item")} by exact SKU.`;
      if (quantityIsLowerBound) {
        explanation +=
          " The observed quantity remains a lower bound because the overview or another object is unresolved.";
      }
    }

    const overageEvidence = hasVisibleOverage
      ? confirmedItems
          .map((item) =>
            item.observations.find(
              (observation) => observation.evidenceId === item.overviewEvidenceId,
            ),
          )
          .filter((item): item is ObservationEvidence => item !== undefined)
      : [];
    const relatedUncertaintyEvidence = relatedAmbiguities.flatMap((item) => item.evidence);
    const uncertaintyEvidence = relatedUncertaintyEvidence.filter(
      (item, index, values) =>
        values.findIndex((candidate) => candidate.evidenceId === item.evidenceId) === index,
    );

    return {
      line,
      confirmedQuantity,
      quantityIsLowerBound,
      status,
      explanation,
      confirmedItems,
      overageEvidence,
      identityMismatchEvidence,
      uncertaintyEvidence,
      reviewedPhotoNumbers,
    };
  });

  return {
    lines,
    unresolved,
    reviewedPhotoNumbers,
    captureComplete,
    captureLimitations: uniqueCaptureLimitations,
    stats: {
      confirmedLines: lines.filter((line) => line.status === "confirmed_match").length,
      mismatchLines: lines.filter((line) => line.status === "visible_mismatch").length,
      needsPhotoLines: lines.filter((line) => line.status === "needs_another_photo").length,
      unresolvedObservations: unresolved.length,
    },
  };
}
