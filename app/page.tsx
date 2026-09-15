"use client";

import Image from "next/image";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ApiErrorBody,
  CheckResponse,
  LineResult,
  NormalizedPhoto,
  ObservationEvidence,
  OrderLine,
  ResultStatus,
  UnresolvedKind,
  UnresolvedObservation,
} from "@/lib/types";

const MAX_PDF_BYTES = 2 * 1024 * 1024;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 3;
const CLIENT_TIMEOUT_MS = 95_000;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type RunStatus = "idle" | "uploading" | "processing" | "error" | "result";

interface UploadPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

interface UiError {
  title: string;
  message: string;
  details?: string[];
  requestId?: string;
}

interface EvidenceContext {
  title: string;
  explanation: string;
  line: OrderLine | null;
  evidence: ObservationEvidence[];
  activeEvidenceId: string | null;
  reviewedPhotoNumbers: number[];
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: ResultStatus) {
  switch (status) {
    case "confirmed_match":
      return "Confirmed match";
    case "visible_mismatch":
      return "Visible mismatch";
    case "needs_another_photo":
      return "Needs another photo";
  }
}

function apiErrorTitle(code: string) {
  switch (code) {
    case "DEMO_RATE_LIMIT":
      return "Demo check limit reached";
    case "AI_TIMEOUT":
      return "Image analysis timed out";
    case "AI_CAPACITY_LIMIT":
      return "Image analysis is temporarily busy";
    default:
      return "Delivery could not be checked";
  }
}

function unresolvedStatus(kind: UnresolvedKind): ResultStatus {
  return kind === "unmatched_sku" ? "visible_mismatch" : "needs_another_photo";
}

