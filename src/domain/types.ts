// 资料结构：复查记录、患者、药品批次、发放登记

export type EyeSide = "right" | "left";

export const EYE_SIDE_LABEL: Record<EyeSide, string> = {
  right: "右眼",
  left: "左眼",
};

export const SYMPTOM_OPTIONS = ["眼痛", "畏光", "流泪", "异物感", "视物模糊", "眼红"] as const;

/** 允许纠正的读数字段 */
export type CorrectableField = "uncorrectedVision" | "iop" | "flapDisplaced";

/** 纠正留痕：保留旧值与原因 */
export interface Correction {
  field: CorrectableField;
  oldValue: string;
  newValue: string;
  reason: string;
  correctedAt: string;
}

/** 一份复查留档：按患者、眼别、复查时刻记录 */
export interface FollowUpRecord {
  id: string;
  patientId: string;
  eye: EyeSide;
  visitAt: string; // 复查时刻，datetime-local 格式
  uncorrectedVision: string; // 裸眼视力
  iop: number; // 眼压 mmHg
  flapDisplaced: boolean; // 角膜瓣移位
  symptoms: string[]; // 症状
  corrections: Correction[]; // 纠正留痕，只追加不改写
  recordedAt: string; // 留档时刻
}

export interface Patient {
  id: string;
  name: string;
  surgery: string;
  surgeryDate: string;
}

export interface MedicationBatch {
  batchNo: string;
  drug: string;
  unit: string;
  remaining: number; // 剩余药量
  expiresAt: string; // 批次有效期 YYYY-MM-DD
}

/** 发放登记：批次 + 数量，关联复查记录 */
export interface DispenseEntry {
  id: string;
  recordId: string;
  batchNo: string;
  drug: string;
  quantity: number;
  unit: string;
  dispensedAt: string;
}
