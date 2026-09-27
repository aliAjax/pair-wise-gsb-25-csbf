/**
 * 资料层：读数与时间的展示格式化。
 */
import type { CorrectableField, ReviewReading } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** 当前日期 YYYY-MM-DD，用于批次有效期比对 */
export function todayString(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** datetime-local 输入框的当前值 */
export function toLocalInputValue(d: Date): string {
  return `${todayString(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-09-27T14:30" -> "2026-09-27 14:30" */
export function formatDateTime(value: string): string {
  return value.replace("T", " ").slice(0, 16);
}

/** 读数字段的可读取值，纠正留痕和页面共用 */
export function formatReadingValue(reading: ReviewReading, field: CorrectableField): string {
  switch (field) {
    case "uncorrectedAcuity":
      return reading.uncorrectedAcuity;
    case "iopMmHg":
      return `${reading.iopMmHg}mmHg`;
    case "flapDisplaced":
      return reading.flapDisplaced ? "有" : "无";
  }
}
