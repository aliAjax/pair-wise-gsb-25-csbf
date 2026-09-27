import { useEffect, useState } from "react";
import "./styles.css";
import { patients } from "./data/seed";
import {
  applyCorrection,
  checkDispense,
  CORRECTABLE_FIELD_LABEL,
  evaluateFollowUp,
  IOP_REFERRAL_THRESHOLD,
  isBatchValid,
  readFieldValue,
} from "./domain/rules";
import {
  EYE_SIDE_LABEL,
  SYMPTOM_OPTIONS,
  type CorrectableField,
  type EyeSide,
  type FollowUpRecord,
} from "./domain/types";
import { loadArchive, nextId, saveArchive, type ArchiveState } from "./archive/store";

const statusColors = ["status-ok", "status-watch", "status-danger"];

interface FollowUpForm {
  patientId: string;
  eye: EyeSide;
  visitAt: string;
  uncorrectedVision: string;
  iop: string;
  flapDisplaced: boolean;
  symptoms: string[];
}

interface CorrectionDraft {
  field: CorrectableField;
  value: string;
  reason: string;
}

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function blankForm(): FollowUpForm {
  return {
    patientId: patients[0]?.id ?? "",
    eye: "right",
    visitAt: nowLocal(),
    uncorrectedVision: "",
    iop: "",
    flapDisplaced: false,
    symptoms: [],
  };
}

