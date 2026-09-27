/**
 * 资料层：复查台涉及的全部数据结构定义。
 * 只放类型与常量，不含判定逻辑和存储逻辑。
 */

/** 眼别 */
export type EyeSide = "OD" | "OS";

export const EYE_LABEL: Record<EyeSide, string> = {
  OD: "右眼",
  OS: "左眼",
};

/**
 * 复查读数：裸眼视力、眼压、瓣移位、症状。
 * 药品快用完与读数同单上报，不再分开报。
 */
export interface ReviewReading {
  /** 裸眼视力，如 "1.0"、"0.6" */
  uncorrectedAcuity: string;
  /** 眼压 mmHg */
  iopMmHg: number;
  /** 角膜瓣移位 */
  flapDisplaced: boolean;
  /** 症状 */
  symptoms: string[];
  /** 药品快用完 */
  medicationLow: boolean;
}

/** 允许纠正的读数字段 */
export type CorrectableField = "uncorrectedAcuity" | "iopMmHg" | "flapDisplaced";

export const FIELD_LABEL: Record<CorrectableField, string> = {
  uncorrectedAcuity: "裸眼视力",
  iopMmHg: "眼压",
  flapDisplaced: "瓣移位",
};

/** 纠正留痕：保留旧值、新值和原因 */
export interface Correction {
  field: CorrectableField;
  oldValue: string;
  newValue: string;
  reason: string;
  correctedAt: string;
}

/** 触发24小时复诊的情形 */
export type EscalationTrigger = "iop-high" | "flap-displaced";

export const TRIGGER_LABEL: Record<EscalationTrigger, string> = {
  "iop-high": "眼压≥25mmHg",
  "flap-displaced": "瓣移位",
};

/** 判定结果 */
export type Assessment =
  | { kind: "normal" }
  | { kind: "escalate-24h"; triggers: EscalationTrigger[] };

/** 复查记录：按患者、眼别、复查时刻留存，每次复查一份，不覆盖 */
export interface ReviewRecord {
  id: string;
  patientId: string;
  eye: EyeSide;
  /** 复查时刻 */
  reviewedAt: string;
  reading: ReviewReading;
  assessment: Assessment;
  corrections: Correction[];
}

export interface Patient {
  id: string;
  name: string;
  /** 手术日期 */
  surgeryDate: string;
}

/** 药品批次 */
export interface MedBatch {
  batchNo: string;
  drugName: string;
  /** 有效期至 YYYY-MM-DD */
  expiresAt: string;
  /** 剩余药量（支） */
  stockRemaining: number;
}

/** 发放登记：批次 + 数量，关联复查记录 */
export interface DispenseEntry {
  id: string;
  reviewId: string;
  patientId: string;
  eye: EyeSide;
  batchNo: string;
  quantity: number;
  dispensedAt: string;
}

export type ReferralStatus = "open" | "closed-by-correction";

/** 24小时复诊转诊单：复查记录保留，转诊单跟踪处置状态 */
export interface Referral {
  id: string;
  reviewId: string;
  patientId: string;
  eye: EyeSide;
  triggers: EscalationTrigger[];
  createdAt: string;
  dueWithinHours: 24;
  status: ReferralStatus;
}
