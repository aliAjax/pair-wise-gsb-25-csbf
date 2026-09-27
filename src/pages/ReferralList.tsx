/**
 * 页面层：24小时复诊转诊单列表。
 */
import { useArchive } from "../archive/archive";
import { formatDateTime } from "../data/format";
import { EYE_LABEL, TRIGGER_LABEL } from "../data/types";

export function ReferralList() {
  const { patients, referrals } = useArchive();
  const nameOf = (id: string) => patients.find((p) => p.id === id)?.name ?? id;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>转诊</p>
          <h2>24小时复诊</h2>
        </div>
      </div>
      {referrals.length === 0 ? (
        <p className="empty">暂无转诊</p>
      ) : (
        <div className="record-list">
          {referrals.map((r) => (
            <article
              key={r.id}
              className={r.status === "open" ? "referral-item" : "referral-item closed"}
            >
              <div>
                <strong>
                  {nameOf(r.patientId)} · {EYE_LABEL[r.eye]}
                </strong>
                <p>
                  触发：{r.triggers.map((t) => TRIGGER_LABEL[t]).join("、")} · 开立于{" "}
                  {formatDateTime(r.createdAt)} · 须 {r.dueWithinHours} 小时内复诊
                </p>
              </div>
              {r.status === "open" ? (
                <span className="badge badge-danger">待复诊</span>
              ) : (
                <span className="badge badge-muted">纠正后解除</span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
