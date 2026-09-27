/**
 * 留档层：复查记录、纠正留痕、转诊单、发放登记与批次库存的存储。
 * 每次复查追加一份记录，不覆盖；纠正只追加留痕，不改历史。
 */
import { useSyncExternalStore } from "react";
import { formatReadingValue } from "../data/format";
import { seedBatches } from "../data/seed";
import type {
  CorrectableField,
  Correction,
  DispenseEntry,
  EyeSide,
  MedBatch,
  Patient,
  Referral,
  ReviewReading,
  ReviewRecord,
} from "../data/types";
import { PATIENTS } from "../data/seed";
import { assessReading, gateDispense } from "../rules/assessment";

export interface ArchiveState {
  patients: Patient[];
  reviews: ReviewRecord[];
  referrals: Referral[];
  batches: MedBatch[];
  dispenses: DispenseEntry[];
}

let state: ArchiveState = {
  patients: PATIENTS,
  reviews: [],
  referrals: [],
  batches: seedBatches(),
  dispenses: [],
};

const listeners = new Set<() => void>();
let seq = 0;

function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function setState(next: ArchiveState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ArchiveState {
  return state;
}

/** 只读访问当前留档（页面请用 useArchive） */
export function getArchive(): ArchiveState {
  return state;
}

/** 页面读取留档的入口 */
export function useArchive(): ArchiveState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/* ---------- 查询 ---------- */

/** 某患者某眼别最近一次复查（按复查时刻排序） */
export function latestReview(
  reviews: ReviewRecord[],
  patientId: string,
  eye: EyeSide,
): ReviewRecord | null {
  const matches = reviews
    .filter((r) => r.patientId === patientId && r.eye === eye)
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  return matches[0] ?? null;
}

/* ---------- 复查留档 ---------- */

export interface SaveReviewInput {
  patientId: string;
  eye: EyeSide;
  reviewedAt: string;
  reading: ReviewReading;
}

/** 每次复查留存一份记录；触发转诊时同时开出24小时复诊单 */
export function saveReview(input: SaveReviewInput): ReviewRecord {
  const record: ReviewRecord = {
    id: nextId("RV"),
    patientId: input.patientId,
    eye: input.eye,
    reviewedAt: input.reviewedAt,
    reading: input.reading,
    assessment: assessReading(input.reading),
    corrections: [],
  };
  const referrals =
    record.assessment.kind === "escalate-24h"
      ? [makeReferral(record), ...state.referrals]
      : state.referrals;
  setState({ ...state, reviews: [record, ...state.reviews], referrals });
  return record;
}

function makeReferral(record: ReviewRecord): Referral {
  return {
    id: nextId("RF"),
    reviewId: record.id,
    patientId: record.patientId,
    eye: record.eye,
    triggers: record.assessment.kind === "escalate-24h" ? record.assessment.triggers : [],
    createdAt: new Date().toISOString(),
    dueWithinHours: 24,
    status: "open",
  };
}

/* ---------- 纠正读数 ---------- */

/**
 * 纠正读数：旧值和原因留痕，重新判定。
 * 纠正后不再触发转诊的，转诊单标记为“纠正后解除”；新触发的补开转诊单。
 */
export function correctReading(
  reviewId: string,
  field: CorrectableField,
  newValue: string,
  reason: string,
): void {
  const review = state.reviews.find((r) => r.id === reviewId);
  if (!review) return;

  const reading: ReviewReading = { ...review.reading };
  if (field === "iopMmHg") reading.iopMmHg = Number(newValue);
  else if (field === "flapDisplaced") reading.flapDisplaced = newValue === "true";
  else reading.uncorrectedAcuity = newValue;

  const correction: Correction = {
    field,
    oldValue: formatReadingValue(review.reading, field),
    newValue: formatReadingValue(reading, field),
    reason,
    correctedAt: new Date().toISOString(),
  };
  const updated: ReviewRecord = {
    ...review,
    reading,
    assessment: assessReading(reading),
    corrections: [...review.corrections, correction],
  };

  let referrals = state.referrals;
  const openReferral = referrals.find((r) => r.reviewId === reviewId && r.status === "open");
  if (updated.assessment.kind === "escalate-24h" && !openReferral) {
    referrals = [makeReferral(updated), ...referrals];
  } else if (updated.assessment.kind === "normal" && openReferral) {
    referrals = referrals.map((r) =>
      r.id === openReferral.id ? { ...r, status: "closed-by-correction" as const } : r,
    );
  }

  setState({
    ...state,
    reviews: state.reviews.map((r) => (r.id === reviewId ? updated : r)),
    referrals,
  });
}

/* ---------- 药房发放 ---------- */

export type DispenseResult =
  | { ok: true; entry: DispenseEntry }
  | { ok: false; reason: string };

/** 过闸后按剩余药量发放，登记批次和数量并扣减库存 */
export function dispenseMedication(
  reviewId: string,
  batchNo: string,
  quantity: number,
  today: string,
): DispenseResult {
  const review = state.reviews.find((r) => r.id === reviewId) ?? null;
  const batch = state.batches.find((b) => b.batchNo === batchNo) ?? null;

  const gate = gateDispense(review, batch, today);
  if (!gate.allowed) return { ok: false, reason: gate.reason };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, reason: "发放数量需为正整数" };
  }
  if (quantity > gate.maxQuantity) {
    return { ok: false, reason: `超过批次剩余药量，最多可发 ${gate.maxQuantity} 支` };
  }

  const entry: DispenseEntry = {
    id: nextId("DP"),
    reviewId: review!.id,
    patientId: review!.patientId,
    eye: review!.eye,
    batchNo,
    quantity,
    dispensedAt: new Date().toISOString(),
  };
  setState({
    ...state,
    batches: state.batches.map((b) =>
      b.batchNo === batchNo ? { ...b, stockRemaining: b.stockRemaining - quantity } : b,
    ),
    dispenses: [entry, ...state.dispenses],
  });
  return { ok: true, entry };
}
