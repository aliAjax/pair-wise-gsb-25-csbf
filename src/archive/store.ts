// 留档：复查记录、批次与发放登记的本地持久化

import type { DispenseEntry, FollowUpRecord, MedicationBatch } from "../domain/types";
import { seedBatches, seedRecords } from "../data/seed";

export interface ArchiveState {
  records: FollowUpRecord[];
  batches: MedicationBatch[];
  dispenses: DispenseEntry[];
}

const STORAGE_KEY = "hxwl-11.followup-archive.v1";

export function loadArchive(): ArchiveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ArchiveState;
      if (
        Array.isArray(parsed.records) &&
        Array.isArray(parsed.batches) &&
        Array.isArray(parsed.dispenses)
      ) {
        return parsed;
      }
    }
  } catch {
    // 本地数据损坏时回退到种子资料
  }
  return { records: seedRecords, batches: seedBatches, dispenses: [] };
}

export function saveArchive(state: ArchiveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时仅保留内存态
  }
}

let counter = 0;

export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