function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isSupportedImage(file: File) {
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return true;
  }

  if (file.type !== "") {
    return false;
  }

  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return false;
  }

  const error = (value as { error?: unknown }).error;
  return (
    Boolean(error) &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

function isCheckResponse(value: unknown): value is CheckResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CheckResponse>;
  return (
    typeof candidate.requestId === "string" &&
    Array.isArray(candidate.orderLines) &&
    Array.isArray(candidate.photos) &&
    Boolean(candidate.result) &&
    Array.isArray(candidate.result?.lines) &&
    Array.isArray(candidate.result?.unresolved) &&
    Boolean(candidate.metrics) &&
    typeof candidate.metrics?.serverDurationMs === "number" &&
    typeof candidate.metrics?.aiDurationMs === "number"
  );
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function uniqueEvidence(values: ObservationEvidence[]) {
  const seen = new Set<string>();
  return values.filter((evidence) => {
    if (seen.has(evidence.evidenceId)) {
      return false;
    }
    seen.add(evidence.evidenceId);
    return true;
  });
}

function representativeEvidenceByObject(values: ObservationEvidence[]) {
  const selected = new Map<string, ObservationEvidence>();
  for (const evidence of uniqueEvidence(values)) {
    const key =
      evidence.normalizedOverviewItemId ??
      evidence.overviewItemId ??
      evidence.evidenceId;
    const current = selected.get(key);
    const currentReadable = Boolean(current && current.normalizedSku !== null);
    const candidateReadable = evidence.normalizedSku !== null;
    if (
      !current ||
      (!currentReadable && candidateReadable) ||
      (currentReadable === candidateReadable &&
        evidence.labelText.trim().length > current.labelText.trim().length)
    ) {
      selected.set(key, evidence);
    }
  }
  return [...selected.values()];
}

function overviewItemLabel(value: string | null) {
  if (!value) return "Unlinked detail";
  const number = Number.parseInt(value.slice(1), 10);
  return Number.isFinite(number) ? `Photo 1 item ${number}` : "Photo 1 item";
}

function evidenceLabel(evidence: ObservationEvidence) {
  const identity = overviewItemLabel(
    evidence.normalizedOverviewItemId ?? evidence.overviewItemId,
  );
  const sku = evidence.normalizedSku ?? evidence.sku;
  return sku ? `${identity} · ${sku}` : identity;
}

function bestEvidence(result: LineResult) {
  const confirmedEvidence = result.confirmedItems.flatMap(
    (item) => item.observations,
  );
  const evidence = uniqueEvidence([
    ...confirmedEvidence,
    ...result.overageEvidence,
    ...result.identityMismatchEvidence,
    ...result.uncertaintyEvidence,
  ]);

  // The result-level explorer retains every region supporting every part of a
  // compound conclusion. Its first frame emphasizes the reason for the status;
  // the tabs still expose confirmed lower-bound objects and other evidence.
  const identityMismatch = representativeEvidenceByObject(
    result.identityMismatchEvidence,
  )[0];
  if (result.status === "visible_mismatch" && identityMismatch) {
    return { evidence, activeEvidenceId: identityMismatch.evidenceId };
  }
  if (result.status === "visible_mismatch" && result.overageEvidence[0]) {
    return { evidence, activeEvidenceId: result.overageEvidence[0].evidenceId };
  }
  if (result.status === "needs_another_photo" && result.uncertaintyEvidence[0]) {
    return {
      evidence,
      activeEvidenceId: result.uncertaintyEvidence[0].evidenceId,
    };
  }

  for (const item of result.confirmedItems) {
    const selected =
      item.observations.find(
        (observation) => observation.evidenceId === item.bestEvidenceId,
      ) ?? item.observations[0];
    if (selected) return { evidence, activeEvidenceId: selected.evidenceId };
  }

  return { evidence, activeEvidenceId: evidence[0]?.evidenceId ?? null };
}

function photoForNumber(
  response: CheckResponse | null,
  photoNumber: number,
) {
  return response?.photos.find((photo) => photo.photoNumber === photoNumber) ?? null;
}

/**
 * The validated API coordinate space is 0..1000 on the normalized image.
 * Dividing by 10 produces CSS percentages without depending on rendered pixels.
 */
function bboxStyle(evidence: ObservationEvidence) {
  const { x, y, width, height } = evidence.bbox;
  const values = [x, y, width, height];
  const valid =
    values.every(Number.isFinite) &&
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x + width <= 1000 &&
    y + height <= 1000;

  if (!valid) {
    return null;
  }

  return {
    left: `${x / 10}%`,
    top: `${y / 10}%`,
    width: `${width / 10}%`,
    height: `${height / 10}%`,
  };
}

function StatusBadge({ status }: { status: ResultStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span aria-hidden="true" className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}

function EvidencePhoto({
  photo,
  evidence,
}: {
  photo: NormalizedPhoto;
  evidence: ObservationEvidence;
}) {
  const box = bboxStyle(evidence);

  return (
    <>
      <div
        className="evidence-stage"
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      >
        <Image
          alt={`Normalized response photo ${photo.photoNumber}`}
          className="evidence-image"
          height={photo.height}
          priority
          src={photo.previewDataUrl}
          unoptimized
          width={photo.width}
        />
        {box ? (
          <span
            aria-label={`Evidence region for ${evidenceLabel(evidence)}`}
            className="evidence-box"
            role="img"
            style={box}
          >
            <span>
              {overviewItemLabel(
                evidence.normalizedOverviewItemId ?? evidence.overviewItemId,
              )}
            </span>
          </span>
        ) : null}
      </div>
      {!box ? (
        <p className="inline-warning" role="alert">
          This observation has no valid display region. It is not shown as visual
          evidence.
        </p>
      ) : null}
    </>
  );
}

function ReviewedPhoto({ photo }: { photo: NormalizedPhoto }) {
  return (
    <figure className="reviewed-photo">
      <div style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
        <Image
          alt={`Reviewed normalized photo ${photo.photoNumber}; no evidence box available`}
          height={photo.height}
          src={photo.previewDataUrl}
          unoptimized
          width={photo.width}
        />
      </div>
      <figcaption>Photo {photo.photoNumber} · reviewed, no region claimed</figcaption>
    </figure>
  );
}

export default function Home() {
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<UploadPhoto[]>([]);
  const [rulesConfirmed, setRulesConfirmed] = useState(false);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [uiError, setUiError] = useState<UiError | null>(null);
  const [response, setResponse] = useState<CheckResponse | null>(null);
  const [rerunNotice, setRerunNotice] = useState(false);
  const [replacePhotoId, setReplacePhotoId] = useState<string | null>(null);
  const [evidenceContext, setEvidenceContext] = useState<EvidenceContext | null>(
    null,
  );

  const documentInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const localIdRef = useRef(0);
  const objectUrlsRef = useRef(new Set<string>());

  const isBusy = status === "uploading" || status === "processing";
  const selectedEvidence = useMemo(() => {
    if (!evidenceContext?.activeEvidenceId) {
      return null;
    }

    return (
      evidenceContext.evidence.find(
        (evidence) => evidence.evidenceId === evidenceContext.activeEvidenceId,
      ) ?? null
    );
  }, [evidenceContext]);

  const selectedPhoto = selectedEvidence
    ? photoForNumber(response, selectedEvidence.photoNumber)
    : null;

  const canSubmit =
    Boolean(documentFile) &&
    photos.length >= 1 &&
    photos.length <= MAX_PHOTOS &&
    rulesConfirmed &&
    !isBusy;

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (evidenceContext && !dialog.open) {
      dialog.showModal();
    } else if (!evidenceContext && dialog.open) {
      dialog.close();
    }
  }, [evidenceContext]);

  function makeObjectUrl(file: File) {
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    return url;
  }

  function revokeObjectUrl(url: string | null) {
    if (!url) {
      return;
    }
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }

  function clearError() {
    setUiError(null);
    setStatus((current) => (current === "error" ? "idle" : current));
  }

  function fail(error: UiError) {
    setUiError(error);
    setStatus("error");
  }

  function invalidateResult() {
    if (response) {
      setRerunNotice(true);
    }
    setResponse(null);
    setEvidenceContext(null);
    setUiError(null);
    setStatus("idle");
  }

  function handleDocument(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isPdf(file)) {
      fail({
        title: "Unsupported document",
        message: "Choose a PDF file. Images and scanned-only documents are not accepted here.",
      });
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      fail({
        title: "PDF is too large",
        message: `The PDF limit is ${formatBytes(MAX_PDF_BYTES)}. Choose a smaller one-page document.`,
      });
      return;
    }

    invalidateResult();
    revokeObjectUrl(documentPreviewUrl);
    setDocumentFile(file);
    setDocumentPreviewUrl(makeObjectUrl(file));
  }

  function validateNewPhotos(files: File[], nextCount: number) {
    if (nextCount > MAX_PHOTOS) {
      return {
        title: "Too many photos",
        message: `Use between one and ${MAX_PHOTOS} photos for one delivery check.`,
      } satisfies UiError;
    }

    const unsupported = files.find((file) => !isSupportedImage(file));
    if (unsupported) {
      return {
        title: "Unsupported photo",
        message: `${unsupported.name} is not supported. Use JPG, PNG, or WebP.`,
      } satisfies UiError;
    }

    const oversized = files.find((file) => file.size > MAX_PHOTO_BYTES);
    if (oversized) {
      return {
        title: "Photo is too large",
        message: `${oversized.name} exceeds the ${formatBytes(MAX_PHOTO_BYTES)} per-photo limit.`,
      } satisfies UiError;
    }

    return null;
  }

  function addPhotos(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const validationError = validateNewPhotos(files, photos.length + files.length);
    if (validationError) {
      fail(validationError);
      return;
    }

    const nextPhotos = files.map((file) => ({
      id: `upload-${++localIdRef.current}`,
      file,
      previewUrl: makeObjectUrl(file),
    }));

    invalidateResult();
    setPhotos((current) => [...current, ...nextPhotos]);
  }

  function replacePhoto(file: File | undefined) {
    if (!file || !replacePhotoId) {
      return;
    }

    const validationError = validateNewPhotos([file], photos.length);
    if (validationError) {
      fail(validationError);
      return;
    }

    const currentPhoto = photos.find((photo) => photo.id === replacePhotoId);
    if (!currentPhoto) {
      fail({
        title: "Photo could not be replaced",
        message: "The selected photo is no longer in this delivery. Try again.",
      });
      return;
    }

    const candidate: UploadPhoto = {
      id: currentPhoto.id,
      file,
      previewUrl: makeObjectUrl(file),
    };
    const nextPhotos = photos.map((photo) =>
      photo.id === replacePhotoId ? candidate : photo,
    );

    invalidateResult();
    revokeObjectUrl(currentPhoto.previewUrl);
    setPhotos(nextPhotos);
    setReplacePhotoId(null);
  }

  function removePhoto(id: string) {
    const photo = photos.find((candidate) => candidate.id === id);
    invalidateResult();
    revokeObjectUrl(photo?.previewUrl ?? null);
    setPhotos((current) => current.filter((candidate) => candidate.id !== id));
  }

  function resetDelivery() {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    revokeObjectUrl(documentPreviewUrl);
    photos.forEach((photo) => revokeObjectUrl(photo.previewUrl));
    setDocumentFile(null);
    setDocumentPreviewUrl(null);
    setPhotos([]);
    setRulesConfirmed(false);
    setStatus("idle");
    setUiError(null);
    setResponse(null);
    setRerunNotice(false);
    setReplacePhotoId(null);
    setEvidenceContext(null);
    localIdRef.current = 0;
    if (documentInputRef.current) documentInputRef.current.value = "";
    if (photosInputRef.current) photosInputRef.current.value = "";
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  }

  async function checkDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!documentFile) {
      fail({ title: "PDF required", message: "Add the one-page order PDF first." });
      return;
    }
    if (photos.length < 1 || photos.length > MAX_PHOTOS) {
      fail({
        title: "Photos required",
        message: `Add between one and ${MAX_PHOTOS} photos of the same unpacked delivery.`,
      });
      return;
    }
    if (!rulesConfirmed) {
      fail({
        title: "Confirm the capture rules",
        message:
          "Confirm that Photo 1 shows the complete delivery and later photos keep the same layout.",
      });
      return;
    }

    const requestGeneration = ++generationRef.current;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setUiError(null);
    setResponse(null);
    setRerunNotice(false);
    setEvidenceContext(null);
    setStatus("uploading");

    let timedOut = false;
    const processingTimer = window.setTimeout(() => {
      if (generationRef.current === requestGeneration) {
        setStatus((current) => (current === "uploading" ? "processing" : current));
      }
    }, 450);
    const timeoutTimer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    const formData = new FormData();
    formData.append("document", documentFile);
    photos.forEach((photo) => formData.append("photos", photo.file));
    formData.append("rulesConfirmed", "true");

    try {
      const httpResponse = await fetch("/codebridge/api/check", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const body: unknown = await httpResponse.json().catch(() => null);

      if (generationRef.current !== requestGeneration) {
        return;
      }

      if (!httpResponse.ok) {
        if (isApiErrorBody(body)) {
          fail({
            title: apiErrorTitle(body.error.code),
            message: body.error.message,
            details: body.error.details,
            requestId: body.error.requestId,
          });
        } else {
          fail({
            title: "Delivery could not be checked",
            message: "The server returned an unreadable error. Keep the files and try again.",
          });
        }
        return;
      }

      if (!isCheckResponse(body)) {
        fail({
          title: "Unverified response",
          message:
            "The server response did not contain valid evidence. No delivery conclusion was shown.",
        });
        return;
      }

      setResponse(body);
      setStatus("result");
    } catch (error) {
      if (generationRef.current !== requestGeneration) {
        return;
      }

      if (timedOut) {
        fail({
          title: "Check timed out",
          message:
            "No verified result was returned within the allowed processing window. Your files are still selected so you can try again.",
        });
      } else if (error instanceof DOMException && error.name === "AbortError") {
        return;
      } else {
        fail({
          title: "Connection error",
          message:
            "The check could not reach the server. Your files are still selected so you can try again.",
        });
      }
    } finally {
      window.clearTimeout(processingTimer);
      window.clearTimeout(timeoutTimer);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  function openLineResult(result: LineResult) {
    const selected = bestEvidence(result);
    setEvidenceContext({
      title: `${result.line.sku} · ${statusLabel(result.status)}`,
      explanation: result.explanation,
      line: result.line,
      evidence: selected.evidence,
      activeEvidenceId: selected.activeEvidenceId,
      reviewedPhotoNumbers: result.reviewedPhotoNumbers,
    });
  }

  function openItemEvidence(result: LineResult, itemIndex: number) {
    const item = result.confirmedItems[itemIndex];
    if (!item) return;
    const active =
      item.observations.find(
        (observation) => observation.evidenceId === item.bestEvidenceId,
      ) ?? item.observations[0];
    setEvidenceContext({
      title: `${overviewItemLabel(item.overviewItemId)} · ${item.sku}`,
      explanation: result.explanation,
      line: result.line,
      evidence: item.observations,
      activeEvidenceId: active?.evidenceId ?? null,
      reviewedPhotoNumbers: result.reviewedPhotoNumbers,
    });
  }

  function openMismatchEvidence(
    result: LineResult,
    selected: ObservationEvidence,
  ) {
    const sameObject = result.identityMismatchEvidence.filter((evidence) => {
      if (selected.normalizedOverviewItemId) {
        return (
          evidence.normalizedOverviewItemId === selected.normalizedOverviewItemId
        );
      }
      return evidence.evidenceId === selected.evidenceId;
    });
    setEvidenceContext({
      title: evidenceLabel(selected),
      explanation: result.explanation,
      line: result.line,
      evidence: sameObject.length > 0 ? sameObject : [selected],
      activeEvidenceId: selected.evidenceId,
      reviewedPhotoNumbers: result.reviewedPhotoNumbers,
    });
  }

  function openOverageEvidence(
    result: LineResult,
    selected: ObservationEvidence,
  ) {
    const item = result.confirmedItems.find(
      (candidate) => candidate.overviewEvidenceId === selected.evidenceId,
    );
    setEvidenceContext({
      title: evidenceLabel(selected),
      explanation: result.explanation,
      line: result.line,
      evidence: item?.observations ?? [selected],
      activeEvidenceId: selected.evidenceId,
      reviewedPhotoNumbers: result.reviewedPhotoNumbers,
    });
  }

  function openUnresolved(observation: UnresolvedObservation) {
    const relatedLine =
      response?.orderLines.find(
        (line) => line.lineNumber === observation.relatedLineNumber,
      ) ?? null;
    const evidence = uniqueEvidence(observation.evidence);
    setEvidenceContext({
      title: observation.title,
      explanation: observation.explanation,
      line: relatedLine,
      evidence,
      activeEvidenceId: evidence[0]?.evidenceId ?? null,
      reviewedPhotoNumbers:
        evidence.length > 0
          ? uniqueNumbers(evidence.map((item) => item.photoNumber))
          : response?.result.reviewedPhotoNumbers ?? [],
    });
  }

  const requirements = [
    { label: "Text PDF selected", complete: Boolean(documentFile) },
    {
      label: `${photos.length || "No"} photo${photos.length === 1 ? "" : "s"} selected`,
      complete: photos.length >= 1 && photos.length <= MAX_PHOTOS,
    },
    { label: "Capture rules confirmed", complete: rulesConfirmed },
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to delivery check
      </a>
      <header className="app-header">
        <div className="header-inner">
          <a aria-label="DeliveryCheck home" className="brand" href="#main-content">
            <span aria-hidden="true" className="brand-mark">
              <span />
              <span />
            </span>
            <span>DeliveryCheck</span>
          </a>
          <div className="header-actions">
            <span className="scope-label">English · 1 PDF · 3 photos max</span>
            {documentFile || photos.length > 0 || response ? (
              <button
                className="button button-quiet"
                disabled={isBusy}
                onClick={resetDelivery}
                type="button"
              >
                New delivery
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main id="main-content">
        <section aria-labelledby="check-title" className="intro">
          <div>
            <p className="eyebrow">Evidence-backed review</p>
            <h1 id="check-title">Check one delivery</h1>
            <p>
              Compare a text-based order PDF with clear item-label photos. Every
              visual claim remains linked to the source line and visible photo region.
            </p>
          </div>
          <div className="privacy-note">
            <span aria-hidden="true" className="privacy-icon">✓</span>
            <span>
              AI reads the visible labels. DeliveryCheck compares each SKU with the
              packing list and shows the supporting photo.
            </span>
          </div>
        </section>

        <form aria-describedby="capture-help" onSubmit={checkDelivery}>
          <section aria-labelledby="prepare-title" className="panel prepare-panel">
            <div className="section-heading">
              <div className="step-number">1</div>
              <div>
                <h2 id="prepare-title">Prepare the evidence</h2>
                <p id="capture-help">
                  Use one text PDF and photos of the same small, unpacked delivery.
                </p>
              </div>
            </div>

            <div className="prepare-grid">
              <aside aria-labelledby="rules-title" className="rules-card">
                <div className="rules-heading">
                  <p className="small-label">Before you shoot</p>
                  <span className="limit-pill">1–3 photos</span>
                </div>
                <h3 id="rules-title">Use one count-bearing overview</h3>
                <ol className="rule-list">
                  <li>
                    <span>01</span>
                    <p>
                      Photo 1 must show every unpacked item at once, separated,
                      unstacked, and fully inside the frame. Clear away unrelated objects.
                    </p>
                  </li>
                  <li>
                    <span>02</span>
                    <p>
                      Leave the items in the same positions. Move only the camera
                      for closer label views.
                    </p>
                  </li>
                  <li>
                    <span>03</span>
                    <p>
                      Keep enough surrounding context in every close-up to link it
                      to one object in Photo 1.
                    </p>
                  </li>
                </ol>
                <p className="rule-footnote">
                  Only separate objects established in Photo 1 affect quantity.
                  A detail-only object, hidden label, or uncertain link stays unverified.
                </p>
              </aside>

              <div className="upload-column">
                <div className="upload-block">
                  <div className="upload-heading">
                    <div>
                      <p className="small-label">Order document</p>
                      <h3>One-page text PDF</h3>
                    </div>
                    <span>Max {formatBytes(MAX_PDF_BYTES)}</span>
                  </div>
                  <input
                    accept="application/pdf,.pdf"
                    className="visually-hidden"
                    disabled={isBusy}
                    id="document-upload"
                    onChange={(event) => handleDocument(event.target.files?.[0])}
                    onClick={(event) => {
                      event.currentTarget.value = "";
                    }}
                    ref={documentInputRef}
                    type="file"
                  />
                  {!documentFile ? (
                    <label className="file-prompt" htmlFor="document-upload">
                      <span aria-hidden="true" className="file-glyph">PDF</span>
                      <span>
                        <strong>Choose order PDF</strong>
                        <small>It must contain extractable English text.</small>
                      </span>
                      <span className="button button-secondary">Browse</span>
                    </label>
                  ) : (
                    <div className="selected-document">
                      <div className="file-summary">
                        <span aria-hidden="true" className="file-glyph">PDF</span>
                        <span className="file-copy">
                          <strong title={documentFile.name}>{documentFile.name}</strong>
                          <small>{formatBytes(documentFile.size)} · selected</small>
                        </span>
                        <label className="text-action" htmlFor="document-upload">
                          Replace
                        </label>
                      </div>
                      {documentPreviewUrl ? (
                        <details className="pdf-preview">
                          <summary>Preview document</summary>
                          <object data={documentPreviewUrl} type="application/pdf">
                            <p>
                              This browser cannot embed the PDF. {" "}
                              <a href={documentPreviewUrl} rel="noreferrer" target="_blank">
                                Open it in a new tab
                              </a>
                              .
                            </p>
                          </object>
                        </details>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="upload-block">
                  <div className="upload-heading">
                    <div>
                      <p className="small-label">Delivery photos</p>
                      <h3>Overview first, then label angles</h3>
                    </div>
                    <span>{photos.length}/{MAX_PHOTOS}</span>
                  </div>
                  <input
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    className="visually-hidden"
                    disabled={isBusy || photos.length >= MAX_PHOTOS}
                    id="photos-upload"
                    multiple
                    onChange={(event) => {
                      addPhotos(Array.from(event.target.files ?? []));
                      event.currentTarget.value = "";
                    }}
                    ref={photosInputRef}
                    type="file"
                  />
                  <input
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    aria-label="Choose replacement photo"
                    className="visually-hidden"
                    disabled={isBusy}
                    onChange={(event) => {
                      replacePhoto(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                    ref={replaceInputRef}
                    type="file"
                  />

                  {photos.length > 0 ? (
                    <div className="photo-grid">
                      {photos.map((photo, index) => (
                        <article className="photo-card" key={photo.id}>
                          <div className="photo-frame">
                            <Image
                              alt={`Photo ${index + 1} preview: ${photo.file.name}`}
                              fill
                              sizes="(max-width: 720px) 46vw, 180px"
                              src={photo.previewUrl}
                              unoptimized
                            />
                            <span className="photo-number">Photo {index + 1}</span>
                          </div>
                          <div className="photo-meta">
                            <strong>{index === 0 ? "Overview" : `Label angle ${index}`}</strong>
                            <span title={photo.file.name}>{photo.file.name}</span>
                            <small>{formatBytes(photo.file.size)}</small>
                          </div>
                          <div className="photo-actions">
                            <button
                              className="text-action"
                              disabled={isBusy}
                              onClick={() => {
                                setReplacePhotoId(photo.id);
                                window.setTimeout(() => replaceInputRef.current?.click(), 0);
                              }}
                              type="button"
                            >
                              Replace
                            </button>
                            <button
                              className="text-action text-action-danger"
                              disabled={isBusy}
                              onClick={() => removePhoto(photo.id)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}

                  {photos.length < MAX_PHOTOS ? (
                    <label
                      className={`photo-prompt ${photos.length > 0 ? "photo-prompt-compact" : ""}`}
                      htmlFor="photos-upload"
                    >
                      <span aria-hidden="true" className="plus-glyph">+</span>
                      <span>
                        <strong>{photos.length ? "Add another angle" : "Choose delivery photos"}</strong>
                        <small>JPG, PNG, or WebP · {formatBytes(MAX_PHOTO_BYTES)} each</small>
                      </span>
                    </label>
                  ) : (
                    <p className="limit-message">Three-photo limit reached.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="confirmation-row">
              <label className="confirmation-check">
                <input
                  checked={rulesConfirmed}
                  disabled={isBusy}
                  onChange={(event) => {
                    setRulesConfirmed(event.target.checked);
                    clearError();
                  }}
                  type="checkbox"
                />
                <span>
                  I confirm Photo 1 shows the complete unpacked delivery and later
                  photos show the same unmoved objects from closer angles.
                </span>
              </label>

              <div className="submit-area">
                <ul aria-label="Check requirements" className="requirements">
                  {requirements.map((requirement) => (
                    <li className={requirement.complete ? "complete" : ""} key={requirement.label}>
                      <span aria-hidden="true">{requirement.complete ? "✓" : "·"}</span>
                      {requirement.label}
                    </li>
                  ))}
                </ul>
                <button
                  className="button button-primary"
                  disabled={!canSubmit}
                  type="submit"
                >
                  {isBusy ? "Checking…" : response ? "Check again" : "Check delivery"}
                </button>
              </div>
            </div>

            {rerunNotice ? (
              <p className="rerun-notice" role="status">
                Files changed. The previous result was cleared; run the check again.
              </p>
            ) : null}

            {uiError ? (
              <div className="error-card" role="alert">
                <span aria-hidden="true" className="error-mark">!</span>
                <div>
                  <strong>{uiError.title}</strong>
                  <p>{uiError.message}</p>
                  {uiError.details?.length ? (
                    <ul>
                      {uiError.details.map((detail) => <li key={detail}>{detail}</li>)}
                    </ul>
                  ) : null}
                  {uiError.requestId ? <small>Request {uiError.requestId}</small> : null}
                </div>
              </div>
            ) : null}

            <div aria-live="polite" className="run-status" role="status">
              {status === "uploading" ? (
                <div className="processing-card">
                  <span aria-hidden="true" className="spinner" />
                  <div>
                    <strong>Uploading files…</strong>
                    <p>Keep this tab open while the server receives this check.</p>
                  </div>
                </div>
              ) : null}
              {status === "processing" ? (
                <div className="processing-card">
                  <span aria-hidden="true" className="spinner" />
                  <div>
                    <strong>Building an evidence-backed result…</strong>
                    <p>Measured three-photo checks usually took 13–19 seconds. A stalled Gemini attempt is now capped at 15 seconds before the one allowed retry.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </form>

        {response ? (
          <section aria-labelledby="results-title" className="results-section">
            <div className="section-heading results-heading">
              <div className="step-number">2</div>
              <div>
                <p className="eyebrow">Validated server response</p>
                <h2 id="results-title">Delivery results</h2>
                <p>
                  Confirmed quantity counts separate objects established in Photo 1
                  with an exact visible SKU.
                </p>
              </div>
            </div>

            <div aria-label="Result summary" className="summary-grid">
              <div>
                <span>Confirmed lines</span>
                <strong>{response.result.stats.confirmedLines}</strong>
              </div>
              <div>
                <span>Visible mismatch lines</span>
                <strong>{response.result.stats.mismatchLines}</strong>
              </div>
              <div>
                <span>Need another photo</span>
                <strong>{response.result.stats.needsPhotoLines}</strong>
              </div>
              <div>
                <span>Unresolved observations</span>
                <strong>{response.result.stats.unresolvedObservations}</strong>
              </div>
            </div>

            <div className={`coverage-card ${response.result.captureComplete ? "coverage-complete" : "coverage-limited"}`}>
              <span aria-hidden="true">{response.result.captureComplete ? "✓" : "i"}</span>
              <div>
                <strong>
                  {response.result.captureComplete
                    ? "Overview coverage accepted"
                    : "This check has visibility limits"}
                </strong>
                <p>
                  {response.result.captureComplete
                    ? "Photo 1 established the delivery roster. Findings still depend on readable labels and safe links from detail views."
                    : "Confirmed quantities are visible lower bounds. Nothing unseen is described as missing."}
                </p>
                {response.result.captureLimitations.length ? (
                  <ul>
                    {response.result.captureLimitations.map((limitation) => (
                      <li key={limitation}>{limitation}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="results-table" role="table" aria-label="Order line results">
              <div className="result-table-head" role="row">
                <span role="columnheader">Order line</span>
                <span role="columnheader">Quantity</span>
                <span role="columnheader">Conclusion</span>
                <span aria-hidden="true" />
              </div>
              {response.result.lines.map((result) => (
                <article className="result-row" key={result.line.lineNumber} role="row">
                  <div className="result-product" role="cell">
                    <span>Line {result.line.lineNumber}</span>
                    <h3>{result.line.product}</h3>
                    <code>{result.line.sku}</code>
                  </div>
                  <div className="quantity-cell" role="cell">
                    <span className="quantity-value">
                      <strong>{result.confirmedQuantity}</strong>
                      <span>/ {result.line.expectedQuantity}</span>
                    </span>
                    <small>confirmed / expected</small>
                    {result.quantityIsLowerBound ? <em>Visible lower bound</em> : null}
                  </div>
                  <div className="conclusion-cell" role="cell">
                    <StatusBadge status={result.status} />
                    <p>{result.explanation}</p>
                    {result.confirmedItems.length > 0 ? (
                      <div className="evidence-chip-group">
                        <span>Confirmed objects</span>
                        <div>
                          {result.confirmedItems.map((item, index) => (
                            <button
                              className="evidence-chip"
                              key={`${item.overviewItemId}-${index}`}
                              onClick={() => openItemEvidence(result, index)}
                              type="button"
                            >
                              {overviewItemLabel(item.overviewItemId)} · {item.sku}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {result.overageEvidence.length > 0 ? (
                      <div className="evidence-chip-group mismatch-chips">
                        <span>Separate Photo 1 count regions</span>
                        <div>
                          {result.overageEvidence.map((evidence) => (
                            <button
                              className="evidence-chip"
                              key={evidence.evidenceId}
                              onClick={() => openOverageEvidence(result, evidence)}
                              type="button"
                            >
                              {evidenceLabel(evidence)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {result.identityMismatchEvidence.length > 0 ? (
                      <div className="evidence-chip-group mismatch-chips">
                        <span>Different visible SKU</span>
                        <div>
                          {representativeEvidenceByObject(
                            result.identityMismatchEvidence,
                          ).map((evidence) => (
                            <button
                              className="evidence-chip"
                              key={evidence.evidenceId}
                              onClick={() => openMismatchEvidence(result, evidence)}
                              type="button"
                            >
                              {evidenceLabel(evidence)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {result.confirmedItems.length === 0 &&
                    result.overageEvidence.length === 0 &&
                    result.identityMismatchEvidence.length === 0 &&
                    result.uncertaintyEvidence.length === 0 ? (
                      <p className="no-object-note">
                        No verifiable object was linked to this document row. Photos {result.reviewedPhotoNumbers.join(", ")} were reviewed; this does not mean the item was absent.
                      </p>
                    ) : null}
                  </div>
                  <div className="result-action" role="cell">
                    <button
                      aria-label={`Review evidence for line ${result.line.lineNumber}, ${result.line.product}`}
                      className="button button-secondary"
                      onClick={() => openLineResult(result)}
                      type="button"
                    >
                      Review evidence
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {response.result.unresolved.length > 0 ? (
              <section aria-labelledby="unresolved-title" className="unresolved-section">
                <div>
                  <p className="eyebrow">Kept separate from ordered quantities</p>
                  <h3 id="unresolved-title">Unresolved observations</h3>
                  <p>
                    These visible regions cannot safely be linked or assigned to an order line yet.
                  </p>
                </div>
                <div className="unresolved-list">
                  {response.result.unresolved.map((observation) => (
                    <article key={observation.unresolvedId}>
                      <div>
                        <StatusBadge status={unresolvedStatus(observation.kind)} />
                        <h4>{observation.title}</h4>
                        <p>{observation.explanation}</p>
                        <dl>
                          <div>
                            <dt>Overview object</dt>
                            <dd>{overviewItemLabel(observation.overviewItemId)}</dd>
                          </div>
                          <div>
                            <dt>Visible SKU</dt>
                            <dd>{observation.visibleSku ?? "Unreadable"}</dd>
                          </div>
                        </dl>
                      </div>
                      <button
                        className="button button-secondary"
                        onClick={() => openUnresolved(observation)}
                        type="button"
                      >
                        Review observation
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="results-footer">
              <p>
                Changed an angle or uncovered a label? Replace or add a photo above, then run the check again.
              </p>
              <button className="button button-quiet" onClick={resetDelivery} type="button">
                New delivery
              </button>
            </div>
          </section>
        ) : null}
      </main>

      <dialog
        aria-labelledby="evidence-title"
        className="evidence-dialog"
        onCancel={() => setEvidenceContext(null)}
        onClose={() => setEvidenceContext(null)}
        ref={dialogRef}
      >
        {evidenceContext ? (
          <div className="drawer-shell">
            <header className="drawer-header">
              <div>
                <p className="eyebrow">Evidence explorer</p>
                <h2 id="evidence-title">{evidenceContext.title}</h2>
              </div>
              <button
                aria-label="Close evidence explorer"
                className="dialog-close"
                onClick={() => dialogRef.current?.close()}
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="drawer-content">
              <section aria-labelledby="source-line-title" className="source-card">
                <div className="source-card-heading">
                  <h3 id="source-line-title">Document source</h3>
                  {evidenceContext.line ? (
                    <span>Page {evidenceContext.line.sourcePdfPage} · Line {evidenceContext.line.lineNumber}</span>
                  ) : (
                    <span>No exact order line</span>
                  )}
                </div>
                {evidenceContext.line ? (
                  <>
                    <blockquote>{evidenceContext.line.sourceText}</blockquote>
                    <dl>
                      <div><dt>SKU</dt><dd>{evidenceContext.line.sku}</dd></div>
                      <div><dt>Expected</dt><dd>{evidenceContext.line.expectedQuantity}</dd></div>
                    </dl>
                  </>
                ) : (
                  <p>
                    This observation is kept separate because its SKU has no exact match in the document or it cannot be linked safely.
                  </p>
                )}
              </section>

              <section aria-labelledby="photo-evidence-title" className="photo-evidence-section">
                <div className="photo-evidence-heading">
                  <div>
                    <h3 id="photo-evidence-title">Photo evidence</h3>
                    <p>Frames use the server&apos;s normalized, orientation-corrected response image.</p>
                  </div>
                  {evidenceContext.evidence.length > 1 ? (
                    <div aria-label="Available photo evidence" className="drawer-evidence-tabs" role="group">
                      {evidenceContext.evidence.map((evidence) => (
                        <button
                          aria-pressed={evidence.evidenceId === evidenceContext.activeEvidenceId}
                          key={evidence.evidenceId}
                          onClick={() =>
                            setEvidenceContext((current) =>
                              current
                                ? { ...current, activeEvidenceId: evidence.evidenceId }
                                : current,
                            )
                          }
                          type="button"
                        >
                          Photo {evidence.photoNumber} · {overviewItemLabel(
                            evidence.normalizedOverviewItemId ??
                              evidence.overviewItemId,
                          )}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {selectedEvidence && selectedPhoto ? (
                  <>
                    <EvidencePhoto evidence={selectedEvidence} photo={selectedPhoto} />
                    <div className="observation-details">
                      <div>
                        <span>Overview object</span>
                        <strong>
                          {overviewItemLabel(
                            selectedEvidence.normalizedOverviewItemId ??
                              selectedEvidence.overviewItemId,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>Visible SKU</span>
                        <strong>{selectedEvidence.normalizedSku ?? selectedEvidence.sku ?? "Unreadable"}</strong>
                      </div>
                      <div className="observation-detail-wide">
                        <span>Visible label text</span>
                        <strong>{selectedEvidence.labelText || "No readable text"}</strong>
                      </div>
                      <div className="observation-detail-wide">
                        <span>Observed object</span>
                        <strong>{selectedEvidence.objectDescription || "No description returned"}</strong>
                      </div>
                      {selectedEvidence.uncertaintyReason ? (
                        <div className="observation-detail-wide uncertainty-detail">
                          <span>Why this is uncertain</span>
                          <strong>{selectedEvidence.uncertaintyReason}</strong>
                        </div>
                      ) : null}
                      {selectedEvidence.associationReason ? (
                        <div className="observation-detail-wide">
                          <span>Why this detail was linked</span>
                          <strong>{selectedEvidence.associationReason}</strong>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : selectedEvidence ? (
                  <p className="inline-warning" role="alert">
                    The referenced normalized photo is unavailable. This observation is not displayed as evidence.
                  </p>
                ) : (
                  <div className="no-region-evidence">
                    <div className="no-region-copy">
                      <span aria-hidden="true">i</span>
                      <p>
                        No verifiable object was safely linked to this document row.
                        These are the reviewed photos; no box is invented, and this
                        does not mean the item was absent.
                      </p>
                    </div>
                    <div className="reviewed-grid">
                      {evidenceContext.reviewedPhotoNumbers.map((photoNumber) => {
                        const photo = photoForNumber(response, photoNumber);
                        return photo ? <ReviewedPhoto key={photoNumber} photo={photo} /> : null;
                      })}
                    </div>
                  </div>
                )}
              </section>

              <section aria-labelledby="reasoning-title" className="reasoning-card">
                <h3 id="reasoning-title">Why this conclusion</h3>
                <p>{evidenceContext.explanation}</p>
                <p className="method-note">
                  AI extracts visible objects, labels, cross-photo links, and regions.
                  Deterministic rules compare exact SKUs and count only separate
                  objects established in Photo 1.
                </p>
              </section>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
