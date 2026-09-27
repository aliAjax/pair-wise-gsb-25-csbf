/**
 * 页面层：复查录入。裸眼视力、眼压、瓣移位、症状与药品余量同单上报。
 */
import { useState } from "react";
import { saveReview, useArchive } from "../archive/archive";
import { toLocalInputValue } from "../data/format";
import { SYMPTOM_OPTIONS } from "../data/seed";
import type { EyeSide, ReviewReading } from "../data/types";
import { EYE_LABEL, TRIGGER_LABEL } from "../data/types";
import { assessReading } from "../rules/assessment";

export function ReviewForm() {
  const { patients } = useArchive();
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [eye, setEye] = useState<EyeSide>("OD");
  const [reviewedAt, setReviewedAt] = useState(() => toLocalInputValue(new Date()));
  const [acuity, setAcuity] = useState("1.0");
  const [iop, setIop] = useState("16");
  const [flapDisplaced, setFlapDisplaced] = useState(false);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [medicationLow, setMedicationLow] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");

  const reading: ReviewReading = {
    uncorrectedAcuity: acuity.trim(),
    iopMmHg: Number(iop),
    flapDisplaced,
    symptoms,
    medicationLow,
  };
  const preview = assessReading(reading);

  function toggleSymptom(symptom: string) {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom],
    );
  }

  function handleSave() {
    if (!patientId) return setError("请选择患者");
    if (!reviewedAt) return setError("请填写复查时刻");
    if (!reading.uncorrectedAcuity) return setError("请填写裸眼视力");
    if (!Number.isFinite(reading.iopMmHg) || reading.iopMmHg <= 0 || reading.iopMmHg > 60) {
      return setError("眼压需为 1–60 之间的数字");
    }
    const record = saveReview({ patientId, eye, reviewedAt, reading });
    setError("");
    setSavedId(record.id);
    setSymptoms([]);
    setFlapDisplaced(false);
    setMedicationLow(false);
    setReviewedAt(toLocalInputValue(new Date()));
  }

  return (
    <div className="form-grid">
      <h2>复查录入</h2>
      <div className="field-row">
        <label>
          <span>患者</span>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（手术 {p.surgeryDate}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>眼别</span>
          <select value={eye} onChange={(e) => setEye(e.target.value as EyeSide)}>
            {(Object.keys(EYE_LABEL) as EyeSide[]).map((side) => (
              <option key={side} value={side}>
                {EYE_LABEL[side]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span>复查时刻</span>
        <input
          type="datetime-local"
          value={reviewedAt}
          onChange={(e) => setReviewedAt(e.target.value)}
        />
      </label>
      <div className="field-row">
        <label>
          <span>裸眼视力</span>
          <input value={acuity} onChange={(e) => setAcuity(e.target.value)} placeholder="如 1.0" />
        </label>
        <label>
          <span>眼压（mmHg）</span>
          <input
            type="number"
            min="1"
            max="60"
            value={iop}
            onChange={(e) => setIop(e.target.value)}
          />
        </label>
      </div>
      <label className="check-line">
        <input
          type="checkbox"
          checked={flapDisplaced}
          onChange={(e) => setFlapDisplaced(e.target.checked)}
        />
        <span>发现角膜瓣移位</span>
      </label>
      <div>
        <span className="field-label">症状</span>
        <div className="symptom-grid">
          {SYMPTOM_OPTIONS.map((symptom) => (
            <label key={symptom} className="check-line">
              <input
                type="checkbox"
                checked={symptoms.includes(symptom)}
                onChange={() => toggleSymptom(symptom)}
              />
              <span>{symptom}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="check-line">
        <input
          type="checkbox"
          checked={medicationLow}
          onChange={(e) => setMedicationLow(e.target.checked)}
        />
        <span>药品快用完（与本次读数同单上报）</span>
      </label>

      {preview.kind === "normal" ? (
        <p className="banner banner-ok">判定：无异常。批次有效时可按剩余药量续药。</p>
      ) : (
        <p className="banner banner-danger">
          判定：转24小时复诊（{preview.triggers.map((t) => TRIGGER_LABEL[t]).join("、")}
          ）。记录保留，药房不能续药。
        </p>
      )}

      {error && <p className="error-text">{error}</p>}
      {savedId && <p className="ok-text">已留档：{savedId}</p>}
      <button className="primary-action" onClick={handleSave}>
        留存本次复查
      </button>
    </div>
  );
}
