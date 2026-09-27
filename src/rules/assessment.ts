/**
 * 判定层：复查判定与续药闸门的纯函数。
 * 不依赖存储和页面，输入资料、输出结论。
 */
import type {
  Assessment,
  EscalationTrigger,
  MedBatch,
  ReviewReading,
  ReviewRecord,
} from "../data/types";

/** 眼压达到 25mmHg 即触发24小时复诊 */
export const IOP_LIMIT_MMHG = 25;

/** 复查判定：眼压≥25mmHg 或瓣移位 → 转24小时复诊 */
export function assessReading(reading: ReviewReading): Assessment {
  const triggers: EscalationTrigger[] = [];
  if (reading.iopMmHg >= IOP_LIMIT_MMHG) triggers.push("iop-high");
  if (reading.flapDisplaced) triggers.push("flap-displaced");
  return triggers.length > 0 ? { kind: "escalate-24h", triggers } : { kind: "normal" };
}

/** 批次有效 = 未过期且有剩余药量 */
export function isBatchValid(batch: MedBatch, today: string): boolean {
  return batch.expiresAt >= today && batch.stockRemaining > 0;
}

export type DispenseGate =
  | { allowed: true; maxQuantity: number }
  | { allowed: false; reason: string };

/**
 * 续药闸门：护士续药前必须过闸。
 * 复查无异常且批次有效才允许按剩余药量发放；
 * 转24小时复诊的复查记录保留，但药房不能续药。
 */
export function gateDispense(
  review: ReviewRecord | null,
  batch: MedBatch | null,
  today: string,
): DispenseGate {
  if (!review) {
    return { allowed: false, reason: "该患者该眼别尚无复查记录，不能续药" };
  }
  if (review.assessment.kind === "escalate-24h") {
    return { allowed: false, reason: "复查已转24小时复诊，药房不能续药" };
  }
  if (!batch) {
    return { allowed: false, reason: "未选择药品批次" };
  }
  if (batch.expiresAt < today) {
    return { allowed: false, reason: `批次 ${batch.batchNo} 已过期（有效期至 ${batch.expiresAt}）` };
  }
  if (batch.stockRemaining <= 0) {
    return { allowed: false, reason: `批次 ${batch.batchNo} 剩余药量为0` };
  }
  return { allowed: true, maxQuantity: batch.stockRemaining };
}
