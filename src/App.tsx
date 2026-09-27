import "./styles.css";
import { ReviewStation } from "./pages/ReviewStation";

const project = {
  id: "hxwl-11",
  port: 5111,
  title: "眼科验光复查台",
  subtitle:
    "验光页扩展为术后复查台：按患者、眼别、复查时刻记录裸眼视力、眼压、瓣移位与症状，药品余量同单上报；判定联动24小时复诊与药房续药。",
  stack: "React + Vite + TypeScript + CSS",
};

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">
            {project.id} · port {project.port}
          </p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
          <span>分层</span>
          <strong>资料 data · 判定 rules · 留档 archive · 页面 pages</strong>
        </div>
      </section>

      <ReviewStation />
    </main>
  );
}

export default App;
