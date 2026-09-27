/**
 * 资料层：基础资料（患者、药品批次、症状选项）。
 */
import type { MedBatch, Patient } from "./types";

export const SYMPTOM_OPTIONS = ["眼痛", "畏光", "流泪", "异物感", "视物模糊", "眼红"];

export const PATIENTS: Patient[] = [
  { id: "P-032", name: "Patient-032", surgeryDate: "2026-09-20" },
  { id: "P-081", name: "Patient-081", surgeryDate: "2026-09-22" },
  { id: "P-144", name: "Patient-144", surgeryDate: "2026-09-25" },
];

function shiftDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 批次有效期相对今天生成，保证演示时有效/过期/临近售罄三种情形都成立 */
export function seedBatches(now = new Date()): MedBatch[] {
  return [
    {
      batchNo: "B2026-09A",
      drugName: "玻璃酸钠滴眼液",
      expiresAt: shiftDays(now, 120),
      stockRemaining: 40,
    },
    {
      batchNo: "B2026-06B",
      drugName: "氟米龙滴眼液",
      expiresAt: shiftDays(now, -10),
      stockRemaining: 12,
    },
    {
      batchNo: "B2026-09C",
      drugName: "左氧氟沙星滴眼液",
      expiresAt: shiftDays(now, 60),
      stockRemaining: 3,
    },
  ];
}
