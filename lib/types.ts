export type ResultStatus =
  | "confirmed_match"
  | "visible_mismatch"
  | "needs_another_photo";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OrderLine {
  lineNumber: number;
  sku: string;
  normalizedSku: string;
  product: string;
  expectedQuantity: number;
  sourceText: string;
  sourcePdfPage: 1;
}

export interface PhotoAssessment {
  photoNumber: number;
  isOverview: boolean;
  allItemsVisible: boolean;
  limitations: string;
}

export interface RawObservation {
  photoNumber: number;
  /**
   * Response-local reference assigned from Photo 1 (O01, O02, ...).
   * It is analysis metadata, never a printed label the user must provide.
   */
  overviewItemId: string | null;
  sku: string | null;
  labelText: string;
  objectDescription: string;
  bbox: BoundingBox;
  associationReason: string | null;
  uncertaintyReason: string | null;
}

export interface ObservationEvidence extends RawObservation {
  evidenceId: string;
  normalizedOverviewItemId: string | null;
  normalizedSku: string | null;
}

export interface CountedItemEvidence {
  overviewItemId: string;
  sku: string;
  observations: ObservationEvidence[];
  overviewEvidenceId: string;
  bestEvidenceId: string;
}

export interface LineResult {
  line: OrderLine;
  confirmedQuantity: number;
  quantityIsLowerBound: boolean;
  status: ResultStatus;
  explanation: string;
  confirmedItems: CountedItemEvidence[];
  overageEvidence: ObservationEvidence[];
  identityMismatchEvidence: ObservationEvidence[];
  uncertaintyEvidence: ObservationEvidence[];
  reviewedPhotoNumbers: number[];
}

export type UnresolvedKind =
  | "unlinked_detail"
  | "unreadable_sku"
  | "conflicting_item"
  | "duplicate_overview_item"
  | "overlapping_overview_items"
  | "detail_only_item"
  | "unmatched_sku";

export interface UnresolvedObservation {
  unresolvedId: string;
  kind: UnresolvedKind;
  title: string;
  explanation: string;
  overviewItemId: string | null;
  visibleSku: string | null;
  relatedLineNumber: number | null;
  evidence: ObservationEvidence[];
}

export interface ReconciliationResult {
  lines: LineResult[];
  unresolved: UnresolvedObservation[];
  reviewedPhotoNumbers: number[];
  captureComplete: boolean;
  captureLimitations: string[];
  stats: {
    confirmedLines: number;
    mismatchLines: number;
    needsPhotoLines: number;
    unresolvedObservations: number;
  };
}

export interface NormalizedPhoto {
  photoNumber: number;
  previewDataUrl: string;
  width: number;
  height: number;
}

export interface UsageMetrics {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
}

export interface ProcessingMetrics {
  requestId: string;
  model: string;
  serverDurationMs: number;
  aiDurationMs: number;
  attempts: number;
  usage: UsageMetrics;
}

export interface CheckResponse {
  requestId: string;
  orderLines: OrderLine[];
  photos: NormalizedPhoto[];
  result: ReconciliationResult;
  metrics: ProcessingMetrics;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: string[];
  };
}