function fmtTime(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

function patientName(id: string): string {
  return patients.find((p) => p.id === id)?.name ?? id;
}

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

function App() {
  const [archive, setArchive] = useState<ArchiveState>(loadArchive);
  const [form, setForm] = useState<FollowUpForm>(blankForm);
  const [formError, setFormError] = useState("");
  const [activeRecordId, setActiveRecordId] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [dispenseMsg, setDispenseMsg] = useState("");
  const [drafts, setDrafts] = useState<Record<string, CorrectionDraft>>({});

  useEffect(() => {
    saveArchive(archive);
  }, [archive]);

  const records = archive.records;
  const sortedRecords = [...records].sort((a, b) => b.visitAt.localeCompare(a.visitAt));
  const activeRecord = records.find((r) => r.id === activeRecordId) ?? sortedRecords[0];
  const activeDecision = activeRecord ? evaluateFollowUp(activeRecord) : null;

  const previewDecision = evaluateFollowUp({
    iop: Number(form.iop) || 0,
    flapDisplaced: form.flapDisplaced,
  });

  const referralCount = records.filter((r) => evaluateFollowUp(r).level === "referral-24h").length;
  const correctionCount = records.reduce((n, r) => n + r.corrections.length, 0);
  const dispensedUnits = archive.dispenses.reduce((n, d) => n + d.quantity, 0);

  const metrics: Array<[string, string]> = [
    ["留档复查", String(records.length)],
    ["24小时复诊", String(referralCount)],
    ["发放登记", `${archive.dispenses.length} 笔 / ${dispensedUnits} 件`],
    ["纠正留痕", String(correctionCount)],
  ];

  function toggleSymptom(symptom: string) {
    setForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter((s) => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  }

  function saveFollowUp() {
    const iop = Number(form.iop);
    if (
      !form.patientId ||
      !form.visitAt ||
      !form.uncorrectedVision.trim() ||
      form.iop === "" ||
      !Number.isFinite(iop)
    ) {
      setFormError("请完整填写患者、复查时刻、裸眼视力与眼压读数");
      return;
    }
    const record: FollowUpRecord = {
      id: nextId("RV"),
      patientId: form.patientId,
      eye: form.eye,
      visitAt: form.visitAt,
      uncorrectedVision: form.uncorrectedVision.trim(),
      iop,
      flapDisplaced: form.flapDisplaced,
      symptoms: form.symptoms,
      corrections: [],
      recordedAt: new Date().toISOString(),
    };
    setArchive((prev) => ({ ...prev, records: [...prev.records, record] }));
    setActiveRecordId(record.id);
    setFormError("");
    setDispenseMsg("");
    setForm(blankForm());
  }

  function dispense() {
    if (!activeRecord || !activeDecision) {
      setDispenseMsg("请先保存一份复查记录，药房凭复查判定续药");
      return;
    }
    const batch = archive.batches.find((b) => b.batchNo === batchNo) ?? null;
    const qty = Number(quantity);
    const check = checkDispense(activeDecision, batch, qty);
    setDispenseMsg(check.message);
    if (!check.allowed || !batch) return;
    setArchive((prev) => ({
      ...prev,
      batches: prev.batches.map((b) =>
        b.batchNo === batch.batchNo ? { ...b, remaining: b.remaining - qty } : b
      ),
      dispenses: [
        ...prev.dispenses,
        {
          id: nextId("DP"),
          recordId: activeRecord.id,
          batchNo: batch.batchNo,
          drug: batch.drug,
          quantity: qty,
          unit: batch.unit,
          dispensedAt: new Date().toISOString(),
        },
      ],
    }));
  }

  function draftFor(recordId: string): CorrectionDraft {
    return drafts[recordId] ?? { field: "iop", value: "", reason: "" };
  }

  function setDraft(recordId: string, patch: Partial<CorrectionDraft>) {
    setDrafts((prev) => ({ ...prev, [recordId]: { ...draftFor(recordId), ...patch } }));
  }

  function submitCorrection(record: FollowUpRecord) {
    const draft = draftFor(record.id);
    const value = draft.value.trim();
    const reason = draft.reason.trim();
    if (!value || !reason) return;
    if (draft.field === "iop" && !Number.isFinite(Number(value))) return;
    setArchive((prev) => ({
      ...prev,
      records: prev.records.map((r) =>
        r.id === record.id
          ? applyCorrection(r, draft.field, value, reason, new Date().toISOString())
          : r
      ),
    }));
    setDrafts((prev) => ({ ...prev, [record.id]: { field: draft.field, value: "", reason: "" } }));
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-11 · port 5111</p>
          <h1>术后复查台</h1>
          <p className="subtitle">
            按患者、眼别与复查时刻记录裸眼视力、眼压、角膜瓣状态与症状，每次复查留档一份；
            眼压 ≥ {IOP_REFERRAL_THRESHOLD}mmHg 或瓣移位即转 24 小时复诊，药房停止续药。
          </p>
        </div>
        <div className="stack-card">
          <span>组织方式</span>
          <strong>资料 data · 判定 rules · 留档 archive · 页面 ui</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map(([label, value], index) => (
          <MetricCard key={label} label={label} value={value} index={index} />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>岗位</h2>
          <div className="chips">
            <span>复查护士</span>
            <span>复查医生</span>
            <span>药房药师</span>
          </div>
          <h2>判定规则</h2>
          <ul className="rule-list">
            <li>眼压 ≥ {IOP_REFERRAL_THRESHOLD}mmHg → 转 24 小时复诊</li>
            <li>角膜瓣移位 → 转 24 小时复诊</li>
            <li>触发任一条件：记录保留，药房不能续药</li>
            <li>无异常且批次有效：按剩余药量发放并登记批次数量</li>
            <li>纠正读数：保留旧值与原因</li>
          </ul>
          <h2>患者</h2>
          <div className="chips muted">
            {patients.map((p) => (
              <button key={p.id} onClick={() => setForm((f) => ({ ...f, patientId: p.id }))}>
                {p.name} · {p.id}
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>复查录入</p>
              <h2>新建复查记录</h2>
            </div>
            <button className="primary-action" onClick={saveFollowUp}>
              保存并判定
            </button>
          </div>
          <div className="field-grid">
            <label>
              <span>患者</span>
              <select
                value={form.patientId}
                onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.id} · {p.surgery}（{p.surgeryDate}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>眼别</span>
              <select
                value={form.eye}
                onChange={(e) => setForm({ ...form, eye: e.target.value as EyeSide })}
              >
                {Object.entries(EYE_SIDE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>复查时刻</span>
              <input
                type="datetime-local"
                value={form.visitAt}
                onChange={(e) => setForm({ ...form, visitAt: e.target.value })}
              />
            </label>
            <label>
              <span>裸眼视力</span>
              <input
                placeholder="如 0.8"
                value={form.uncorrectedVision}
                onChange={(e) => setForm({ ...form, uncorrectedVision: e.target.value })}
              />
            </label>
            <label>
              <span>眼压（mmHg）</span>
              <input
                type="number"
                min="0"
                placeholder="如 16"
                value={form.iop}
                onChange={(e) => setForm({ ...form, iop: e.target.value })}
              />
            </label>
            <label>
              <span>角膜瓣状态</span>
              <select
                value={form.flapDisplaced ? "yes" : "no"}
                onChange={(e) => setForm({ ...form, flapDisplaced: e.target.value === "yes" })}
              >
                <option value="no">瓣位正常</option>
                <option value="yes">瓣移位</option>
              </select>
            </label>
          </div>
          <div className="symptom-block">
            <span className="hint">症状（可多选）</span>
            <div className="chips symptom-chips">
              {SYMPTOM_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={form.symptoms.includes(s) ? "active" : ""}
                  onClick={() => toggleSymptom(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {formError && <p className="error-text">{formError}</p>}
          <div className={`decision ${previewDecision.level === "routine" ? "ok" : "danger"}`}>
            <strong>
              {previewDecision.level === "routine"
                ? "判定预览：无异常，可按规则续药"
                : "判定预览：转 24 小时复诊，药房不能续药"}
            </strong>
            <p>{previewDecision.reasons.join("；")}</p>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>药房</p>
            <h2>续药发放（凭复查判定）</h2>
          </div>
        </div>
        <div className="dispense-context">
          <label>
            <span>关联复查记录</span>
            <select
              value={activeRecord?.id ?? ""}
              onChange={(e) => setActiveRecordId(e.target.value)}
            >
              {sortedRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} · {patientName(r.patientId)} · {EYE_SIDE_LABEL[r.eye]} ·{" "}
                  {fmtTime(r.visitAt)}
                </option>
              ))}
            </select>
          </label>
          {activeDecision && (
            <div className={`decision ${activeDecision.level === "routine" ? "ok" : "danger"}`}>
              <strong>
                {activeDecision.level === "routine" ? "本次复查无异常" : "已转 24 小时复诊"}
              </strong>
              <p>
                {activeDecision.reasons.join("；")}
                {activeDecision.pharmacyBlocked
                  ? "；药房不能续药"
                  : "；批次有效时可按剩余药量发放"}
              </p>
            </div>
          )}
        </div>
        <table className="batch-table">
          <thead>
            <tr>
              <th>批次</th>
              <th>药品</th>
              <th>剩余药量</th>
              <th>有效期至</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {archive.batches.map((b) => {
              const valid = isBatchValid(b);
              return (
                <tr key={b.batchNo}>
                  <td>{b.batchNo}</td>
                  <td>{b.drug}</td>
                  <td>
                    {b.remaining}
                    {b.unit}
                  </td>
                  <td>{b.expiresAt}</td>
                  <td>
                    <span className={`badge ${valid && b.remaining > 0 ? "ok" : "danger"}`}>
                      {!valid ? "批次过期" : b.remaining === 0 ? "已用完" : "有效"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="dispense-row">
          <label>
            <span>发放批次</span>
            <select value={batchNo} onChange={(e) => setBatchNo(e.target.value)}>
              <option value="">选择批次</option>
              {archive.batches.map((b) => (
                <option key={b.batchNo} value={b.batchNo}>
                  {b.batchNo} · {b.drug}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>数量</span>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <button
            className="primary-action"
            onClick={dispense}
            disabled={!activeDecision || activeDecision.pharmacyBlocked}
          >
            发放并登记
          </button>
        </div>
        {dispenseMsg && <p className="hint">{dispenseMsg}</p>}
        {archive.dispenses.length > 0 && (
          <div className="dispense-log">
            <h3>发放登记</h3>
            {archive.dispenses.map((d) => (
              <p key={d.id} className="hint">
                {d.id} · 凭 {d.recordId} · {d.drug}（批次 {d.batchNo}）× {d.quantity}
                {d.unit} · {fmtTime(d.dispensedAt)}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>留档</p>
            <h2>复查留档（每次复查一份）</h2>
          </div>
        </div>
        <div className="record-list">
          {sortedRecords.map((record, index) => {
            const decision = evaluateFollowUp(record);
            const draft = draftFor(record.id);
            return (
              <article key={record.id} className="record-card">
                <div className="record-index">
                  {String(sortedRecords.length - index).padStart(2, "0")}
                </div>
                <div className="record-body">
                  <div className="record-head">
                    <h3>
                      {record.id} · {patientName(record.patientId)} ·{" "}
                      {EYE_SIDE_LABEL[record.eye]}
                    </h3>
                    <span className={`badge ${decision.level === "routine" ? "ok" : "danger"}`}>
                      {decision.level === "routine" ? "无异常" : "转24小时复诊"}
                    </span>
                  </div>
                  <p className="hint">
                    复查时刻 {fmtTime(record.visitAt)} · 留档 {fmtTime(record.recordedAt)}
                  </p>
                  <div className="record-fields">
                    <span>裸眼视力 {record.uncorrectedVision}</span>
                    <span>眼压 {record.iop}mmHg</span>
                    <span>角膜瓣 {record.flapDisplaced ? "移位" : "位正"}</span>
                    <span>症状 {record.symptoms.length ? record.symptoms.join("、") : "无"}</span>
                  </div>
                  {record.corrections.length > 0 && (
                    <div className="corrections">
                      {record.corrections.map((c, i) => (
                        <p key={i}>
                          纠正{CORRECTABLE_FIELD_LABEL[c.field]}：{c.oldValue} → {c.newValue}
                          （原因：{c.reason} · {fmtTime(c.correctedAt)}）
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="correction-form">
                    <select
                      value={draft.field}
                      onChange={(e) =>
                        setDraft(record.id, { field: e.target.value as CorrectableField })
                      }
                    >
                      {Object.entries(CORRECTABLE_FIELD_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {draft.field === "flapDisplaced" ? (
                      <select
                        value={draft.value}
                        onChange={(e) => setDraft(record.id, { value: e.target.value })}
                      >
                        <option value="">选择读数</option>
                        <option value="无移位">无移位</option>
                        <option value="有移位">有移位</option>
                      </select>
                    ) : (
                      <input
                        placeholder={`新读数（当前 ${readFieldValue(record, draft.field)}）`}
                        value={draft.value}
                        onChange={(e) => setDraft(record.id, { value: e.target.value })}
                      />
                    )}
                    <input
                      placeholder="纠正原因"
                      value={draft.reason}
                      onChange={(e) => setDraft(record.id, { reason: e.target.value })}
                    />
                    <button
                      onClick={() => submitCorrection(record)}
                      disabled={!draft.value.trim() || !draft.reason.trim()}
                    >
                      纠正留痕
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default App;
