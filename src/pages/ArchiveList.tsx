/**
 * 页面层：复查留档。每次复查一份记录，纠正读数保留旧值和原因。
 */
import { useState } from "react";
import { correctReading, useArchive } from "../archive/archive";
import { formatDateTime } from "../data/format";
import type { CorrectableField, ReviewRecord } from "../data/types";
import { EYE_LABEL, FIELD_LABEL, TRIGGER_LABEL } from "../data/types";

function CorrectionForm({ record }: { record: ReviewRecord }) {
  const [field, setField] = useState<CorrectableField>("iopMmHg");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function changeField(next: CorrectableField) {
    setField(next);
    setValue(next === "flapDisplaced" ? "false" : "");
    setError("");
  }

  function submit() {
    if (field !== "flapDisplaced" && !value.trim()) return setError("请填写新读数");
    if (field === "iopMmHg" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
      return setError("眼压需为数字");
    }
    if (!reason.trim()) return setError("纠正必须填写原因");
    correctReading(record.id, field, field === "flapDisplaced" ? value : value.trim(), reason.trim());
    setValue(field === "flapDisplaced" ? "false" : "");
    setReason("");
    setError("");
  }

  return (
    <div className="correction-form">
      <div className="field-row three">
        <label>
          <span>纠正字段</span>
          <select value={field} onChange={(e) => changeField(e.target.value as CorrectableField)}>
            {(Object.keys(FIELD_LABEL) as CorrectableField[]).map((f) => (
              <option key={f} value={f}>
                {FIELD_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>新读数</span>
          {field === "flapDisplaced" ? (
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="false">无</option>
              <option value="true">有</option>
            </select>
          ) : (
            <input
              type={field === "iopMmHg" ? "number" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field === "iopMmHg" ? "mmHg" : "如 0.8"}
            />
          )}
        </label>
        <label>
          <span>纠正原因</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="如 眼压计未校准"
          />
        </label>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div>
        <button onClick={submit}>确认纠正（保留旧值和原因）</button>
      </div>
    </div>
  );
}

function ReviewCard({ record, patientName }: { record: ReviewRecord; patientName: string }) {
  const [correcting, setCorrecting] = useState(false);
  const { assessment } = record;

  return (
    <article className={assessment.kind === "escalate-24h" ? "review-card danger" : "review-card"}>
      <div className="review-head">
        <strong>
          {patientName} · {EYE_LABEL[record.eye]} · {formatDateTime(record.reviewedAt)}
        </strong>
        {assessment.kind === "escalate-24h" ? (
          <span className="badge badge-danger">
            转24小时复诊：
            {assessment.triggers.map((t) => TRIGGER_LABEL[t]).join("、")}
          </span>
        ) : (
          <span className="badge badge-ok">无异常</span>
        )}
      </div>
      <div className="reading-grid">
        <div>
          <span>裸眼视力</span>
          {record.reading.uncorrectedAcuity}
        </div>
        <div>
          <span>眼压</span>
          {record.reading.iopMmHg}mmHg
        </div>
        <div>
          <span>瓣移位</span>
          {record.reading.flapDisplaced ? "有" : "无"}
        </div>
        <div>
          <span>症状</span>
          {record.reading.symptoms.length > 0 ? record.reading.symptoms.join("、") : "无"}
        </div>
        <div>
          <span>药品快用完</span>
          {record.reading.medicationLow ? "是" : "否"}
        </div>
      </div>

      {record.corrections.length > 0 && (
        <ul className="correction-list">
          {record.corrections.map((c, i) => (
            <li key={i}>
              纠正：{FIELD_LABEL[c.field]} {c.oldValue} → {c.newValue} · 原因：{c.reason} ·{" "}
              {formatDateTime(c.correctedAt)}
            </li>
          ))}
        </ul>
      )}

      <div>
        <button onClick={() => setCorrecting((v) => !v)}>
          {correcting ? "收起纠正" : "纠正读数"}
        </button>
      </div>
      {correcting && <CorrectionForm record={record} />}
    </article>
  );
}

export function ArchiveList() {
  const { patients, reviews } = useArchive();
  const sorted = [...reviews].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  const nameOf = (id: string) => patients.find((p) => p.id === id)?.name ?? id;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>留档</p>
          <h2>复查留档（每次复查一份）</h2>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="empty">暂无复查记录</p>
      ) : (
        <div className="record-list">
          {sorted.map((record) => (
            <ReviewCard key={record.id} record={record} patientName={nameOf(record.patientId)} />
          ))}
        </div>
      )}
    </section>
  );
}
