/**
 * 页面层：药房续药。续药必须过闸——复查无异常且批次有效，
 * 按剩余药量发放并登记批次数量。
 */
import { useState } from "react";
import { dispenseMedication, latestReview, useArchive } from "../archive/archive";
import { formatDateTime, todayString } from "../data/format";
import type { EyeSide } from "../data/types";
import { EYE_LABEL, TRIGGER_LABEL } from "../data/types";
import { gateDispense, isBatchValid } from "../rules/assessment";

export function PharmacyPanel() {
  const { patients, reviews, batches, dispenses } = useArchive();
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [eye, setEye] = useState<EyeSide>("OD");
  const [batchNo, setBatchNo] = useState(batches[0]?.batchNo ?? "");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const today = todayString();
  const review = latestReview(reviews, patientId, eye);
  const batch = batches.find((b) => b.batchNo === batchNo) ?? null;
  const gate = gateDispense(review, batch, today);

  function handleDispense() {
    if (!review) return;
    const result = dispenseMedication(review.id, batchNo, Number(quantity), today);
    setMessage(
      result.ok
        ? { ok: true, text: `已登记批次 ${result.entry.batchNo}，数量 ${result.entry.quantity} 支` }
        : { ok: false, text: result.reason },
    );
  }

  return (
    <div className="form-grid">
      <h2>药房续药</h2>
      <div className="field-row">
        <label>
          <span>患者</span>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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

      {review ? (
        <div className="review-summary">
          <div className="review-head">
            <strong>最近复查 {formatDateTime(review.reviewedAt)}</strong>
            {review.assessment.kind === "normal" ? (
              <span className="badge badge-ok">无异常</span>
            ) : (
              <span className="badge badge-danger">
                转24小时复诊：
                {review.assessment.triggers.map((t) => TRIGGER_LABEL[t]).join("、")}
              </span>
            )}
          </div>
          <div className="reading-grid">
            <div>
              <span>裸眼视力</span>
              {review.reading.uncorrectedAcuity}
            </div>
            <div>
              <span>眼压</span>
              {review.reading.iopMmHg}mmHg
            </div>
            <div>
              <span>瓣移位</span>
              {review.reading.flapDisplaced ? "有" : "无"}
            </div>
            <div>
              <span>药品快用完</span>
              {review.reading.medicationLow ? "是" : "否"}
            </div>
          </div>
        </div>
      ) : (
        <p className="banner banner-danger">该患者该眼别尚无复查记录，不能续药。</p>
      )}

      <div>
        <span className="field-label">药品批次（有效期 / 剩余药量）</span>
        <table className="batch-table">
          <thead>
            <tr>
              <th></th>
              <th>批次</th>
              <th>药品</th>
              <th>有效期至</th>
              <th>剩余</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.batchNo}>
                <td>
                  <input
                    type="radio"
                    name="batch"
                    checked={batchNo === b.batchNo}
                    onChange={() => setBatchNo(b.batchNo)}
                  />
                </td>
                <td>{b.batchNo}</td>
                <td>{b.drugName}</td>
                <td>{b.expiresAt}</td>
                <td>{b.stockRemaining} 支</td>
                <td>
                  {isBatchValid(b, today) ? (
                    <span className="badge badge-ok">有效</span>
                  ) : (
                    <span className="badge badge-danger">
                      {b.expiresAt < today ? "已过期" : "已售罄"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {gate.allowed ? (
        <div className="field-row dispense-row">
          <label>
            <span>发放数量（最多 {gate.maxQuantity} 支）</span>
            <input
              type="number"
              min="1"
              max={gate.maxQuantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <button className="primary-action" onClick={handleDispense}>
            按剩余药量发放并登记
          </button>
        </div>
      ) : (
        <p className="banner banner-danger">{gate.reason}</p>
      )}

      {message && <p className={message.ok ? "ok-text" : "error-text"}>{message.text}</p>}

      <div>
        <span className="field-label">发放登记</span>
        {dispenses.length === 0 ? (
          <p className="empty">暂无发放记录</p>
        ) : (
          <ul className="ledger-list">
            {dispenses.map((d) => (
              <li key={d.id}>
                {formatDateTime(d.dispensedAt)} · {patients.find((p) => p.id === d.patientId)?.name ?? d.patientId} ·{" "}
                {EYE_LABEL[d.eye]} · 批次 {d.batchNo} · {d.quantity} 支
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
