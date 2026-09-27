// 判定：复诊转诊、批次有效性、发放校验、读数纠正

import type {
  CorrectableField,
  Correction,
  FollowUpRecord,
  MedicationBatch,
} from "./types";

/** 眼压转诊线：达到 25mmHg 即转 24 小时复诊 */
export const IOP_REFERRAL_THRESHOLD = 25;

export interface TriageDecision {
  level: "routine" | "referral-24h";
  reasons: string[];
  pharmacyBlocked: boolean;
}

/** 复查判定：眼压 ≥ 25mmHg 或瓣移位 → 记录保留并转 24 小时复诊，药房不能续药 */
export function evaluateFollowUp(record: {
  iop: number;
  flapDisplaced: boolean;
}): TriageDecision {
  const reasons: string[] = [];
  if (record.iop >= IOP_REFERRAL_THRESHOLD) {
    reasons.push(`眼压 ${record.iop}mmHg ≥ ${IOP_REFERRAL_THRESHOLD}mmHg`);
  }
  if (record.flapDisplaced) {
    reasons.push("角膜瓣移位");
  }
  if (reasons.length === 0) {
    return {
      level: "routine",
      reasons: ["眼压与角膜瓣未见异常"],
      pharmacyBlocked: false,
    };
  }
  return { level: "referral-24h", reasons, pharmacyBlocked: true };
}

function toDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 批次是否仍在有效期内（剩余药量单独校验） */
export function isBatchValid(batch: MedicationBatch, now: Date = new Date()): boolean {
  return batch.expiresAt >= toDateKey(now);
}

export interface DispenseCheck {
  allowed: boolean;
  message: string;
}

/** 发放校验：无异常且批次有效时，才可按剩余药量发放 */
export function checkDispense(
  decision: TriageDecision,
  batch: MedicationBatch | null,
  quantity: number,
  now: Date = new Date()
): DispenseCheck {
  if (decision.pharmacyBlocked) {
    return {
      allowed: false,
      message: "本次复查存在异常，已转 24 小时复诊，药房不能续药",
    };
  }
  if (!batch) {
    return { allowed: false, message: "请选择药品批次" };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { allowed: false, message: "发放数量需大于 0" };
  }
  if (!isBatchValid(batch, now)) {
    return {
      allowed: false,
      message: `批次 ${batch.batchNo} 已过有效期（${batch.expiresAt}），不能发放`,
    };
  }
  if (quantity > batch.remaining) {
    return {
      allowed: false,
      message: `批次 ${batch.batchNo} 剩余 ${batch.remaining}${batch.unit}，不足发放 ${quantity}${batch.unit}`,
    };
  }
  return { allowed: true, message: `可按剩余药量发放 ${quantity}${batch.unit}` };
}

export const CORRECTABLE_FIELD_LABEL: Record<CorrectableField, string> = {
  uncorrectedVision: "裸眼视力",
  iop: "眼压(mmHg)",
  flapDisplaced: "瓣移位",
};

export function readFieldValue(record: FollowUpRecord, field: CorrectableField): string {
  switch (field) {
    case "uncorrectedVision":
      return record.uncorrectedVision;
    case "iop":
      return String(record.iop);
    case "flapDisplaced":
      return record.flapDisplaced ? "有移位" : "无移位";
  }
}

/**
 * 纠正读数：返回新记录，旧值与原因追加进 corrections，
 * 原留档记录不被销毁，判定按纠正后的当前读数重新得出。
 */
export function applyCorrection(
  record: FollowUpRecord,
  field: CorrectableField,
  rawNewValue: string,
  reason: string,
  correctedAt: string
): FollowUpRecord {
  const correction: Correction = {
    field,
    oldValue: readFieldValue(record, field),
    newValue: rawNewValue,
    reason,
    correctedAt,
  };
  const next: FollowUpRecord = {
    ...record,
    corrections: [...record.corrections, correction],
  };
  switch (field) {
    case "uncorrectedVision":
      next.uncorrectedVision = rawNewValue;
      break;
    case "iop":
      next.iop = Number(rawNewValue);
      break;
    case "flapDisplaced":
      next.flapDisplaced = rawNewValue === "有移位";
      break;
  }
  return next;
}
