/**
 * 页面层：复查台组装。录入、药房、留档、转诊四个工作区。
 */
import { useArchive } from "../archive/archive";
import { ArchiveList } from "./ArchiveList";
import { PharmacyPanel } from "./PharmacyPanel";
import { ReferralList } from "./ReferralList";
import { ReviewForm } from "./ReviewForm";

const statusColors = ["status-ok", "status-watch", "status-danger"];

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

export function ReviewStation() {
  const { reviews, referrals, dispenses } = useArchive();

  const metrics = [
    { label: "复查留档", value: String(reviews.length) },
    { label: "24小时复诊中", value: String(referrals.filter((r) => r.status === "open").length) },
    { label: "已发放（支）", value: String(dispenses.reduce((sum, d) => sum + d.quantity, 0)) },
    { label: "纠正留痕", value: String(reviews.reduce((sum, r) => sum + r.corrections.length, 0)) },
  ];

  return (
    <>
      <section className="metrics-grid">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} index={index} />
        ))}
      </section>

      <section className="station-grid">
        <aside className="panel">
          <ReviewForm />
        </aside>
        <section className="panel">
          <PharmacyPanel />
        </section>
      </section>

      <ArchiveList />
      <ReferralList />
    </>
  );
}
