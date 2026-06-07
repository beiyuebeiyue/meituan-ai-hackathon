export function buildOpsWeeklyReportHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>焕甲运营数据周报 2026-W22</title>
  <style>
    :root {
      --bg: #f4f4f4;
      --panel: #ffffff;
      --ink: #0b0b0b;
      --text: #202020;
      --muted: #6c6c6c;
      --soft: #eeeeee;
      --line: #dedede;
      --blue: #2563eb;
      --green: #10b981;
      --orange: #f59e0b;
      --pink: #ec4899;
      --shadow: 0 18px 48px rgba(0, 0, 0, .08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.55;
    }
    .page {
      width: min(1280px, calc(100vw - 42px));
      margin: 0 auto;
      padding: 32px 0 54px;
    }
    .hero {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(320px, .75fr);
      gap: 36px;
      overflow: hidden;
      padding: 30px 32px 28px;
      border: 1px solid #cfcfca;
      border-radius: 10px;
      background:
        linear-gradient(#e4e4df 1px, transparent 1px),
        linear-gradient(90deg, #e4e4df 1px, transparent 1px),
        #fbfbf8;
      background-size: 28px 28px;
      color: var(--ink);
      box-shadow: 0 14px 34px rgba(0, 0, 0, .05);
    }
    .hero::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 6px;
      height: 100%;
      background: var(--ink);
    }
    .hero::after {
      content: "WEEKLY / OPERATIONS REVIEW";
      position: absolute;
      right: 18px;
      bottom: 12px;
      color: #a0a09a;
      font: 11px/1.2 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    .hero-copy {
      position: relative;
      z-index: 1;
    }
    .hero-topline {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 34px;
    }
    .report-chip,
    .status-chip {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      border: 1px solid var(--ink);
      border-radius: 2px;
      background: var(--ink);
      color: #fff;
      font: 11px/1 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    .status-chip {
      gap: 7px;
      border-color: #c9c9c4;
      background: rgba(255, 255, 255, .72);
      color: #444;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #111;
      box-shadow: 0 0 0 3px rgba(0, 0, 0, .08);
    }
    .eyebrow {
      margin: 0;
      color: #70706b;
      font: 11px/1.4 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      max-width: 680px;
      font-family: Georgia, "Times New Roman", "Songti SC", serif;
      font-size: 38px;
      line-height: 1.16;
      font-weight: 500;
    }
    h2 {
      margin: 0;
      font-size: 19px;
      line-height: 1.35;
    }
    p { margin: 0; }
    .period {
      margin-top: 14px;
      color: #555;
      font: 12px/1.55 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    .judgement {
      position: relative;
      z-index: 1;
      display: grid;
      align-content: space-between;
      min-height: 206px;
      padding: 18px 18px 20px;
      border: 1px solid #bebeb8;
      border-radius: 4px;
      background: rgba(255, 255, 255, .86);
      box-shadow: 8px 8px 0 rgba(0, 0, 0, .065);
    }
    .judgement-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: #6b6b66;
      font: 11px/1.3 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    .judgement p {
      margin-top: 28px;
      color: #1a1a1a;
      font-size: 17px;
      line-height: 1.65;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 18px;
    }
    .metric {
      position: relative;
      min-width: 0;
      min-height: 106px;
      padding: 14px 15px 16px;
      border: 1px solid #d3d3ce;
      border-radius: 6px;
      background: var(--panel);
      box-shadow: 0 7px 18px rgba(0, 0, 0, .025);
    }
    .metric::before {
      content: "";
      position: absolute;
      top: -1px;
      left: -1px;
      width: 18px;
      height: 3px;
      background: #111;
    }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 11px;
    }
    .metric strong {
      display: block;
      margin-top: 18px;
      color: var(--ink);
      font: 500 28px/1 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .panel {
      margin-top: 20px;
      padding: 22px 24px 24px;
      border: 1px solid #d5d5d0;
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 8px 22px rgba(0, 0, 0, .035);
    }
    .section-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 15px;
    }
    .section-head p {
      color: var(--muted);
      font-size: 12px;
      text-align: right;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
    }
    .insight-list {
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .insight-list li {
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      padding: 12px 14px;
      border: 1px solid #e1e1dc;
      border-radius: 6px;
      background: #fbfbf9;
    }
    .insight-list b {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border-radius: 999px;
      background: var(--ink);
      color: #fff;
      font: 12px/1 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
    }
    th, td {
      padding: 13px 14px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f3f3ef;
      color: #4b4b47;
      font-size: 12px;
      font-weight: 700;
    }
    td strong {
      color: var(--ink);
      font-variant-numeric: tabular-nums;
    }
    tr:last-child td { border-bottom: 0; }
    .trend {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #111827;
      font: 12px/1 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    .trend.up { color: #047857; background: #ecfdf5; }
    .trend.down { color: #b91c1c; background: #fef2f2; }
    .bar-list {
      display: grid;
      gap: 14px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr) 64px;
      gap: 12px;
      align-items: center;
      font-size: 13px;
    }
    .bar-track {
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: #eeeeee;
    }
    .bar-fill {
      display: block;
      height: 100%;
      border-radius: inherit;
    }
    .footer {
      margin-top: 20px;
      color: #868680;
      font-size: 12px;
      text-align: center;
    }
    @media (max-width: 860px) {
      .page { width: min(100vw - 24px, 1280px); padding-top: 18px; }
      .hero, .grid-2 { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="hero-copy">
        <div class="hero-topline">
          <span class="report-chip">2026-W22</span>
          <span class="status-chip"><i class="status-dot"></i> DATA READY</span>
        </div>
        <p class="eyebrow">OPERATIONS WEEKLY REPORT</p>
        <h1>焕甲运营数据周报</h1>
        <p class="period">周期：2026-05-25 至 2026-06-07 · 对比上周 2026-05-18 至 2026-05-24</p>
        <div class="metrics">
          <div class="metric"><span>营业额</span><strong>¥87,780</strong></div>
          <div class="metric"><span>用户数</span><strong>1,286</strong></div>
          <div class="metric"><span>商家数</span><strong>28</strong></div>
          <div class="metric"><span>焕甲使用次数</span><strong>399</strong></div>
        </div>
      </div>
      <aside class="judgement">
        <div class="judgement-label">
          <span>本周判断</span>
          <span>NO. 01</span>
        </div>
        <p>本周运营数据整体稳定，用户增长和 AI 焕甲使用继续贡献核心活跃。预约提交保持增长，但从试戴到预约仍是下一阶段最值得优化的转化环节。</p>
      </aside>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2>核心指标复盘</h2>
        <p>主指标取当前 Demo 运营看板口径，周环比用于展示趋势判断</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>指标</th>
              <th>本周</th>
              <th>上周</th>
              <th>环比</th>
              <th>解读</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>营业额</td>
              <td><strong>¥87,780</strong></td>
              <td>¥72,460</td>
              <td><span class="trend up">+21.1%</span></td>
              <td>热门款式和试戴入口带来更多预约线索，收入表现好于上周。</td>
            </tr>
            <tr>
              <td>用户数</td>
              <td><strong>1,286</strong></td>
              <td>1,084</td>
              <td><span class="trend up">+18.6%</span></td>
              <td>内容浏览和 AI 小嘉推荐带来新增访问，用户池继续扩大。</td>
            </tr>
            <tr>
              <td>日新增用户</td>
              <td><strong>62</strong></td>
              <td>49</td>
              <td><span class="trend up">+26.5%</span></td>
              <td>新增速度提升，建议继续在热门款式页强化试戴引导。</td>
            </tr>
            <tr>
              <td>商家数</td>
              <td><strong>28</strong></td>
              <td>24</td>
              <td><span class="trend up">+16.7%</span></td>
              <td>商家覆盖提升，热门款式推送后可继续提高“我也能做”的响应率。</td>
            </tr>
            <tr>
              <td>新增商家</td>
              <td><strong>3</strong></td>
              <td>2</td>
              <td><span class="trend up">+50.0%</span></td>
              <td>新增商家仍处早期阶段，建议优先补齐福田、南山等重点区域。</td>
            </tr>
            <tr>
              <td>焕甲使用次数</td>
              <td><strong>399</strong></td>
              <td>318</td>
              <td><span class="trend up">+25.5%</span></td>
              <td>AI 试戴需求明确，说明用户愿意先看上手效果再做预约决策。</td>
            </tr>
            <tr>
              <td>客单价</td>
              <td><strong>¥173</strong></td>
              <td>¥166</td>
              <td><span class="trend up">+4.2%</span></td>
              <td>客单价小幅提升，说明高热款和精致款对收入有正向拉动。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="section-head">
          <h2>转化链路</h2>
          <p>从推荐曝光到预约提交</p>
        </div>
        <div class="bar-list">
          <div class="bar-row"><span>推荐曝光</span><div class="bar-track"><span class="bar-fill" style="width:100%;background:var(--blue)"></span></div><strong>7,625</strong></div>
          <div class="bar-row"><span>推荐点击</span><div class="bar-track"><span class="bar-fill" style="width:42%;background:var(--green)"></span></div><strong>3,196</strong></div>
          <div class="bar-row"><span>使用焕甲</span><div class="bar-track"><span class="bar-fill" style="width:31%;background:var(--orange)"></span></div><strong>399</strong></div>
          <div class="bar-row"><span>预约提交</span><div class="bar-track"><span class="bar-fill" style="width:23%;background:var(--pink)"></span></div><strong>116</strong></div>
        </div>
      </div>
      <div class="panel">
        <div class="section-head">
          <h2>本周结论</h2>
          <p>运营动作建议</p>
        </div>
        <ol class="insight-list">
          <li><b>1</b><span>继续把 AI 试戴作为用户决策入口，在热门款式卡片和详情页强化“先试戴再预约”。</span></li>
          <li><b>2</b><span>将小红书趋势周报里的高热手工甲款式推送给商家，优先引导商家标记“我也能做”。</span></li>
          <li><b>3</b><span>围绕福田中心等重点商圈补齐商家供给，提高用户试戴后找到附近门店的成功率。</span></li>
          <li><b>4</b><span>下周重点观察“焕甲使用次数到预约提交”的转化变化，判断推荐理由和试戴效果是否提升成交意愿。</span></li>
        </ol>
      </div>
    </section>

    <p class="footer">生成时间：2026-06-07 21:55 · 静态文件：ops_weekly_report.html</p>
  </main>
</body>
</html>`;
}
