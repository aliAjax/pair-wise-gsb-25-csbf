// 资料：患者、药品批次与示例复查留档

import type { FollowUpRecord, MedicationBatch, Patient } from "../domain/types";

export const patients: Patient[] = [
  { id: "P-2026-031", name: "林某", surgery: "半飞秒 LASIK", surgeryDate: "2026-09-20" },
  { id: "P-2026-044", name: "王某", surgery: "半飞秒 LASIK", surgeryDate: "2026-09-24" },
  { id: "P-2026-052", name: "周某", surgery: "准分子 LASIK", surgeryDate: "2026-09-25" },
];

export const seedBatches: MedicationBatch[] = [
  { batchNo: "LEV-2607A", drug: "左氧氟沙星滴眼液", unit: "支", remaining: 18, expiresAt: "2027-03-31" },
  { batchNo: "FML-2603B", drug: "氟米龙滴眼液", unit: "支", remaining: 6, expiresAt: "2026-12-31" },
  { batchNo: "HYA-2511C", drug: "玻璃酸钠滴眼液", unit: "瓶", remaining: 9, expiresAt: "2026-08-31" },
];

export const seedRecords: FollowUpRecord[] = [
  {
    id: "RV-0001",
    patientId: "P-2026-031",
    eye: "right",
    visitAt: "2026-09-27T09:10",
    uncorrectedVision: "0.8",
    iop: 16,
    flapDisplaced: false,
    symptoms: ["异物感"],
    corrections: [],
    recordedAt: "2026-09-27T09:20",
  },
  {
    id: "RV-0002",
    patientId: "P-2026-044",
    eye: "left",
    visitAt: "2026-09-27T10:05",
    uncorrectedVision: "0.5",
    iop: 26,
    flapDisplaced: false,
    symptoms: ["眼痛", "视物模糊"],
    corrections: [
      {
        field: "iop",
        oldValue: "21",
        newValue: "26",
        reason: "非接触眼压计复测，首次读数偏低",
        correctedAt: "2026-09-27T10:18",
      },
    ],
    recordedAt: "2026-09-27T10:12",
  },
];
